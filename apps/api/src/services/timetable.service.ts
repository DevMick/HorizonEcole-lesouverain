import { prisma } from '@school/database';
import { z } from 'zod';

// Validation schemas
export const createTimetableSchema = z.object({
  academicYearId: z.string().min(1, 'L\'année académique est requise'),
  classId: z.string().min(1, 'La classe est requise'),
  dayOfWeek: z.enum(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY']),
  startTime: z.string().min(1, 'L\'heure de début est requise'),
  endTime: z.string().min(1, 'L\'heure de fin est requise'),
  subjectId: z.string().min(1, 'La matière est requise'),
  teacherId: z.string().min(1, 'L\'enseignant est requis'),
  classroomId: z.string().min(1, 'La salle de classe est requise'),
});

export const updateTimetableSchema = z.object({
  academicYearId: z.string().min(1).optional(),
  classId: z.string().min(1).optional(),
  dayOfWeek: z.enum(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY']).optional(),
  startTime: z.string().min(1).optional(),
  endTime: z.string().min(1).optional(),
  subjectId: z.string().min(1).optional(),
  teacherId: z.string().min(1).optional(),
  classroomId: z.string().min(1).optional(),
});

/**
 * Garantit l'existence de l'affectation enseignant↔classe↔matière correspondant
 * à un créneau de planning (remplace la saisie manuelle sur
 * /academic/class-assignments : le planning est désormais la source de vérité).
 * Upsert idempotent sur la contrainte unique existante — ne duplique jamais.
 */
async function ensureAssignment(params: {
  teacherId: string;
  classId: string;
  subjectId: string;
  academicYearId: string;
}) {
  try {
    await prisma.teacher_class_assignments.upsert({
      where: {
        teacher_id_class_id_subject_id_academic_year_id: {
          teacher_id: params.teacherId,
          class_id: params.classId,
          subject_id: params.subjectId,
          academic_year_id: params.academicYearId,
        },
      },
      update: {},
      create: {
        teacher_id: params.teacherId,
        class_id: params.classId,
        subject_id: params.subjectId,
        academic_year_id: params.academicYearId,
      },
    });
  } catch (error: any) {
    // Deux créneaux du même enseignant/classe/matière peuvent être enregistrés
    // en parallèle (sélection multiple d'horaires) : l'upsert n'est pas
    // atomique face à cette concurrence, la seconde requête peut heurter la
    // contrainte unique alors que l'affectation vient d'être créée par la
    // première — dans ce cas l'affectation existe déjà, ce qui est le résultat
    // voulu, donc on l'ignore.
    if (error?.code !== 'P2002') throw error;
  }
}

/**
 * Supprime l'affectation enseignant↔classe↔matière dès lors qu'AUCUN créneau de
 * planning ne la justifie plus (le planning étant la source de vérité : cf.
 * ensureAssignment). Appelé après toute modification/suppression de créneau pour
 * éviter que des affectations orphelines subsistent — elles apparaîtraient à tort
 * dans « Mes classes » et le filtre matière de la saisie des notes. Idempotent :
 * `deleteMany` ne lève pas si la ligne n'existe déjà plus.
 */
async function pruneAssignmentIfOrphaned(params: {
  teacherId: string;
  classId: string;
  subjectId: string;
  academicYearId: string;
}) {
  const remaining = await prisma.class_timetables.count({
    where: {
      teacher_id: params.teacherId,
      class_id: params.classId,
      subject_id: params.subjectId,
      academic_year_id: params.academicYearId,
    },
  });
  if (remaining === 0) {
    await prisma.teacher_class_assignments.deleteMany({
      where: {
        teacher_id: params.teacherId,
        class_id: params.classId,
        subject_id: params.subjectId,
        academic_year_id: params.academicYearId,
      },
    });
  }
}

export class TimetableService {
  static async getAll(filters: {
    academicYearId?: string;
    classId?: string;
  } = {}) {
    const where: any = {};

    if (filters.academicYearId) {
      where.academic_year_id = filters.academicYearId;
    }

    if (filters.classId) {
      where.class_id = filters.classId;
    }

    const timetables = await prisma.class_timetables.findMany({
      where,
      include: {
        academicYear: true,
        class: true,
        subject: true,
        teacher: true,
        classroom: true,
      },
      orderBy: [
        { day_of_week: 'asc' },
        { start_time: 'asc' },
      ],
    });

    return timetables;
  }

  static async getById(id: string) {
    const timetable = await prisma.class_timetables.findUnique({
      where: { id },
      include: {
        academicYear: true,
        class: true,
        subject: true,
        teacher: true,
        classroom: true,
      },
    });

    if (!timetable) {
      throw new Error('Emploi du temps non trouvé');
    }

    return timetable;
  }

  static async create(data: z.infer<typeof createTimetableSchema>) {
    // Vérifier qu'il n'y a pas de conflit (même créneau horaire pour la même classe, jour et année)
    const existing = await prisma.class_timetables.findFirst({
      where: {
        academic_year_id: data.academicYearId,
        class_id: data.classId,
        day_of_week: data.dayOfWeek,
        start_time: data.startTime,
      },
    });

    if (existing) {
      throw new Error('Un cours existe déjà à ce créneau horaire pour cette classe');
    }

    const timetable = await prisma.class_timetables.create({
      data: {
        academic_year_id: data.academicYearId,
        class_id: data.classId,
        day_of_week: data.dayOfWeek,
        start_time: data.startTime,
        end_time: data.endTime,
        subject_id: data.subjectId,
        teacher_id: data.teacherId,
        classroom_id: data.classroomId,
      },
      include: {
        academicYear: true,
        class: true,
        subject: true,
        teacher: true,
        classroom: true,
      },
    });

    await ensureAssignment({
      teacherId: data.teacherId,
      classId: data.classId,
      subjectId: data.subjectId,
      academicYearId: data.academicYearId,
    });

    return timetable;
  }

  static async update(id: string, data: z.infer<typeof updateTimetableSchema>) {
    // Vérifier si l'emploi du temps existe
    const existing = await prisma.class_timetables.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new Error('Emploi du temps non trouvé');
    }

    // Tuple enseignant↔classe↔matière AVANT modification, pour nettoyer
    // l'ancienne affectation si le créneau bascule vers un autre trio.
    const prevAssignment = {
      teacherId: existing.teacher_id,
      classId: existing.class_id,
      subjectId: existing.subject_id,
      academicYearId: existing.academic_year_id,
    };

    // Si le créneau horaire change, vérifier qu'il n'y a pas de conflit
    if (data.academicYearId || data.classId || data.dayOfWeek || data.startTime) {
      const academicYearId = data.academicYearId || existing.academic_year_id;
      const classId = data.classId || existing.class_id;
      const dayOfWeek = data.dayOfWeek || existing.day_of_week;
      const startTime = data.startTime || existing.start_time;

      const conflict = await prisma.class_timetables.findFirst({
        where: {
          academic_year_id: academicYearId,
          class_id: classId,
          day_of_week: dayOfWeek,
          start_time: startTime,
          NOT: {
            id,
          },
        },
      });

      if (conflict) {
        throw new Error('Un cours existe déjà à ce créneau horaire pour cette classe');
      }
    }

    const updateData: any = {};
    if (data.academicYearId) updateData.academic_year_id = data.academicYearId;
    if (data.classId) updateData.class_id = data.classId;
    if (data.dayOfWeek) updateData.day_of_week = data.dayOfWeek;
    if (data.startTime) updateData.start_time = data.startTime;
    if (data.endTime) updateData.end_time = data.endTime;
    if (data.subjectId) updateData.subject_id = data.subjectId;
    if (data.teacherId) updateData.teacher_id = data.teacherId;
    if (data.classroomId) updateData.classroom_id = data.classroomId;

    const timetable = await prisma.class_timetables.update({
      where: { id },
      data: updateData,
      include: {
        academicYear: true,
        class: true,
        subject: true,
        teacher: true,
        classroom: true,
      },
    });

    await ensureAssignment({
      teacherId: timetable.teacher_id,
      classId: timetable.class_id,
      subjectId: timetable.subject_id,
      academicYearId: timetable.academic_year_id,
    });

    // Le créneau pointe désormais vers un autre trio : purger l'ancienne
    // affectation si plus aucun créneau ne la référence.
    const changedTrio =
      prevAssignment.teacherId !== timetable.teacher_id ||
      prevAssignment.classId !== timetable.class_id ||
      prevAssignment.subjectId !== timetable.subject_id ||
      prevAssignment.academicYearId !== timetable.academic_year_id;
    if (changedTrio) {
      await pruneAssignmentIfOrphaned(prevAssignment);
    }

    return timetable;
  }

  static async delete(id: string) {
    // Vérifier si l'emploi du temps existe
    const existing = await prisma.class_timetables.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new Error('Emploi du temps non trouvé');
    }

    await prisma.class_timetables.delete({
      where: { id },
    });

    // Le planning est la source de vérité : purger l'affectation correspondante
    // si ce créneau était le dernier à la justifier.
    await pruneAssignmentIfOrphaned({
      teacherId: existing.teacher_id,
      classId: existing.class_id,
      subjectId: existing.subject_id,
      academicYearId: existing.academic_year_id,
    });

    return { message: 'Emploi du temps supprimé avec succès' };
  }

  static async deleteByFilters(filters: {
    academicYearId?: string;
    classId?: string;
  }) {
    const where: any = {};

    if (filters.academicYearId) {
      where.academic_year_id = filters.academicYearId;
    }

    if (filters.classId) {
      where.class_id = filters.classId;
    }

    // Affectations couvertes par ce périmètre, capturées AVANT la suppression
    // en masse pour pouvoir purger celles devenues orphelines ensuite.
    const impacted = await prisma.teacher_class_assignments.findMany({ where });

    await prisma.class_timetables.deleteMany({
      where,
    });

    // Purger les affectations qui n'ont plus aucun créneau pour les justifier.
    for (const a of impacted) {
      await pruneAssignmentIfOrphaned({
        teacherId: a.teacher_id,
        classId: a.class_id,
        subjectId: a.subject_id,
        academicYearId: a.academic_year_id,
      });
    }

    return { message: 'Emplois du temps supprimés avec succès' };
  }
}

