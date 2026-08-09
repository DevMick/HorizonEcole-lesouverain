import { randomUUID } from 'crypto';
import { prisma } from '@school/database';
import { createInscriptionInvoice } from './odoo.service';
import { ParentService } from './parent.service';

const inscriptionInclude = {
  academicYear: {
    select: {
      id: true,
      name: true,
      startYear: true,
      endYear: true,
      isCurrent: true,
    },
  },
  class: {
    select: {
      id: true,
      name: true,
    },
  },
  student: {
    select: {
      id: true,
      studentNumber: true,
      firstName: true,
      lastName: true,
      gender: true,
      isStateAssigned: true,
    },
  },
} as const;

function transform(inscription: any) {
  return {
    id: inscription.id,
    academicYearId: inscription.academic_year_id,
    classId: inscription.class_id,
    studentId: inscription.student_id,
    academicYear: inscription.academicYear,
    class: inscription.class,
    student: inscription.student,
    createdAt: inscription.created_at,
    updatedAt: inscription.updated_at,
  };
}

export class InscriptionService {
  /**
   * Facture (best-effort) automatiquement l'inscription auprès du parent
   * financièrement responsable de l'élève, via Odoo (produits + échéancier du
   * NIVEAU de la classe — voir `csl.school.level`). N'importe quelle erreur
   * (Odoo éteint, parent non synchronisable, aucun produit affecté au
   * niveau...) est avalée : ça ne doit jamais faire échouer l'inscription.
   */
  static async invoiceInOdoo(inscriptionId: string): Promise<void> {
    try {
      const inscription = await prisma.inscriptions.findUnique({
        where: { id: inscriptionId },
        include: {
          academicYear: { select: { name: true, startYear: true, endYear: true, isCurrent: true } },
          class: { select: { name: true } },
          student: {
            select: {
              firstName: true,
              lastName: true,
              studentParents: {
                include: { parents: true },
              },
            },
          },
        },
      });
      if (!inscription) return;

      const candidates = inscription.student.studentParents.map((sp) => sp.parents);
      const responsible =
        candidates.find((p) => p.is_financial_responsible) ??
        candidates.find((p) => p.is_primary_contact) ??
        candidates[0];

      if (!responsible) {
        console.warn(`Facturation Odoo de l'inscription ${inscriptionId} ignorée : aucun parent lié à l'élève.`);
        return;
      }

      // Toujours (re)synchroniser le parent avant de facturer : au-delà de
      // l'odoo_partner_id (créé si absent), ça rafraîchit aussi ses
      // `csl_child_ids` pour que l'élève de CETTE inscription y figure bien —
      // sans quoi la facture ne peut pas se rattacher à lui (colonne « Élève »
      // vide côté Odoo si le parent avait été synchronisé avant cette
      // inscription).
      await ParentService.syncToOdoo(responsible.id);
      const refreshed = await prisma.parents.findUnique({ where: { id: responsible.id }, select: { odoo_partner_id: true } });
      const partnerId = refreshed?.odoo_partner_id ?? responsible.odoo_partner_id;
      if (!partnerId) {
        console.warn(`Facturation Odoo de l'inscription ${inscriptionId} ignorée : parent non synchronisable avec Odoo.`);
        return;
      }

      const invoiceId = await createInscriptionInvoice({
        studentName: `${inscription.student.firstName} ${inscription.student.lastName}`,
        studentExternalId: inscription.student_id,
        className: inscription.class.name,
        classExternalId: inscription.class_id,
        academicYear: {
          id: inscription.academic_year_id,
          name: inscription.academicYear.name,
          startYear: inscription.academicYear.startYear,
          endYear: inscription.academicYear.endYear,
          isCurrent: inscription.academicYear.isCurrent,
        },
        partnerId,
      });

      if (!invoiceId) {
        console.warn(
          `Facturation Odoo de l'inscription ${inscriptionId} ignorée : aucun produit affecté au niveau de la classe '${inscription.class.name}'.`
        );
      }
    } catch (err) {
      console.warn(`Facturation Odoo de l'inscription ${inscriptionId} échouée :`, (err as Error).message);
    }
  }

  /**
   * Get all inscriptions with filters
   */
  static async getAll(filters?: { academicYearId?: string; classId?: string }) {
    const where: any = {};

    if (filters?.academicYearId) {
      where.academic_year_id = filters.academicYearId;
    }

    if (filters?.classId) {
      where.class_id = filters.classId;
    }

    const inscriptions = await prisma.inscriptions.findMany({
      where,
      include: inscriptionInclude,
      orderBy: { created_at: 'desc' },
    });

    return inscriptions.map(transform);
  }

  /**
   * Get inscription by ID
   */
  static async getById(id: string) {
    const inscription = await prisma.inscriptions.findUnique({
      where: { id },
      include: inscriptionInclude,
    });

    if (!inscription) return null;

    return transform(inscription);
  }

  /**
   * Create inscription linking an existing student to a class for an academic year
   */
  static async create(data: { academicYearId: string; classId: string; studentId: string }) {
    const [student, schoolClass, academicYear] = await Promise.all([
      prisma.student.findUnique({ where: { id: data.studentId } }),
      prisma.schoolClass.findUnique({ where: { id: data.classId } }),
      prisma.academicYear.findUnique({ where: { id: data.academicYearId } }),
    ]);

    if (!student) throw new Error('Élève introuvable');
    if (!schoolClass) throw new Error('Classe introuvable');
    if (!academicYear) throw new Error('Année scolaire introuvable');

    const existing = await prisma.inscriptions.findUnique({
      where: {
        student_id_academic_year_id: {
          student_id: data.studentId,
          academic_year_id: data.academicYearId,
        },
      },
    });

    if (existing) {
      throw new Error('Cet élève est déjà inscrit pour cette année scolaire');
    }

    const inscription = await prisma.inscriptions.create({
      data: {
        id: randomUUID(),
        academic_year_id: data.academicYearId,
        class_id: data.classId,
        student_id: data.studentId,
      },
      include: inscriptionInclude,
    });

    // Keep the student's current class in sync with the latest inscription
    await prisma.student.update({
      where: { id: data.studentId },
      data: { classId: data.classId },
    });

    void InscriptionService.invoiceInOdoo(inscription.id);

    return transform(inscription);
  }

  /**
   * Update inscription (change class and/or academic year)
   */
  static async update(id: string, data: { academicYearId?: string; classId?: string; studentId?: string }) {
    const updateData: any = { updated_at: new Date() };

    if (data.academicYearId !== undefined) updateData.academic_year_id = data.academicYearId;
    if (data.classId !== undefined) updateData.class_id = data.classId;
    if (data.studentId !== undefined) updateData.student_id = data.studentId;

    const inscription = await prisma.inscriptions.update({
      where: { id },
      data: updateData,
      include: inscriptionInclude,
    });

    if (updateData.class_id) {
      await prisma.student.update({
        where: { id: inscription.student_id },
        data: { classId: updateData.class_id },
      });
    }

    return transform(inscription);
  }

  /**
   * Delete inscription
   */
  static async delete(id: string) {
    return prisma.inscriptions.delete({ where: { id } });
  }

  /**
   * Get inscriptions statistics
   */
  static async getStatistics(academicYearId?: string) {
    const where = academicYearId ? { academic_year_id: academicYearId } : {};
    const total = await prisma.inscriptions.count({ where });
    return { total };
  }
}
