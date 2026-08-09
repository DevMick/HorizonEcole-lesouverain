import { z } from 'zod';
import { prisma } from '@school/database';
import { randomUUID } from 'crypto';

const createAssignmentSchema = z.object({
  teacherId: z.string().uuid(),
  assignments: z.array(z.object({
    classId: z.string().uuid(),
    subjectIds: z.array(z.string().uuid()).min(1, 'Au moins une matière doit être sélectionnée'),
  })).min(1, 'Au moins une affectation doit être définie'),
  academicYearId: z.string().uuid(),
});

const updateAssignmentSchema = z.object({
  assignments: z.array(z.object({
    classId: z.string().uuid(),
    subjectIds: z.array(z.string().uuid()).min(1, 'Au moins une matière doit être sélectionnée'),
  })).min(1, 'Au moins une affectation doit être définie'),
  academicYearId: z.string().uuid(),
});

export class ClassAssignmentService {
  /**
   * Get all assignments with teachers and classes
   */
  static async getAll(filters: {
    teacherId?: string;
    classId?: string;
    academicYearId?: string;
    page?: number;
    limit?: number;
    search?: string;
  } = {}) {
    const {
      teacherId,
      classId,
      academicYearId,
      page = 1,
      limit = 50,
      search,
    } = filters;

    const where: any = {};

    if (teacherId) {
      where.teacher_id = teacherId;
    }

    if (classId) {
      where.class_id = classId;
    }

    if (academicYearId) {
      where.academic_year_id = academicYearId;
    }

    const [assignments, total] = await Promise.all([
      prisma.teacher_class_assignments.findMany({
        where,
        include: {
          teacher: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true,
              phone: true,
              contract_type: true,
              specialties: true,
            },
          },
          class: {
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
        },
        orderBy: {
          created_at: 'desc',
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.teacher_class_assignments.count({ where }),
    ]);

    // If search is provided, filter by teacher name
    let filteredAssignments = assignments;
    if (search) {
      const searchLower = search.toLowerCase();
      filteredAssignments = assignments.filter(
        (assignment) =>
          assignment.teacher.first_name.toLowerCase().includes(searchLower) ||
          assignment.teacher.last_name.toLowerCase().includes(searchLower) ||
          assignment.teacher.email.toLowerCase().includes(searchLower) ||
          assignment.class.name.toLowerCase().includes(searchLower) ||
          assignment.subject?.name.toLowerCase().includes(searchLower) ||
          assignment.subject?.code.toLowerCase().includes(searchLower)
      );
    }

    return {
      assignments: filteredAssignments,
      pagination: {
        page,
        limit,
        total: search ? filteredAssignments.length : total,
        totalPages: Math.ceil((search ? filteredAssignments.length : total) / limit),
      },
    };
  }

  /**
   * Get assignments by teacher ID
   */
  static async getByTeacherId(teacherId: string, academicYearId?: string) {
    const where: any = { teacher_id: teacherId };
    if (academicYearId) {
      where.academic_year_id = academicYearId;
    }
    
    return prisma.teacher_class_assignments.findMany({
      where,
      include: {
        class: {
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
        academic_year: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  /**
   * Get assignments by class ID
   */
  static async getByClassId(classId: string, academicYearId?: string) {
    const where: any = { class_id: classId };
    if (academicYearId) {
      where.academic_year_id = academicYearId;
    }
    
    return prisma.teacher_class_assignments.findMany({
      where,
      include: {
        teacher: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
            phone: true,
            contract_type: true,
            specialties: true,
          },
        },
        academic_year: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  /**
   * Get all teachers with their assigned classes for a specific academic year
   */
  static async getTeachersWithClasses(filters: {
    academicYearId?: string;
    page?: number;
    limit?: number;
    search?: string;
  } = {}) {
    const {
      academicYearId,
      page = 1,
      limit = 50,
      search,
    } = filters;

    // Get current academic year if not provided
    let yearId = academicYearId;
    if (!yearId) {
      const currentYear = await prisma.academicYear.findFirst({
        where: { isCurrent: true },
      });
      if (!currentYear) {
        throw new Error('Aucune année académique en cours trouvée');
      }
      yearId = currentYear.id;
    }

    const where: any = {};

    if (search) {
      where.OR = [
        { first_name: { contains: search, mode: 'insensitive' } },
        { last_name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [teachers, total] = await Promise.all([
      prisma.teachers.findMany({
        where,
        include: {
          class_assignments: {
            where: {
              academic_year_id: yearId,
            },
            include: {
              class: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: {
          created_at: 'desc',
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.teachers.count({ where }),
    ]);

    // Get all subject IDs from assignments
    const allSubjectIds = new Set<string>();
    teachers.forEach((teacher) => {
      teacher.class_assignments.forEach((assignment) => {
        if (assignment.subject_id) {
          allSubjectIds.add(assignment.subject_id);
        }
      });
    });

    // Fetch all subjects
    const subjects = await prisma.subjects.findMany({
      where: {
        id: {
          in: Array.from(allSubjectIds),
        },
      },
      select: {
        id: true,
        name: true,
        code: true,
      },
    });

    // Create a map for quick lookup
    const subjectMap = new Map(subjects.map((s) => [s.id, s]));

    // Group assignments by class and subject
    const teachersWithAssignments = teachers.map((teacher) => {
      // Group by class
      const classMap = new Map();
      teacher.class_assignments.forEach((assignment) => {
        const classId = assignment.class.id;
        if (!classMap.has(classId)) {
          classMap.set(classId, {
            class: assignment.class,
            subjects: [],
          });
        }
        if (assignment.subject_id && subjectMap.has(assignment.subject_id)) {
          const subject = subjectMap.get(assignment.subject_id);
          if (subject && !classMap.get(classId).subjects.find((s: any) => s.id === subject.id)) {
            classMap.get(classId).subjects.push(subject);
          }
        }
      });

      return {
        ...teacher,
        assignments: Array.from(classMap.values()),
      };
    });

    return {
      teachers: teachersWithAssignments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Create assignments for a teacher
   */
  static async createAssignments(teacherId: string, assignments: Array<{ classId: string; subjectIds: string[] }>, academicYearId: string) {
    // Verify teacher exists
    const teacher = await prisma.teachers.findUnique({
      where: { id: teacherId },
    });

    if (!teacher) {
      throw new Error('Enseignant non trouvé');
    }

    // Verify academic year exists
    const academicYear = await prisma.academicYear.findUnique({
      where: { id: academicYearId },
    });

    if (!academicYear) {
      throw new Error('Année académique non trouvée');
    }

    // Collect all class and subject IDs
    const classIds = [...new Set(assignments.map(a => a.classId))];
    const subjectIds = [...new Set(assignments.flatMap(a => a.subjectIds))];

    // Verify all classes exist
    const classes = await prisma.schoolClass.findMany({
      where: {
        id: {
          in: classIds,
        },
      },
    });

    if (classes.length !== classIds.length) {
      throw new Error('Une ou plusieurs classes n\'existent pas');
    }

    // Verify all subjects exist
    const subjects = await prisma.subjects.findMany({
      where: {
        id: {
          in: subjectIds,
        },
      },
    });

    if (subjects.length !== subjectIds.length) {
      throw new Error('Une ou plusieurs matières n\'existent pas');
    }

    // Get existing assignments for this academic year
    const existingAssignments = await prisma.teacher_class_assignments.findMany({
      where: {
        teacher_id: teacherId,
        academic_year_id: academicYearId,
      },
    });

    const existingKeys = new Set(
      existingAssignments.map(a => `${a.class_id}-${a.subject_id}`)
    );

    // Prepare new assignments
    const newAssignments: Array<{
      id: string;
      teacher_id: string;
      class_id: string;
      subject_id: string;
      academic_year_id: string;
    }> = [];

    assignments.forEach((assignment) => {
      assignment.subjectIds.forEach((subjectId) => {
        const key = `${assignment.classId}-${subjectId}`;
        if (!existingKeys.has(key)) {
          newAssignments.push({
            id: randomUUID(),
            teacher_id: teacherId,
            class_id: assignment.classId,
            subject_id: subjectId,
            academic_year_id: academicYearId,
          });
        }
      });
    });

    // Create new assignments
    if (newAssignments.length > 0) {
      await prisma.teacher_class_assignments.createMany({
        data: newAssignments,
      });
    }

    // Return all assignments for this teacher and academic year
    return this.getByTeacherId(teacherId, academicYearId);
  }

  /**
   * Update assignments for a teacher (replace all for a specific academic year)
   */
  static async updateAssignments(teacherId: string, assignments: Array<{ classId: string; subjectIds: string[] }>, academicYearId: string) {
    // Verify teacher exists
    const teacher = await prisma.teachers.findUnique({
      where: { id: teacherId },
    });

    if (!teacher) {
      throw new Error('Enseignant non trouvé');
    }

    // Verify academic year exists
    const academicYear = await prisma.academicYear.findUnique({
      where: { id: academicYearId },
    });

    if (!academicYear) {
      throw new Error('Année académique non trouvée');
    }

    // Collect all class and subject IDs
    const classIds = [...new Set(assignments.map(a => a.classId))];
    const subjectIds = [...new Set(assignments.flatMap(a => a.subjectIds))];

    // Verify all classes exist
    const classes = await prisma.schoolClass.findMany({
      where: {
        id: {
          in: classIds,
        },
      },
    });

    if (classes.length !== classIds.length) {
      throw new Error('Une ou plusieurs classes n\'existent pas');
    }

    // Verify all subjects exist
    const subjects = await prisma.subjects.findMany({
      where: {
        id: {
          in: subjectIds,
        },
      },
    });

    if (subjects.length !== subjectIds.length) {
      throw new Error('Une ou plusieurs matières n\'existent pas');
    }

    // Delete all existing assignments for this teacher and academic year
    await prisma.teacher_class_assignments.deleteMany({
      where: { 
        teacher_id: teacherId,
        academic_year_id: academicYearId,
      },
    });

    // Create new assignments
    const newAssignments: Array<{
      id: string;
      teacher_id: string;
      class_id: string;
      subject_id: string;
      academic_year_id: string;
    }> = [];

    assignments.forEach((assignment) => {
      assignment.subjectIds.forEach((subjectId) => {
        newAssignments.push({
          id: randomUUID(),
          teacher_id: teacherId,
          class_id: assignment.classId,
          subject_id: subjectId,
          academic_year_id: academicYearId,
        });
      });
    });

    if (newAssignments.length > 0) {
      await prisma.teacher_class_assignments.createMany({
        data: newAssignments,
      });
    }

    // Return all assignments for this teacher and academic year
    return this.getByTeacherId(teacherId, academicYearId);
  }

  /**
   * Delete an assignment
   */
  static async deleteAssignment(assignmentId: string) {
    const assignment = await prisma.teacher_class_assignments.findUnique({
      where: { id: assignmentId },
    });

    if (!assignment) {
      throw new Error('Affectation non trouvée');
    }

    await prisma.teacher_class_assignments.delete({
      where: { id: assignmentId },
    });

    return { success: true };
  }

  /**
   * Delete all assignments for a teacher
   */
  static async deleteAllByTeacher(teacherId: string) {
    await prisma.teacher_class_assignments.deleteMany({
      where: { teacher_id: teacherId },
    });

    return { success: true };
  }
}

export { createAssignmentSchema, updateAssignmentSchema };

