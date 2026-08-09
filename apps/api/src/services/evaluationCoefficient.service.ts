import { prisma } from '@school/database';
import { z } from 'zod';
import crypto from 'crypto';

/**
 * Coefficients proposés dans le select « Coefficient » du formulaire de type
 * d'évaluation. Les deux valeurs par défaut (1 et 2) sont applicatives : elles
 * sont TOUJOURS proposées, ne sont pas stockées en base et ne peuvent donc pas
 * être supprimées. Chaque enseignant peut y ajouter ses propres coefficients
 * (table `teacher_evaluation_coefficients`), visibles de lui seul.
 */
export const DEFAULT_COEFFICIENTS = [
  { value: 1, label: '1 (normal)' },
  { value: 2, label: '2 (coefficientée ×2)' },
] as const;

/** Bornes métier : le coefficient reste un entier (colonne INTEGER en base). */
export const MIN_COEFFICIENT = 1;
export const MAX_COEFFICIENT = 20;

export const createCoefficientSchema = z.object({
  value: z.union([
    z.number(),
    z.string().transform((v) => Number(v)),
  ]).refine((v) => Number.isInteger(v), 'Le coefficient doit être un nombre entier')
    .refine((v) => v >= MIN_COEFFICIENT && v <= MAX_COEFFICIENT, `Le coefficient doit être compris entre ${MIN_COEFFICIENT} et ${MAX_COEFFICIENT}`),
  label: z.string().max(60, 'Le libellé ne peut pas dépasser 60 caractères').optional().nullable(),
});

export interface CoefficientOption {
  /** `null` pour les deux coefficients par défaut (non stockés, non supprimables). */
  id: string | null;
  value: number;
  label: string;
  isDefault: boolean;
}

export class EvaluationCoefficientService {
  /**
   * Options du select pour un enseignant : les deux défauts puis ses
   * coefficients personnalisés, triés par valeur croissante.
   */
  static async getOptions(teacherId: string): Promise<CoefficientOption[]> {
    const custom = await prisma.teacher_evaluation_coefficients.findMany({
      where: { teacher_id: teacherId },
      orderBy: { value: 'asc' },
    });

    const defaults: CoefficientOption[] = DEFAULT_COEFFICIENTS.map((c) => ({
      id: null,
      value: c.value,
      label: c.label,
      isDefault: true,
    }));

    // Un doublon avec un défaut ne devrait pas exister (create le refuse), mais
    // on filtre par sécurité pour ne jamais afficher deux fois la même valeur.
    const defaultValues = new Set(defaults.map((d) => d.value));
    const extras: CoefficientOption[] = custom
      .filter((c) => !defaultValues.has(c.value))
      .map((c) => ({
        id: c.id,
        value: c.value,
        label: c.label?.trim() || `${c.value} (coefficientée ×${c.value})`,
        isDefault: false,
      }));

    return [...defaults, ...extras].sort((a, b) => a.value - b.value);
  }

  /** Valeurs autorisées pour un enseignant (défauts + personnalisés). */
  static async getAllowedValues(teacherId: string): Promise<number[]> {
    const options = await this.getOptions(teacherId);
    return options.map((o) => o.value);
  }

  /** Crée un coefficient personnalisé pour l'enseignant. */
  static async create(teacherId: string, data: { value: number; label?: string | null }) {
    const teacher = await prisma.teachers.findUnique({ where: { id: teacherId } });
    if (!teacher) {
      throw new Error('Enseignant non trouvé');
    }

    const value = Number(data.value);
    if (!Number.isInteger(value)) {
      throw new Error('Le coefficient doit être un nombre entier');
    }
    if (value < MIN_COEFFICIENT || value > MAX_COEFFICIENT) {
      throw new Error(`Le coefficient doit être compris entre ${MIN_COEFFICIENT} et ${MAX_COEFFICIENT}`);
    }

    if (DEFAULT_COEFFICIENTS.some((c) => c.value === value)) {
      throw new Error(`Le coefficient ${value} est déjà proposé par défaut`);
    }

    const existing = await prisma.teacher_evaluation_coefficients.findFirst({
      where: { teacher_id: teacherId, value },
    });
    if (existing) {
      throw new Error(`Vous avez déjà créé le coefficient ${value}`);
    }

    return await prisma.teacher_evaluation_coefficients.create({
      data: {
        id: crypto.randomUUID(),
        teacher_id: teacherId,
        value,
        label: data.label?.trim() || null,
      },
    });
  }

  /**
   * Supprime un coefficient personnalisé. Refusé s'il est encore utilisé par un
   * type d'évaluation de l'enseignant (les notes déjà saisies en dépendent).
   */
  static async delete(id: string, teacherId: string) {
    const coefficient = await prisma.teacher_evaluation_coefficients.findUnique({ where: { id } });
    if (!coefficient) {
      throw new Error('Coefficient non trouvé');
    }
    if (coefficient.teacher_id !== teacherId) {
      throw new Error('Accès non autorisé');
    }

    const usedCount = await prisma.evaluation_types.count({
      where: { teacher_id: teacherId, coefficient: coefficient.value },
    });
    if (usedCount > 0) {
      throw new Error('Ce coefficient est utilisé par des types d\'évaluation et ne peut pas être supprimé');
    }

    await prisma.teacher_evaluation_coefficients.delete({ where: { id } });
    return { success: true };
  }
}
