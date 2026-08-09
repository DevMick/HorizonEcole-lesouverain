import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import crypto from 'crypto';

const prisma = new PrismaClient();

// Validation schemas
const attendanceItemSchema = z.object({
  studentId: z.string().uuid(),
  status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']),
  excuse: z.string().optional(),
  isJustified: z.boolean().optional().default(false),
});

const batchAttendanceSchema = z.object({
  classId: z.string().uuid(),
  date: z.string().transform(str => new Date(str)),
  period: z.enum(['MORNING', 'AFTERNOON']),
  attendances: z.array(attendanceItemSchema),
});

export class AttendanceService {
  // Record attendance in batch (idempotent)
  static async recordBatchAttendance(data: z.infer<typeof batchAttendanceSchema>, recordedBy: string) {
    const { classId, date, period, attendances } = data;

    // Verify class exists
    const classExists = await prisma.schoolClass.findUnique({
      where: { id: classId },
      include: { students: true }
    });

    if (!classExists) throw new Error('Class not found');

    const results = [];
    const errors = [];

    // Process each attendance (idempotent by studentId, date, period)
    for (const attendance of attendances) {
      try {
        // Check if student belongs to this class
        const studentInClass = classExists.students.some(s => s.id === attendance.studentId);
        if (!studentInClass) {
          errors.push({
            studentId: attendance.studentId,
            error: 'Student not in this class',
          });
          continue;
        }

        // Upsert attendance (idempotent)
        const record = await prisma.attendances.upsert({
          where: {
            student_id_date_period: {
              student_id: attendance.studentId,
              date,
              period,
            }
          },
          update: {
            status: attendance.status,
            excuse: attendance.excuse,
            is_justified: attendance.isJustified,
          },
          create: {
            id: crypto.randomUUID(),
            student: { connect: { id: attendance.studentId } },
            class: { connect: { id: classId } },
            date,
            period,
            status: attendance.status,
            excuse: attendance.excuse,
            is_justified: attendance.isJustified,
            recordedBy: { connect: { id: recordedBy } },
          },
          include: {
            student: { select: { id: true, firstName: true, lastName: true } }
          }
        });

        results.push(record);
      } catch (error) {
        errors.push({
          studentId: attendance.studentId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Update summaries for affected students
    const month = date.getMonth() + 1;
    const year = date.getFullYear();

    for (const result of results) {
      await this.updateAttendanceSummary(result.studentId, month, year);
    }

    return {
      success: results,
      errors,
      summary: {
        total: attendances.length,
        successful: results.length,
        failed: errors.length,
      },
    };
  }

  // Get attendances with filters
  static async getAttendances(filters: {
    classId?: string;
    studentId?: string;
    date?: string;
    period?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  } = {}) {
    const { classId, studentId, date, period, status, startDate, endDate, page = 1, limit = 100 } = filters;

    const where: any = {};
    if (classId) where.classId = classId;
    if (studentId) where.student_id = studentId;
    if (period) where.period = period;
    if (status) where.status = status;

    if (date) {
      where.date = new Date(date);
    } else if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }

    const [attendances, total] = await Promise.all([
      prisma.attendances.findMany({
        where,
        include: {
          student: { select: { id: true, firstName: true, lastName: true } },
          class: { select: { id: true, name: true } },
          recordedBy: { select: { id: true, email: true } }
        },
        orderBy: [{ date: 'desc' }, { period: 'asc' }, { student: { lastName: 'asc' } }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.attendances.count({ where }),
    ]);

    return { attendances, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  // Get attendance by class and date
  static async getClassAttendance(classId: string, date: string, period?: string) {
    const where: any = {
      classId,
      date: new Date(date),
    };

    if (period) {
      where.period = period;
    }

    const attendances = await prisma.attendances.findMany({
      where,
      include: {
        student: { select: { id: true, firstName: true, lastName: true } }
      },
      orderBy: { student: { lastName: 'asc' } }
    });

    return attendances;
  }

  // Update or create attendance summary for a student/month
  static async updateAttendanceSummary(studentId: string, month: number, year: number) {
    // Get all attendances for this student/month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    // Union du legacy (appel demi-journée) et des présences par séance de cours.
    const [legacy, sessionRecords] = await Promise.all([
      prisma.attendances.findMany({
        where: {
          student_id: studentId,
          date: { gte: startDate, lte: endDate },
        },
        select: { status: true, is_justified: true },
      }),
      prisma.attendance_records.findMany({
        where: {
          student_id: studentId,
          session: { date: { gte: startDate, lte: endDate } },
        },
        select: { status: true, is_justified: true },
      }),
    ]);

    const attendances = [...legacy, ...sessionRecords];

    // Calculate counts
    const totalDays = attendances.length;
    const presentDays = attendances.filter(a => a.status === 'PRESENT').length;
    const absentDays = attendances.filter(a => a.status === 'ABSENT').length;
    const lateDays = attendances.filter(a => a.status === 'LATE').length;
    const excusedDays = attendances.filter(a => a.status === 'EXCUSED' || a.is_justified).length;
    const attendanceRate = totalDays > 0 ? Math.round((presentDays / totalDays) * 10000) / 100 : 0;

    // Upsert summary
    const summary = await prisma.attendance_summaries.upsert({
      where: {
        student_id_month_year: {
          student_id: studentId,
          month,
          year,
        }
      },
      update: {
        total_days: totalDays,
        present_days: presentDays,
        absent_days: absentDays,
        late_days: lateDays,
        excused_days: excusedDays,
        attendance_rate: attendanceRate,
      },
      create: {
        id: crypto.randomUUID(),
        student: { connect: { id: studentId } },
        month,
        year,
        total_days: totalDays,
        present_days: presentDays,
        absent_days: absentDays,
        late_days: lateDays,
        excused_days: excusedDays,
        attendance_rate: attendanceRate,
      },
      include: {
        student: { select: { id: true, firstName: true, lastName: true } }
      }
    });

    return summary;
  }

  // Get attendance summaries
  static async getAttendanceSummaries(filters: {
    studentId?: string;
    month?: number;
    year?: number;
    page?: number;
    limit?: number;
  } = {}) {
    const { studentId, month, year, page = 1, limit = 50 } = filters;

    const where: any = {};
    if (studentId) where.student_id = studentId;
    if (month) where.month = month;
    if (year) where.year = year;

    const [summaries, total] = await Promise.all([
      prisma.attendance_summaries.findMany({
        where,
        include: {
          student: { select: { id: true, firstName: true, lastName: true } }
        },
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.attendance_summaries.count({ where }),
    ]);

    return { summaries, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  // Get summary by student and month
  static async getStudentMonthlySummary(studentId: string, month: number, year: number) {
    const summary = await prisma.attendance_summaries.findUnique({
      where: {
        student_id_month_year: {
          student_id: studentId,
          month,
          year,
        }
      },
      include: {
        student: true,
      }
    });

    return summary;
  }

  // Get attendance statistics
  static async getAttendanceStats(filters: {
    classId?: string;
    startDate?: string;
    endDate?: string;
  } = {}) {
    const where: any = {};

    if (filters.classId) where.classId = filters.classId;
    if (filters.startDate || filters.endDate) {
      where.date = {};
      if (filters.startDate) where.date.gte = new Date(filters.startDate);
      if (filters.endDate) where.date.lte = new Date(filters.endDate);
    }

    const [
      totalRecords,
      byStatus,
      recentAbsences,
    ] = await Promise.all([
      prisma.attendances.count({ where }),
      prisma.attendances.groupBy({
        by: ['status'],
        where,
        _count: true,
      }),
      prisma.attendances.findMany({
        where: {
          ...where,
          status: { in: ['ABSENT', 'LATE'] }
        },
        include: {
          student: { select: { firstName: true, lastName: true } },
          class: { select: { name: true } }
        },
        orderBy: { date: 'desc' },
        take: 10,
      }),
    ]);

    return {
      totalRecords,
      attendanceByStatus: byStatus,
      recentAbsences,
    };
  }

  // Delete attendance
  static async deleteAttendance(id: string) {
    const attendance = await prisma.attendances.findUnique({ where: { id } });
    if (!attendance) throw new Error('Attendance record not found');
    
    const month = attendance.date.getMonth() + 1;
    const year = attendance.date.getFullYear();
    
    await prisma.attendances.delete({ where: { id } });
    
    // Update summary
    await this.updateAttendanceSummary(attendance.student_id, month, year);
    
    return { message: 'Attendance record deleted successfully' };
  }
}

export { batchAttendanceSchema, attendanceItemSchema };
