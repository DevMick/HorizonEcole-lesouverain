import { prisma } from '@school/database';

export class StudentAbsenceService {
  /**
   * Get all student absences with filters
   */
  static async getAll(filters?: {
    academicYearId?: string;
    teacherId?: string;
    studentId?: string;
    subjectId?: string;
    semesterId?: string;
    date?: string;
    classId?: string;
  }) {
    const where: any = {};

    if (filters?.academicYearId) {
      where.academic_year_id = filters.academicYearId;
    }
    if (filters?.teacherId) {
      where.teacher_id = filters.teacherId;
    }
    if (filters?.studentId) {
      where.student_id = filters.studentId;
    }
    if (filters?.subjectId) {
      where.subject_id = filters.subjectId;
    }
    if (filters?.semesterId) {
      where.semester_id = filters.semesterId;
    }
    if (filters?.date) {
      where.date = new Date(filters.date);
    }
    if (filters?.classId) {
      // Filter by class_id directly
      where.class_id = filters.classId;
    }

    const absences = await prisma.student_absences.findMany({
      where,
      include: {
        academicYear: {
          select: {
            id: true,
            name: true,
          },
        },
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            studentNumber: true,
            class: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        class: {
          select: {
            id: true,
            name: true,
          },
        },
        semester: {
          select: {
            id: true,
            name: true,
          },
        },
        subject: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        teacher: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
          },
        },
      },
      orderBy: [
        { date: 'desc' },
        { created_at: 'desc' },
      ],
    });

    return absences;
  }

  /**
   * Get absence by ID
   */
  static async getById(id: string) {
    const absence = await prisma.student_absences.findUnique({
      where: { id },
      include: {
        academicYear: true,
        student: {
          include: {
            class: true,
          },
        },
        semester: true,
        subject: true,
        teacher: true,
      },
    });

    if (!absence) {
      throw new Error('Absence not found');
    }

    return absence;
  }

  /**
   * Create a new absence
   */
  static async create(data: {
    academicYearId: string;
    studentId: string;
    semesterId: string;
    subjectId: string;
    teacherId: string;
    hoursAbsent: number;
    date: string;
  }) {
    // Validate that student belongs to a class
    const student = await prisma.student.findUnique({
      where: { id: data.studentId },
      include: { class: true },
    });

    if (!student) {
      throw new Error('Student not found');
    }

    if (!student.classId) {
      throw new Error('Student is not assigned to a class');
    }

    // Validate that teacher is assigned to this class/subject
    const assignment = await prisma.teacher_class_assignments.findFirst({
      where: {
        teacher_id: data.teacherId,
        class_id: student.classId,
        subject_id: data.subjectId,
        academic_year_id: data.academicYearId,
      },
    });

    if (!assignment) {
      throw new Error('Teacher is not assigned to this class/subject');
    }

    // Validate hours_absent is positive
    if (data.hoursAbsent <= 0) {
      throw new Error('Hours absent must be greater than 0');
    }

    const absence = await prisma.student_absences.create({
      data: {
        academic_year_id: data.academicYearId,
        student_id: data.studentId,
        class_id: student.classId,
        semester_id: data.semesterId,
        subject_id: data.subjectId,
        teacher_id: data.teacherId,
        hours_absent: data.hoursAbsent,
        date: new Date(data.date),
      },
      include: {
        academicYear: true,
        student: {
          include: {
            class: true,
          },
        },
        semester: true,
        subject: true,
        teacher: true,
      },
    });

    return absence;
  }

  /**
   * Update an absence
   */
  static async update(id: string, data: {
    hoursAbsent?: number;
    date?: string;
  }) {
    const absence = await prisma.student_absences.findUnique({
      where: { id },
    });

    if (!absence) {
      throw new Error('Absence not found');
    }

    const updateData: any = {};
    if (data.hoursAbsent !== undefined) {
      if (data.hoursAbsent <= 0) {
        throw new Error('Hours absent must be greater than 0');
      }
      updateData.hours_absent = data.hoursAbsent;
    }
    if (data.date) {
      updateData.date = new Date(data.date);
    }

    const updatedAbsence = await prisma.student_absences.update({
      where: { id },
      data: updateData,
      include: {
        academicYear: true,
        student: {
          include: {
            class: true,
          },
        },
        semester: true,
        subject: true,
        teacher: true,
      },
    });

    return updatedAbsence;
  }

  /**
   * Delete an absence
   */
  static async delete(id: string) {
    const absence = await prisma.student_absences.findUnique({
      where: { id },
    });

    if (!absence) {
      throw new Error('Absence not found');
    }

    await prisma.student_absences.delete({
      where: { id },
    });

    return { success: true };
  }

  /**
   * Get classes for a teacher (from assignments)
   */
  static async getTeacherClasses(teacherId: string, academicYearId: string) {
    const assignments = await prisma.teacher_class_assignments.findMany({
      where: {
        teacher_id: teacherId,
        academic_year_id: academicYearId,
      },
      include: {
        class: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      distinct: ['class_id'],
    });

    return assignments.map((assignment) => assignment.class);
  }

  /**
   * Get timetable for a teacher's class/subject
   */
  static async getTeacherTimetableForClass(
    teacherId: string,
    classId: string,
    subjectId: string,
    academicYearId: string
  ) {
    const timetables = await prisma.class_timetables.findMany({
      where: {
        teacher_id: teacherId,
        class_id: classId,
        subject_id: subjectId,
        academic_year_id: academicYearId,
      },
      include: {
        subject: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        class: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return timetables;
  }
}

