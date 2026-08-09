import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import crypto from 'crypto';

const prisma = new PrismaClient();

// Validation schemas
const createScheduleSchema = z.object({
  classId: z.string().uuid(),
  subjectId: z.string().uuid(),
  teacherId: z.string().uuid(),
  academicYearId: z.string().uuid(),
  dayOfWeek: z.number().min(1).max(7), // 1=Monday, 7=Sunday
  startTime: z.string().regex(/^\d{2}:\d{2}$/), // HH:MM format
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  room: z.string().optional(),
});

const updateScheduleSchema = createScheduleSchema.partial();

const createExceptionSchema = z.object({
  scheduleId: z.string().uuid(),
  date: z.string().transform(str => new Date(str)),
  replacementTeacherId: z.string().uuid().optional(),
  isCancelled: z.boolean().optional().default(false),
  reason: z.string().optional(),
});

const updateExceptionSchema = createExceptionSchema.partial().omit({ scheduleId: true });

export class ScheduleService {
  // Helper: Convert time string to minutes
  private static timeToMinutes(timeStr: string): number {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  }

  // Helper: Check if two time ranges overlap
  private static timesOverlap(start1: string, end1: string, start2: string, end2: string): boolean {
    const s1 = this.timeToMinutes(start1);
    const e1 = this.timeToMinutes(end1);
    const s2 = this.timeToMinutes(start2);
    const e2 = this.timeToMinutes(end2);

    return (s1 < e2 && e1 > s2);
  }

  // Check for schedule conflicts
  static async checkScheduleConflicts(data: {
    classId: string;
    teacherId: string;
    academicYearId: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    excludeScheduleId?: string;
  }) {
    const { classId, teacherId, academicYearId, dayOfWeek, startTime, endTime, excludeScheduleId } = data;

    const where: any = {
      academicYearId,
      dayOfWeek,
      isActive: true,
    };

    if (excludeScheduleId) {
      where.id = { not: excludeScheduleId };
    }

    // Check class conflicts
    const classSchedules = await prisma.schedules.findMany({
      where: { ...where, class_id: classId },
      include: { subjects: true }
    });

    for (const schedule of classSchedules) {
      const schedStart = schedule.start_time.toISOString().substring(11, 16);
      const schedEnd = schedule.end_time.toISOString().substring(11, 16);
      
      if (this.timesOverlap(startTime, endTime, schedStart, schedEnd)) {
        return {
          hasConflict: true,
          conflictType: 'class',
          conflictWith: schedule,
          message: `Conflit avec le cours de ${schedule.subjects.name} pour cette classe au même horaire`,
        };
      }
    }

    // Check teacher conflicts
    const teacherSchedules = await prisma.schedules.findMany({
      where: { ...where, teacher_id: teacherId },
      include: { subjects: true, class: true }
    });

    for (const schedule of teacherSchedules) {
      const schedStart = schedule.start_time.toISOString().substring(11, 16);
      const schedEnd = schedule.end_time.toISOString().substring(11, 16);
      
      if (this.timesOverlap(startTime, endTime, schedStart, schedEnd)) {
        return {
          hasConflict: true,
          conflictType: 'teacher',
          conflictWith: schedule,
          message: `L'enseignant a déjà un cours de ${schedule.subjects.name} avec la classe ${schedule.class.name} à cet horaire`,
        };
      }
    }

    return { hasConflict: false };
  }

  // Get all schedules
  static async getSchedules(filters: {
    classId?: string;
    teacherId?: string;
    academicYearId?: string;
    dayOfWeek?: number;
    page?: number;
    limit?: number;
  } = {}) {
    const { classId, teacherId, academicYearId, dayOfWeek, page = 1, limit = 100 } = filters;

    const where: any = { is_active: true };
    if (classId) where.class_id = classId;
    if (teacherId) where.teacher_id = teacherId;
    if (academicYearId) where.academic_year_id = academicYearId;
    if (dayOfWeek !== undefined) where.day_of_week = dayOfWeek;

    const [schedules, total] = await Promise.all([
      prisma.schedules.findMany({
        where,
        include: {
          class: { select: { id: true, name: true } },
          subjects: { select: { id: true, name: true, code: true } },
          schedule_exceptions: { where: { date: { gte: new Date() } }, orderBy: { date: 'asc' }, take: 5 }
        },
        orderBy: [{ day_of_week: 'asc' }, { start_time: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.schedules.count({ where }),
    ]);

    return { schedules, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  // Get schedule by ID
  static async getScheduleById(id: string) {
    const schedule = await prisma.schedules.findUnique({
      where: { id },
        include: {
        class: true,
        subjects: true,
        schedule_exceptions: { orderBy: { date: 'desc' } }
      },
    });

    if (!schedule) throw new Error('Schedule not found');
    return schedule;
  }

  // Create schedule with conflict check
  static async createSchedule(data: z.infer<typeof createScheduleSchema>) {
    // Verify entities exist
    const [classExists, subjectExists, teacherExists, academicYearExists] = await Promise.all([
      prisma.schoolClass.findUnique({ where: { id: data.classId } }),
      prisma.subjects.findUnique({ where: { id: data.subjectId } }),
      // prisma.staff.findUnique({ where: { id: data.teacherId } }), // Model does not exist - use teachers instead
      prisma.teachers.findUnique({ where: { id: data.teacherId } }),
      prisma.academicYear.findUnique({ where: { id: data.academicYearId } }),
    ]);

    if (!classExists) throw new Error('Class not found');
    if (!subjectExists) throw new Error('Subject not found');
    if (!teacherExists) throw new Error('Teacher not found');
    if (!academicYearExists) throw new Error('Academic year not found');

    // Check for conflicts
    const conflictCheck = await this.checkScheduleConflicts({
      classId: data.classId,
      teacherId: data.teacherId,
      academicYearId: data.academicYearId,
      dayOfWeek: data.dayOfWeek,
      startTime: data.startTime,
      endTime: data.endTime,
    });

    if (conflictCheck.hasConflict) {
      throw new Error(conflictCheck.message!);
    }

    // Convert time strings to DateTime (time only)
    const startDateTime = new Date(`1970-01-01T${data.startTime}:00Z`);
    const endDateTime = new Date(`1970-01-01T${data.endTime}:00Z`);

    const schedule = await prisma.schedules.create({
      data: {
        id: crypto.randomUUID(),
        class: { connect: { id: data.classId } },
        teacher_id: data.teacherId,
        subjects: { connect: { id: data.subjectId } },
        academicYear: { connect: { id: data.academicYearId } },
        day_of_week: data.dayOfWeek,
        start_time: startDateTime,
        end_time: endDateTime,
        room: data.room,
        is_active: true,
      },
      include: {
        class: true,
        subjects: true,
      }
    });

    return schedule;
  }

  // Update schedule
  static async updateSchedule(id: string, data: z.infer<typeof updateScheduleSchema>) {
    const schedule = await prisma.schedules.findUnique({ where: { id } });
    if (!schedule) throw new Error('Schedule not found');

    // If updating time or day, check conflicts
    if (data.dayOfWeek || data.startTime || data.endTime) {
      const conflictCheck = await this.checkScheduleConflicts({
        classId: data.classId || schedule.class_id,
        teacherId: data.teacherId || schedule.teacher_id,
        academicYearId: data.academicYearId || schedule.academic_year_id,
        dayOfWeek: data.dayOfWeek || schedule.day_of_week,
        startTime: data.startTime || schedule.start_time.toISOString().substring(11, 16),
        endTime: data.endTime || schedule.end_time.toISOString().substring(11, 16),
        excludeScheduleId: id,
      });

      if (conflictCheck.hasConflict) {
        throw new Error(conflictCheck.message!);
      }
    }

    // Convert time strings if provided
    const updateData: any = {};
    if (data.classId) updateData.class_id = data.classId;
    if (data.teacherId) updateData.teacher_id = data.teacherId;
    if (data.subjectId) updateData.subject_id = data.subjectId;
    if (data.academicYearId) updateData.academic_year_id = data.academicYearId;
    if (data.dayOfWeek) updateData.day_of_week = data.dayOfWeek;
    if (data.startTime) updateData.start_time = new Date(`1970-01-01T${data.startTime}:00Z`);
    if (data.endTime) updateData.end_time = new Date(`1970-01-01T${data.endTime}:00Z`);
    if (data.room !== undefined) updateData.room = data.room;

    return await prisma.schedules.update({
      where: { id },
      data: updateData,
      include: { class: true, subjects: true }
    });
  }

  // Delete schedule
  static async deleteSchedule(id: string) {
    const schedule = await prisma.schedules.findUnique({ where: { id } });
    if (!schedule) throw new Error('Schedule not found');
    await prisma.schedules.delete({ where: { id } });
    return { message: 'Schedule deleted successfully' };
  }

  // Get schedules by class (for timetable view)
  static async getClassTimetable(classId: string, academicYearId?: string) {
    const where: any = { class_id: classId, is_active: true };
    if (academicYearId) where.academic_year_id = academicYearId;

    const schedules = await prisma.schedules.findMany({
      where,
      include: {
        subjects: { select: { name: true, code: true } },
      },
      orderBy: [{ day_of_week: 'asc' }, { start_time: 'asc' }]
    });

    return schedules;
  }

  // Get schedules by teacher
  static async getTeacherTimetable(teacherId: string, academicYearId?: string) {
    const where: any = { teacher_id: teacherId, is_active: true };
    if (academicYearId) where.academic_year_id = academicYearId;

    const schedules = await prisma.schedules.findMany({
      where,
      include: {
        class: { select: { name: true } },
        subjects: { select: { name: true, code: true } },
      },
      orderBy: [{ day_of_week: 'asc' }, { start_time: 'asc' }]
    });

    return schedules;
  }
}

export class ScheduleExceptionService {
  // Get exceptions
  static async getExceptions(filters: {
    scheduleId?: string;
    teacherId?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  } = {}) {
    const { scheduleId, teacherId, startDate, endDate, page = 1, limit = 50 } = filters;

    const where: any = {};
    if (scheduleId) where.schedule_id = scheduleId;
    if (teacherId) where.replacement_teacher_id = teacherId;
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }

    const [exceptions, total] = await Promise.all([
      prisma.schedule_exceptions.findMany({
        where,
        include: {
          schedules: { include: { class: true, subjects: true } },
          creator: { select: { id: true, email: true } }
        },
        orderBy: { date: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.schedule_exceptions.count({ where }),
    ]);

    return { exceptions, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  // Get exception by ID
  static async getExceptionById(id: string) {
    const exception = await prisma.schedule_exceptions.findUnique({
      where: { id },
      include: {
        schedules: { include: { class: true, subjects: true } },
        creator: true,
      },
    });

    if (!exception) throw new Error('Schedule exception not found');
    return exception;
  }

  // Create exception
  static async createException(data: z.infer<typeof createExceptionSchema>, createdBy: string) {
    const schedule = await prisma.schedules.findUnique({ where: { id: data.scheduleId } });
    if (!schedule) throw new Error('Schedule not found');

    // Check if replacement teacher exists
    if (data.replacementTeacherId) {
      // const teacher = await prisma.staff.findUnique({ where: { id: data.replacementTeacherId } }); // Model does not exist
      const teacher = await prisma.teachers.findUnique({ where: { id: data.replacementTeacherId } });
      if (!teacher) throw new Error('Replacement teacher not found');

      // Check if replacement teacher is available at that time
      const dayOfWeek = new Date(data.date).getDay() || 7; // Convert to 1-7
      const schedStart = schedule.start_time.toISOString().substring(11, 16);
      const schedEnd = schedule.end_time.toISOString().substring(11, 16);

      const teacherSchedules = await prisma.schedules.findMany({
        where: {
          teacher_id: data.replacementTeacherId,
          academic_year_id: schedule.academic_year_id,
          day_of_week: dayOfWeek,
          is_active: true,
        }
      });

      for (const ts of teacherSchedules) {
        const tsStart = ts.start_time.toISOString().substring(11, 16);
        const tsEnd = ts.end_time.toISOString().substring(11, 16);
        
        if (ScheduleService['timesOverlap'](schedStart, schedEnd, tsStart, tsEnd)) {
          throw new Error('Replacement teacher has a conflict at this time');
        }
      }
    }

    const exceptionData: any = {
      schedule_id: data.scheduleId,
      date: data.date,
      replacement_teacher_id: data.replacementTeacherId || null,
      is_cancelled: data.isCancelled || false,
      reason: data.reason || null,
      created_by: createdBy || null,
    };
    const exception = await prisma.schedule_exceptions.create({
      data: exceptionData,
      include: {
        schedules: { include: { class: true, subjects: true } },
      }
    });

    return exception;
  }

  // Update exception
  static async updateException(id: string, data: z.infer<typeof updateExceptionSchema>) {
    const exception = await prisma.schedule_exceptions.findUnique({ where: { id } });
    if (!exception) throw new Error('Schedule exception not found');

    return await prisma.schedule_exceptions.update({
      where: { id },
      data,
      include: {
        schedules: { include: { class: true, subjects: true } },
      }
    });
  }

  // Delete exception
  static async deleteException(id: string) {
    const exception = await prisma.schedule_exceptions.findUnique({ where: { id } });
    if (!exception) throw new Error('Schedule exception not found');
    await prisma.schedule_exceptions.delete({ where: { id } });
    return { message: 'Schedule exception deleted successfully' };
  }
}

export { createScheduleSchema, updateScheduleSchema, createExceptionSchema, updateExceptionSchema };
