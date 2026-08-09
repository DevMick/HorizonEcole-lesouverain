import { prisma } from '@school/database';
import { z } from 'zod';

// Validation schemas
const createRemunerationSchema = z.object({
  teacherId: z.string().uuid(),
  modeRemuneration: z.enum(['HORAIRE', 'FORFAIT_MENSUEL']),
  tauxHoraire: z.number().positive().optional(),
  heuresHebdo: z.number().int().positive().optional(),
  forfaitMensuel: z.number().positive().optional(),
  periodeFacturation: z.string().default('MENSUELLE'),
  cnpsApplicable: z.boolean().default(true),
  compteBancaire: z.string().optional(),
  modePaiement: z.string().optional(),
});

const updateRemunerationSchema = createRemunerationSchema.partial().extend({
  teacherId: z.string().uuid(),
});

const createAllowanceSchema = z.object({
  teacherId: z.string().uuid(),
  title: z.string().min(1).max(200),
  amount: z.number().positive(),
  typeMontant: z.enum(['MONTANT_FIXE', 'POURCENTAGE_DU_BRUT']),
  isRecurring: z.boolean().default(false),
  isTaxable: z.boolean().default(true),
  category: z.enum(['INDEMNITE', 'PRIME', 'AVANTAGE', 'AVANTAGE_EN_NATURE']),
  effectiveFrom: z.string().transform(str => new Date(str)),
  effectiveTo: z.string().transform(str => new Date(str)).optional(),
  notes: z.string().optional(),
  condition: z.string().optional(),
});

const updateAllowanceSchema = createAllowanceSchema.partial().extend({
  id: z.string().uuid(),
});

export class TeacherRemunerationService {
  /**
   * Get or create remuneration for a teacher
   */
  static async getOrCreateRemuneration(teacherId: string) {
    let remuneration = await prisma.teacher_remuneration.findUnique({
      where: { teacher_id: teacherId },
    });

    if (!remuneration) {
      // Create default remuneration
      remuneration = await prisma.teacher_remuneration.create({
        data: {
          teacher_id: teacherId,
          mode_remuneration: 'FORFAIT_MENSUEL',
          periode_facturation: 'MENSUELLE',
          cnps_applicable: true,
        },
      });
    }

    return remuneration;
  }

  /**
   * Update remuneration for a teacher
   */
  static async updateRemuneration(teacherId: string, data: z.infer<typeof updateRemunerationSchema>) {
    const validated = updateRemunerationSchema.parse({ ...data, teacherId });

    const remuneration = await prisma.teacher_remuneration.upsert({
      where: { teacher_id: teacherId },
      update: {
        mode_remuneration: validated.modeRemuneration,
        taux_horaire: validated.tauxHoraire,
        heures_hebdo: validated.heuresHebdo,
        forfait_mensuel: validated.forfaitMensuel,
        periode_facturation: validated.periodeFacturation,
        cnps_applicable: validated.cnpsApplicable,
        compte_bancaire: validated.compteBancaire,
        mode_paiement: validated.modePaiement,
      },
      create: {
        teacher_id: teacherId,
        mode_remuneration: validated.modeRemuneration || 'FORFAIT_MENSUEL',
        taux_horaire: validated.tauxHoraire,
        heures_hebdo: validated.heuresHebdo,
        forfait_mensuel: validated.forfaitMensuel,
        periode_facturation: validated.periodeFacturation || 'MENSUELLE',
        cnps_applicable: validated.cnpsApplicable ?? true,
        compte_bancaire: validated.compteBancaire,
        mode_paiement: validated.modePaiement,
      },
    });

    return remuneration;
  }

  /**
   * Get all allowances for a teacher
   */
  static async getAllowances(teacherId: string, filters?: {
    isRecurring?: boolean;
    effectiveDate?: Date;
  }) {
    const where: any = { teacher_id: teacherId };

    if (filters?.isRecurring !== undefined) {
      where.is_recurring = filters.isRecurring;
    }

    if (filters?.effectiveDate) {
      where.OR = [
        { effective_to: null },
        { effective_to: { gte: filters.effectiveDate } },
      ];
      where.effective_from = { lte: filters.effectiveDate };
    }

    const allowances = await prisma.teacher_allowances.findMany({
      where,
      orderBy: { created_at: 'desc' },
    });

    return allowances;
  }

  /**
   * Create an allowance
   */
  static async createAllowance(data: z.infer<typeof createAllowanceSchema>) {
    const validated = createAllowanceSchema.parse(data);

    const allowance = await prisma.teacher_allowances.create({
      data: {
        teacher_id: validated.teacherId,
        title: validated.title,
        amount: validated.amount,
        type_montant: validated.typeMontant,
        is_recurring: validated.isRecurring,
        is_taxable: validated.isTaxable,
        category: validated.category,
        effective_from: validated.effectiveFrom,
        effective_to: validated.effectiveTo,
        notes: validated.notes,
        condition: validated.condition,
      },
    });

    return allowance;
  }

  /**
   * Update an allowance
   */
  static async updateAllowance(id: string, data: z.infer<typeof updateAllowanceSchema>) {
    const validated = updateAllowanceSchema.parse({ ...data, id });

    const allowance = await prisma.teacher_allowances.update({
      where: { id },
      data: {
        title: validated.title,
        amount: validated.amount,
        type_montant: validated.typeMontant,
        is_recurring: validated.isRecurring,
        is_taxable: validated.isTaxable,
        category: validated.category,
        effective_from: validated.effectiveFrom,
        effective_to: validated.effectiveTo,
        notes: validated.notes,
        condition: validated.condition,
      },
    });

    return allowance;
  }

  /**
   * Delete an allowance
   */
  static async deleteAllowance(id: string) {
    await prisma.teacher_allowances.delete({
      where: { id },
    });
  }

  /**
   * Get teacher with remuneration data
   */
  static async getTeacherWithRemuneration(teacherId: string) {
    const teacher = await prisma.teachers.findUnique({
      where: { id: teacherId },
      include: {
        remuneration: true,
        allowances: {
          orderBy: { created_at: 'desc' },
        },
      },
    });

    return teacher;
  }

  /**
   * Calculate seniority in years
   */
  static calculateSeniority(hireDate: Date, referenceDate: Date = new Date()): number {
    const years = (referenceDate.getTime() - hireDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    return Math.floor(years);
  }
}

