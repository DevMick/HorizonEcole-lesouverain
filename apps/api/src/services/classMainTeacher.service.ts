import { prisma } from '@school/database';
import { z } from 'zod';

const createMainTeacherSchema = z.object({
  academicYearId: z.string().uuid('L\'année académique est obligatoire'),
  teacherId: z.string().uuid('L\'enseignant est obligatoire'),
  classId: z.string().uuid('La classe est obligatoire'),
});

const updateMainTeacherSchema = z.object({
  teacherId: z.string().uuid('L\'enseignant est obligatoire').optional(),
});

export class ClassMainTeacherService {
  /**
   * Get all main teacher assignments
   */
  static async getAll(filters?: {
    academicYearId?: string;
    teacherId?: string;
    classId?: string;
  }) {
    try {
      const where: any = {};

      if (filters?.academicYearId) {
        where.academic_year_id = filters.academicYearId;
      }
      if (filters?.teacherId) {
        where.teacher_id = filters.teacherId;
      }
      if (filters?.classId) {
        where.class_id = filters.classId;
      }

      const mainTeachers = await prisma.class_main_teachers.findMany({
        where,
        include: {
          academicYear: {
            select: {
              id: true,
              name: true,
            },
          },
          teacher: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true,
            },
          },
          class: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: [
          { academic_year_id: 'desc' },
          { created_at: 'desc' },
        ],
      });

      return mainTeachers;
    } catch (error) {
      console.error('Error fetching main teachers:', error);
      throw error;
    }
  }

  /**
   * Get main teacher by ID
   */
  static async getById(id: string) {
    try {
      const mainTeacher = await prisma.class_main_teachers.findUnique({
        where: { id },
        include: {
          academicYear: {
            select: {
              id: true,
              name: true,
            },
          },
          teacher: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true,
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

      if (!mainTeacher) {
        throw new Error('Affectation de professeur principal non trouvée');
      }

      return mainTeacher;
    } catch (error) {
      console.error('Error fetching main teacher:', error);
      throw error;
    }
  }

  /**
   * Get main teacher for a class in a specific academic year
   */
  static async getByClassAndYear(classId: string, academicYearId: string) {
    try {
      const mainTeacher = await prisma.class_main_teachers.findFirst({
        where: {
          class_id: classId,
          academic_year_id: academicYearId,
        },
        include: {
          academicYear: {
            select: {
              id: true,
              name: true,
            },
          },
          teacher: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true,
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

      return mainTeacher;
    } catch (error) {
      console.error('Error fetching main teacher by class and year:', error);
      throw error;
    }
  }

  /**
   * Create a main teacher assignment
   */
  static async create(data: {
    academicYearId: string;
    teacherId: string;
    classId: string;
  }) {
    try {
      // Validate input
      const validatedData = createMainTeacherSchema.parse(data);

      // Verify academic year exists
      const academicYear = await prisma.academicYear.findUnique({
        where: { id: validatedData.academicYearId },
      });

      if (!academicYear) {
        throw new Error('Année académique non trouvée');
      }

      // Verify teacher exists
      const teacher = await prisma.teachers.findUnique({
        where: { id: validatedData.teacherId },
      });

      if (!teacher) {
        throw new Error('Enseignant non trouvé');
      }

      // Verify class exists
      const schoolClass = await prisma.schoolClass.findUnique({
        where: { id: validatedData.classId },
      });

      if (!schoolClass) {
        throw new Error('Classe non trouvée');
      }

      // Check if teacher is already main teacher for another class in this academic year
      const existingTeacherAssignment = await prisma.class_main_teachers.findFirst({
        where: {
          teacher_id: validatedData.teacherId,
          academic_year_id: validatedData.academicYearId,
        },
      });

      if (existingTeacherAssignment) {
        throw new Error('Cet enseignant est déjà professeur principal d\'une autre classe pour cette année académique');
      }

      // Check if class already has a main teacher for this academic year
      const existingClassAssignment = await prisma.class_main_teachers.findFirst({
        where: {
          class_id: validatedData.classId,
          academic_year_id: validatedData.academicYearId,
        },
      });

      if (existingClassAssignment) {
        // Update existing assignment
        const updated = await prisma.class_main_teachers.update({
          where: { id: existingClassAssignment.id },
          data: {
            teacher_id: validatedData.teacherId,
          },
          include: {
            academicYear: {
              select: {
                id: true,
                name: true,
              },
            },
            teacher: {
              select: {
                id: true,
                first_name: true,
                last_name: true,
                email: true,
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

        return updated;
      }

      // Create new assignment
      const mainTeacher = await prisma.class_main_teachers.create({
        data: {
          academic_year_id: validatedData.academicYearId,
          teacher_id: validatedData.teacherId,
          class_id: validatedData.classId,
        },
        include: {
          academicYear: {
            select: {
              id: true,
              name: true,
            },
          },
          teacher: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true,
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

      return mainTeacher;
    } catch (error) {
      console.error('Error creating main teacher assignment:', error);
      throw error;
    }
  }

  /**
   * Update a main teacher assignment
   */
  static async update(id: string, data: { teacherId?: string }) {
    try {
      const validatedData = updateMainTeacherSchema.parse(data);

      // Check if assignment exists
      const existing = await prisma.class_main_teachers.findUnique({
        where: { id },
      });

      if (!existing) {
        throw new Error('Affectation de professeur principal non trouvée');
      }

      // If updating teacher, check constraints
      if (validatedData.teacherId) {
        // Check if new teacher is already main teacher for another class in this academic year
        const existingTeacherAssignment = await prisma.class_main_teachers.findFirst({
          where: {
            teacher_id: validatedData.teacherId,
            academic_year_id: existing.academic_year_id,
            id: { not: id },
          },
        });

        if (existingTeacherAssignment) {
          throw new Error('Cet enseignant est déjà professeur principal d\'une autre classe pour cette année académique');
        }

        // Verify teacher exists
        const teacher = await prisma.teachers.findUnique({
          where: { id: validatedData.teacherId },
        });

        if (!teacher) {
          throw new Error('Enseignant non trouvé');
        }
      }

      const updated = await prisma.class_main_teachers.update({
        where: { id },
        data: validatedData.teacherId ? { teacher_id: validatedData.teacherId } : {},
        include: {
          academicYear: {
            select: {
              id: true,
              name: true,
            },
          },
          teacher: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true,
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

      return updated;
    } catch (error) {
      console.error('Error updating main teacher assignment:', error);
      throw error;
    }
  }

  /**
   * Delete a main teacher assignment
   */
  static async delete(id: string) {
    try {
      const mainTeacher = await prisma.class_main_teachers.findUnique({
        where: { id },
      });

      if (!mainTeacher) {
        throw new Error('Affectation de professeur principal non trouvée');
      }

      await prisma.class_main_teachers.delete({
        where: { id },
      });

      return { success: true };
    } catch (error) {
      console.error('Error deleting main teacher assignment:', error);
      throw error;
    }
  }
}

