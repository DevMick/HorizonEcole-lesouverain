import { prisma } from '@school/database';
import crypto from 'crypto';

export class GradeService {
  /**
   * Get all grades with filters
   */
  static async getAll(filters?: {
    academicYearId?: string;
    teacherId?: string;
    subjectId?: string;
    semesterId?: string;
    studentId?: string;
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
      if (filters?.subjectId) {
        where.subject_id = filters.subjectId;
      }
      if (filters?.semesterId) {
        where.semester_id = filters.semesterId;
      }
      if (filters?.studentId) {
        where.student_id = filters.studentId;
      }
      if (filters?.classId) {
        where.student = {
          classId: filters.classId,
        };
      }

      const grades = await prisma.grades.findMany({
        where,
        include: {
          academicYear: true,
          teacher: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
            },
          },
          subject: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          semester: true,
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
          evaluationType: {
            select: {
              id: true,
              name: true,
              coefficient: true,
            },
          },
        },
        orderBy: [
          { created_at: 'desc' },
        ],
      });
      
      return grades;
    } catch (error) {
      console.error('Error in getAll grades:', error);
      throw error;
    }
  }

  /**
   * Get grade by ID
   */
  static async getById(id: string) {
    return await prisma.grades.findUnique({
      where: { id },
      include: {
        academicYear: true,
        teacher: true,
        subject: true,
        semester: true,
        student: {
          include: {
            class: true,
          },
        },
        class: true,
        evaluationType: {
          select: {
            id: true,
            name: true,
            coefficient: true,
          },
        },
      },
    });
  }

  /**
   * Get teacher's assignments for a specific academic year
   */
  static async getTeacherAssignments(teacherId: string, academicYearId: string) {
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
        subject: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
      orderBy: [
        { class: { name: 'asc' } },
        { subject: { name: 'asc' } },
      ],
    });

    return assignments;
  }

  /**
   * Create grade
   */
  static async create(data: {
    academicYearId: string;
    teacherId: string;
    subjectId: string;
    semesterId: string;
    studentId: string;
    classId: string;
    evaluationTypeId: string;
    note: number;
    maxNote: number;
  }) {
    // Check if evaluation type exists and belongs to the teacher
    const evaluationType = await prisma.evaluation_types.findUnique({
      where: { id: data.evaluationTypeId },
    });
    if (!evaluationType) {
      throw new Error('Type d\'évaluation non trouvé');
    }
    if (evaluationType.teacher_id !== data.teacherId) {
      throw new Error('Le type d\'évaluation n\'appartient pas à cet enseignant');
    }

    // Validate note
    if (data.note < 0 || data.note > data.maxNote) {
      throw new Error(`La note doit être entre 0 et ${data.maxNote}`);
    }

    // Validate maxNote (must be 10 or 20)
    if (data.maxNote !== 10 && data.maxNote !== 20) {
      throw new Error('La note maximale doit être 10 ou 20');
    }

    // Check if academic year exists
    const academicYear = await prisma.academicYear.findUnique({
      where: { id: data.academicYearId },
    });
    if (!academicYear) {
      throw new Error('Année académique non trouvée');
    }

    // Check if teacher exists
    const teacher = await prisma.teachers.findUnique({
      where: { id: data.teacherId },
    });
    if (!teacher) {
      throw new Error('Enseignant non trouvé');
    }

    // Check if subject exists
    const subject = await prisma.subjects.findUnique({
      where: { id: data.subjectId },
    });
    if (!subject) {
      throw new Error('Matière non trouvée');
    }

    // Check if semester exists and belongs to the academic year
    const semester = await prisma.semesters.findUnique({
      where: { id: data.semesterId },
    });
    if (!semester) {
      throw new Error('Trimestre non trouvé');
    }
    if (semester.academic_year_id !== data.academicYearId) {
      throw new Error('Le trimestre n\'appartient pas à cette année académique');
    }

    // Check if student exists
    const student = await prisma.student.findUnique({
      where: { id: data.studentId },
    });
    if (!student) {
      throw new Error('Élève non trouvé');
    }

    // Verify that the student's class matches the provided classId
    if (student.classId !== data.classId) {
      throw new Error('L\'élève n\'appartient pas à cette classe');
    }

    // Check if class exists
    const classExists = await prisma.schoolClass.findUnique({
      where: { id: data.classId },
    });
    if (!classExists) {
      throw new Error('Classe non trouvée');
    }

    // Verify that teacher is assigned to this subject and class for this academic year
    const assignment = await prisma.teacher_class_assignments.findFirst({
      where: {
        teacher_id: data.teacherId,
        subject_id: data.subjectId,
        class_id: data.classId,
        academic_year_id: data.academicYearId,
      },
    });
    if (!assignment) {
      throw new Error('L\'enseignant n\'est pas affecté à cette matière et cette classe pour cette année académique');
    }

    // Generate UUID for the grade ID
    const id = crypto.randomUUID();
    
    // Create the new grade
    const newGrade = await prisma.grades.create({
      data: {
        id,
        academic_year_id: data.academicYearId,
        teacher_id: data.teacherId,
        subject_id: data.subjectId,
        semester_id: data.semesterId,
        student_id: data.studentId,
        class_id: data.classId,
        evaluation_type_id: data.evaluationTypeId,
        note: data.note,
        max_note: data.maxNote,
      },
      include: {
        academicYear: true,
        teacher: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
          },
        },
        subject: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        semester: true,
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
      },
    });

    return newGrade;
  }

  /**
   * Update grade
   */
  static async update(id: string, data: {
    note?: number;
    maxNote?: number;
    semesterId?: string;
    evaluationTypeId?: string;
  }) {
    const grade = await prisma.grades.findUnique({
      where: { id },
    });

    if (!grade) {
      throw new Error('Note non trouvée');
    }

    const updateData: any = {};
    
    if (data.evaluationTypeId !== undefined) {
      // Check if evaluation type exists and belongs to the teacher
      const evaluationType = await prisma.evaluation_types.findUnique({
        where: { id: data.evaluationTypeId },
      });
      if (!evaluationType) {
        throw new Error('Type d\'évaluation non trouvé');
      }
      if (evaluationType.teacher_id !== grade.teacher_id) {
        throw new Error('Le type d\'évaluation n\'appartient pas à cet enseignant');
      }
      updateData.evaluation_type_id = data.evaluationTypeId;
    }
    
    if (data.note !== undefined) {
      const maxNote = data.maxNote || grade.max_note;
      if (data.note < 0 || data.note > maxNote) {
        throw new Error(`La note doit être entre 0 et ${maxNote}`);
      }
      updateData.note = data.note;
    }
    
    if (data.maxNote !== undefined) {
      if (data.maxNote !== 10 && data.maxNote !== 20) {
        throw new Error('La note maximale doit être 10 ou 20');
      }
      updateData.max_note = data.maxNote;
      
      // If note is being updated, validate it against new maxNote
      if (data.note === undefined && data.maxNote !== undefined && Number(grade.note) > data.maxNote) {
        throw new Error(`La note actuelle (${grade.note}) dépasse la nouvelle note maximale (${data.maxNote})`);
      }
    }
    
    if (data.semesterId !== undefined) {
      // Check if semester exists and belongs to the same academic year
      const semester = await prisma.semesters.findUnique({
        where: { id: data.semesterId },
      });
      if (!semester) {
        throw new Error('Trimestre non trouvé');
      }
      if (semester.academic_year_id !== grade.academic_year_id) {
        throw new Error('Le trimestre n\'appartient pas à la même année académique');
      }
      updateData.semester_id = data.semesterId;
    }

    return await prisma.grades.update({
      where: { id },
      data: updateData,
      include: {
        academicYear: true,
        teacher: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
          },
        },
        subject: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        semester: true,
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
        evaluationType: {
          select: {
            id: true,
            name: true,
            coefficient: true,
          },
        },
      },
    });
  }

  /**
   * Delete grade
   */
  static async delete(id: string) {
    const grade = await prisma.grades.findUnique({
      where: { id },
    });

    if (!grade) {
      throw new Error('Note non trouvée');
    }

    await prisma.grades.delete({
      where: { id },
    });

    return { message: 'Note supprimée avec succès' };
  }
}
