import { prisma } from '@school/database';
import { z } from 'zod';
import crypto from 'crypto';
import { EvaluationCoefficientService } from './evaluationCoefficient.service';

// Coerce number|string vers un entier (ou undefined). Le champ Numéro n'est plus
// saisi : il est attribué automatiquement par nom à la création.
const intCoerce = z.union([
  z.number().int(),
  z.string().transform((val) => {
    const parsed = parseInt(val, 10);
    return isNaN(parsed) ? undefined : parsed;
  }),
]).optional().nullable();

export const createEvaluationTypeSchema = z.object({
  name: z.string().min(1, 'Le nom est obligatoire').max(200, 'Le nom ne peut pas dépasser 200 caractères'),
  teacherId: z.string().min(1, 'L\'enseignant est obligatoire'),
  academicYearId: z.string().min(1, 'L\'année scolaire est obligatoire'),
  classId: z.string().min(1, 'La classe est obligatoire'),
  subjectId: z.string().min(1, 'La matière est obligatoire'),
  coefficient: intCoerce, // 1 (défaut) ou 2
  maxNote: intCoerce,     // barème « Note sur » : 10 ou 20 (défaut)
});

export const updateEvaluationTypeSchema = z.object({
  name: z.string().min(1, 'Le nom est obligatoire').max(200, 'Le nom ne peut pas dépasser 200 caractères').optional(),
  coefficient: intCoerce,
  maxNote: intCoerce,
});

/**
 * Coefficient : les deux valeurs par défaut (1 et 2) plus les coefficients
 * personnalisés créés par CET enseignant. Toute valeur hors de cette liste est
 * refusée (plutôt que silencieusement ramenée à 1, ce qui fausserait la moyenne).
 */
async function normalizeCoefficient(teacherId: string, c?: number | null): Promise<number> {
  if (c === undefined || c === null) return 1; // défaut
  const value = Number(c);
  const allowed = await EvaluationCoefficientService.getAllowedValues(teacherId);
  if (!allowed.includes(value)) {
    throw new Error(`Coefficient ${value} non autorisé : créez-le d'abord avec le bouton « + » du champ Coefficient`);
  }
  return value;
}

function normalizeMaxNote(m?: number | null): number {
  return m === 10 ? 10 : 20; // barème « Note sur » : 10 ou 20 (défaut)
}

export class EvaluationTypeService {
  /**
   * Get all evaluation types
   */
  static async getAll(filters?: { teacherId?: string; academicYearId?: string; classId?: string; subjectId?: string }) {
    try {
      const where: any = {};

      if (filters?.teacherId) where.teacher_id = filters.teacherId;
      if (filters?.academicYearId) where.academic_year_id = filters.academicYearId;
      if (filters?.classId) where.class_id = filters.classId;
      if (filters?.subjectId) where.subject_id = filters.subjectId;

      const evaluationTypes = await prisma.evaluation_types.findMany({
        where,
        include: {
          teacher: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
            },
          },
        },
        orderBy: [
          { created_at: 'desc' },
        ],
      });
      
      return evaluationTypes;
    } catch (error) {
      console.error('Error in getAll evaluation types:', error);
      throw error;
    }
  }

  /**
   * Get evaluation type by ID
   */
  static async getById(id: string) {
    return await prisma.evaluation_types.findUnique({
      where: { id },
      include: {
        teacher: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
          },
        },
      },
    });
  }

  /**
   * Create evaluation type
   */
  static async create(data: {
    name: string;
    teacherId: string;
    academicYearId: string;
    classId: string;
    subjectId: string;
    coefficient?: number | null;
    maxNote?: number | null;
  }) {
    // Validate name
    if (!data.name || data.name.trim().length === 0) {
      throw new Error('Le nom est obligatoire');
    }
    if (data.name.length > 200) {
      throw new Error('Le nom ne peut pas dépasser 200 caractères');
    }
    if (!data.academicYearId || !data.classId || !data.subjectId) {
      throw new Error('Année scolaire, classe et matière sont obligatoires');
    }

    // Check if teacher exists
    const teacher = await prisma.teachers.findUnique({
      where: { id: data.teacherId },
    });
    if (!teacher) {
      throw new Error('Enseignant non trouvé');
    }

    const name = data.name.trim();

    // Numéro attribué automatiquement, séquentiel PAR NOM dans le périmètre
    // (enseignant + année + classe + matière) : DEVOIR N°1, N°2… ; INTERROGATION repart à N°1.
    const last = await prisma.evaluation_types.findFirst({
      where: {
        teacher_id: data.teacherId,
        academic_year_id: data.academicYearId,
        class_id: data.classId,
        subject_id: data.subjectId,
        name,
      },
      orderBy: { number: 'desc' },
      select: { number: true },
    });
    const nextNumber = (last?.number ?? 0) + 1;

    // Valide le coefficient contre les défauts + ceux créés par l'enseignant.
    const coefficient = await normalizeCoefficient(data.teacherId, data.coefficient);

    // Generate UUID for the evaluation type ID
    const id = crypto.randomUUID();

    // Create the new evaluation type
    const newEvaluationType = await prisma.evaluation_types.create({
      data: {
        id,
        name,
        teacher_id: data.teacherId,
        academic_year_id: data.academicYearId,
        class_id: data.classId,
        subject_id: data.subjectId,
        coefficient,
        max_note: normalizeMaxNote(data.maxNote),
        number: nextNumber,
      },
      include: {
        teacher: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
          },
        },
      },
    });

    return newEvaluationType;
  }

  /**
   * Update evaluation type
   */
  static async update(id: string, data: {
    name?: string;
    coefficient?: number | null;
    maxNote?: number | null;
  }) {
    const evaluationType = await prisma.evaluation_types.findUnique({
      where: { id },
    });

    if (!evaluationType) {
      throw new Error('Type d\'évaluation non trouvé');
    }

    const updateData: any = {};

    if (data.name !== undefined) {
      if (!data.name || data.name.trim().length === 0) {
        throw new Error('Le nom est obligatoire');
      }
      if (data.name.length > 200) {
        throw new Error('Le nom ne peut pas dépasser 200 caractères');
      }
      updateData.name = data.name.trim();
    }

    if (data.coefficient !== undefined) {
      updateData.coefficient = await normalizeCoefficient(evaluationType.teacher_id, data.coefficient);
    }

    if (data.maxNote !== undefined) {
      updateData.max_note = normalizeMaxNote(data.maxNote);
    }
    // Le numéro n'est pas modifiable (attribué automatiquement à la création).

    return await prisma.evaluation_types.update({
      where: { id },
      data: updateData,
      include: {
        teacher: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
          },
        },
      },
    });
  }

  /**
   * Delete evaluation type
   */
  static async delete(id: string) {
    const evaluationType = await prisma.evaluation_types.findUnique({
      where: { id },
    });

    if (!evaluationType) {
      throw new Error('Type d\'évaluation non trouvé');
    }

    // Check if evaluation type is used in grades
    const gradesCount = await prisma.grades.count({
      where: { evaluation_type_id: id },
    });

    if (gradesCount > 0) {
      throw new Error('Ce type d\'évaluation est utilisé dans des notes et ne peut pas être supprimé');
    }

    await prisma.evaluation_types.delete({
      where: { id },
    });

    return { success: true };
  }
}

