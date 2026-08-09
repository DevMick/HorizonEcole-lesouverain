import { prisma } from '@school/database';
import { z } from 'zod';
import { Decimal } from '@prisma/client/runtime/library';

// Validation schemas
const createAbsenceSchema = z.object({
  teacherId: z.string().uuid(),
  date: z.string().transform(str => new Date(str)),
  hoursAbsent: z.number().positive(),
  isJustified: z.boolean().default(false),
  reason: z.string().optional(),
  notes: z.string().optional(),
});

const updateAbsenceSchema = createAbsenceSchema.partial().extend({
  id: z.string().uuid(),
});

const getAbsencesSchema = z.object({
  teacherId: z.string().uuid().optional(),
  month: z.number().int().min(1).max(12).optional(),
  year: z.number().int().min(2000).optional(),
  startDate: z.string().transform(str => new Date(str)).optional(),
  endDate: z.string().transform(str => new Date(str)).optional(),
  isJustified: z.boolean().optional(),
});

export class TeacherAbsenceService {
  /**
   * Create an absence record
   */
  static async createAbsence(data: z.infer<typeof createAbsenceSchema>, createdBy?: string) {
    const validated = createAbsenceSchema.parse(data);

    // Vérifier que l'enseignant existe
    const teacher = await prisma.teachers.findUnique({
      where: { id: validated.teacherId },
    });

    if (!teacher) {
      throw new Error('Enseignant non trouvé');
    }

    const absence = await prisma.teacher_absences.create({
      data: {
        teacher_id: validated.teacherId,
        date: validated.date,
        hours_absent: new Decimal(validated.hoursAbsent),
        is_justified: validated.isJustified,
        reason: validated.reason,
        notes: validated.notes,
        created_by: createdBy,
      },
    });

    return absence;
  }

  /**
   * Update an absence record
   */
  static async updateAbsence(data: z.infer<typeof updateAbsenceSchema>) {
    const validated = updateAbsenceSchema.parse(data);

    const absence = await prisma.teacher_absences.findUnique({
      where: { id: validated.id },
    });

    if (!absence) {
      throw new Error('Absence non trouvée');
    }

    const updateData: any = {};
    if (validated.date !== undefined) updateData.date = validated.date;
    if (validated.hoursAbsent !== undefined) updateData.hours_absent = new Decimal(validated.hoursAbsent);
    if (validated.isJustified !== undefined) updateData.is_justified = validated.isJustified;
    if (validated.reason !== undefined) updateData.reason = validated.reason;
    if (validated.notes !== undefined) updateData.notes = validated.notes;

    const updated = await prisma.teacher_absences.update({
      where: { id: validated.id },
      data: updateData,
    });

    return updated;
  }

  /**
   * Delete an absence record
   */
  static async deleteAbsence(absenceId: string) {
    const absence = await prisma.teacher_absences.findUnique({
      where: { id: absenceId },
    });

    if (!absence) {
      throw new Error('Absence non trouvée');
    }

    await prisma.teacher_absences.delete({
      where: { id: absenceId },
    });

    return { success: true };
  }

  /**
   * Get absences with filters
   */
  static async getAbsences(filters: z.infer<typeof getAbsencesSchema> = {}) {
    const validated = getAbsencesSchema.parse(filters);

    const where: any = {};

    if (validated.teacherId) {
      where.teacher_id = validated.teacherId;
    }

    if (validated.month && validated.year) {
      const startDate = new Date(validated.year, validated.month - 1, 1);
      const endDate = new Date(validated.year, validated.month, 0);
      where.date = {
        gte: startDate,
        lte: endDate,
      };
    } else if (validated.startDate && validated.endDate) {
      where.date = {
        gte: validated.startDate,
        lte: validated.endDate,
      };
    }

    if (validated.isJustified !== undefined) {
      where.is_justified = validated.isJustified;
    }

    const absences = await prisma.teacher_absences.findMany({
      where,
      include: {
        teacher: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
            contract_type: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: {
        date: 'desc',
      },
    });

    return absences;
  }

  /**
   * Get absence by ID
   */
  static async getAbsenceById(absenceId: string) {
    const absence = await prisma.teacher_absences.findUnique({
      where: { id: absenceId },
      include: {
        teacher: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
            contract_type: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    if (!absence) {
      throw new Error('Absence non trouvée');
    }

    return absence;
  }

  /**
   * Get total hours absent for a teacher in a specific month
   */
  static async getTotalHoursAbsent(teacherId: string, month: number, year: number) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const absences = await prisma.teacher_absences.findMany({
      where: {
        teacher_id: teacherId,
        date: {
          gte: startDate,
          lte: endDate,
        },
        // Seules les absences injustifiées sont déduites (selon les règles)
        // Les absences justifiées ne sont pas déduites
        is_justified: false,
      },
    });

    let totalHours = new Decimal(0);
    for (const absence of absences) {
      totalHours = totalHours.plus(absence.hours_absent);
    }

    return totalHours;
  }

  /**
   * Get absences summary for a teacher in a month
   */
  static async getAbsencesSummary(teacherId: string, month: number, year: number) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const [justified, unjustified] = await Promise.all([
      prisma.teacher_absences.findMany({
        where: {
          teacher_id: teacherId,
          date: {
            gte: startDate,
            lte: endDate,
          },
          is_justified: true,
        },
      }),
      prisma.teacher_absences.findMany({
        where: {
          teacher_id: teacherId,
          date: {
            gte: startDate,
            lte: endDate,
          },
          is_justified: false,
        },
      }),
    ]);

    let justifiedHours = new Decimal(0);
    let unjustifiedHours = new Decimal(0);

    for (const absence of justified) {
      justifiedHours = justifiedHours.plus(absence.hours_absent);
    }

    for (const absence of unjustified) {
      unjustifiedHours = unjustifiedHours.plus(absence.hours_absent);
    }

    return {
      justified: {
        count: justified.length,
        totalHours: justifiedHours,
      },
      unjustified: {
        count: unjustified.length,
        totalHours: unjustifiedHours,
      },
      total: {
        count: justified.length + unjustified.length,
        totalHours: justifiedHours.plus(unjustifiedHours),
      },
    };
  }
}

