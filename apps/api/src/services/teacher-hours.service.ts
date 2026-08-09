import { prisma } from '@school/database';
import { z } from 'zod';
import { Decimal } from '@prisma/client/runtime/library';

// Validation schemas
const createTeacherHoursSchema = z.object({
  teacherId: z.string().uuid(),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000),
  hoursWorked: z.number().positive(),
  subject: z.string().optional(),
  notes: z.string().optional(),
});

const updateTeacherHoursSchema = z.object({
  hoursWorked: z.number().positive().optional(),
  subject: z.string().optional(),
  notes: z.string().optional(),
});

export class TeacherHoursService {
  /**
   * Create or update teacher hours for a month
   */
  static async upsertHours(data: z.infer<typeof createTeacherHoursSchema>) {
    const validated = createTeacherHoursSchema.parse(data);

    // Vérifier que l'enseignant est un vacataire
    const teacher = await prisma.teachers.findUnique({
      where: { id: validated.teacherId },
    });

    if (!teacher) {
      throw new Error('Enseignant non trouvé');
    }

    if (teacher.contract_type !== 'VACATAIRE') {
      throw new Error('Les heures ne peuvent être enregistrées que pour les vacataires');
    }

    // Utiliser findFirst avec where pour vérifier l'existence
    const existing = await prisma.teacher_hours.findFirst({
      where: {
        teacher_id: validated.teacherId,
        month: validated.month,
        year: validated.year,
      },
    });

    if (existing) {
      return prisma.teacher_hours.update({
        where: { id: existing.id },
        data: {
          hours_worked: new Decimal(validated.hoursWorked),
          subject: validated.subject,
          notes: validated.notes,
        },
      });
    }

    return prisma.teacher_hours.create({
      data: {
        teacher_id: validated.teacherId,
        month: validated.month,
        year: validated.year,
        hours_worked: new Decimal(validated.hoursWorked),
        subject: validated.subject,
        notes: validated.notes,
      },
    });
  }

  /**
   * Get hours for a teacher in a specific month
   */
  static async getHours(teacherId: string, month: number, year: number) {
    return prisma.teacher_hours.findFirst({
      where: {
        teacher_id: teacherId,
        month,
        year,
      },
    });
  }

  /**
   * Get all hours for a teacher
   */
  static async getTeacherHours(teacherId: string) {
    return prisma.teacher_hours.findMany({
      where: { teacher_id: teacherId },
      orderBy: [
        { year: 'desc' },
        { month: 'desc' },
      ],
    });
  }

  /**
   * Get hours for all vacataires in a month
   */
  static async getMonthHours(month: number, year: number) {
    return prisma.teacher_hours.findMany({
      where: {
        month,
        year,
        teacher: {
          contract_type: 'VACATAIRE',
        },
      },
      include: {
        teacher: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
          },
        },
      },
      orderBy: {
        teacher: {
          last_name: 'asc',
        },
      },
    });
  }

  /**
   * Delete hours for a teacher in a month
   */
  static async deleteHours(teacherId: string, month: number, year: number) {
    const hours = await prisma.teacher_hours.findFirst({
      where: {
        teacher_id: teacherId,
        month,
        year,
      },
    });

    if (!hours) {
      throw new Error('Heures non trouvées pour ce mois');
    }

    return prisma.teacher_hours.delete({
      where: { id: hours.id },
    });
  }
}
