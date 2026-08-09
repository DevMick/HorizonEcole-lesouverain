import { randomUUID } from 'crypto';
import { prisma } from '@school/database';

export class CoefficientService {
  /**
   * Get all subjects for a class with their coefficients
   */
  static async getClassSubjectsWithCoefficients(classId: string) {
    // Get all class_subjects records for this class
    const classSubjects = await prisma.class_subjects.findMany({
      where: { 
        class_id: classId,
      },
    });

    console.log(`[CoefficientService] Found ${classSubjects.length} class_subjects records for class ${classId}`);

    if (classSubjects.length === 0) {
      return [];
    }

    // Get all unique subject IDs
    const subjectIds = [...new Set(classSubjects.map(cs => cs.subject_id))];
    
    // Fetch all subjects in one query
    const subjects = await prisma.subjects.findMany({
      where: {
        id: {
          in: subjectIds,
        },
      },
      select: {
        id: true,
        name: true,
        code: true,
      },
    });

    console.log(`[CoefficientService] Found ${subjects.length} subjects for ${subjectIds.length} subject IDs`);

    // Create a map for quick lookup
    const subjectMap = new Map(subjects.map(s => [s.id, s]));

    // Transform data to match frontend expectations
    // Filter out any records where the subject doesn't exist (orphaned records)
    const validClassSubjects = classSubjects.filter(cs => {
      if (!subjectMap.has(cs.subject_id)) {
        console.warn(`[CoefficientService] Found orphaned class_subject record: id=${cs.id}, subject_id=${cs.subject_id}`);
        return false;
      }
      return true;
    });
    
    console.log(`[CoefficientService] Returning ${validClassSubjects.length} valid class_subjects`);

    // Map and sort by subject name
    const result = validClassSubjects.map(cs => {
      const subject = subjectMap.get(cs.subject_id)!;
      return {
        id: cs.id,
        classId: cs.class_id,
        subjectId: cs.subject_id,
        coefficient: cs.coefficient,
        hoursPerWeek: cs.hours_per_week,
        teacherId: cs.teacher_id,
        subject: subject,
        teacher: null, // teacher relation not defined in schema
      };
    }).sort((a, b) => a.subject.name.localeCompare(b.subject.name));

    return result;
  }

  /**
   * Update coefficient for a class-subject
   */
  static async updateCoefficient(
    classId: string,
    subjectId: string,
    coefficient: number
  ) {
    // Find or create the class-subject relationship
    const existing = await prisma.class_subjects.findFirst({
      where: {
        class_id: classId,
        subject_id: subjectId,
      },
    });

    if (existing) {
      const updated = await prisma.class_subjects.update({
        where: { id: existing.id },
        data: { coefficient },
        include: {
          subjects: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
      });
      
      // Transform data to match frontend expectations
      return {
        id: updated.id,
        classId: updated.class_id,
        subjectId: updated.subject_id,
        coefficient: updated.coefficient,
        hoursPerWeek: updated.hours_per_week,
        teacherId: updated.teacher_id,
        subject: updated.subjects,
      };
    } else {
      const created = await prisma.class_subjects.create({
        data: {
          id: randomUUID(),
          class_id: classId,
          subject_id: subjectId,
          coefficient,
          hours_per_week: 1,
        },
        include: {
          subjects: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
      });
      
      // Transform data to match frontend expectations
      return {
        id: created.id,
        classId: created.class_id,
        subjectId: created.subject_id,
        coefficient: created.coefficient,
        hoursPerWeek: created.hours_per_week,
        teacherId: created.teacher_id,
        subject: created.subjects,
      };
    }
  }

  /**
   * Batch update coefficients for a class
   */
  static async batchUpdateCoefficients(
    classId: string,
    coefficients: Array<{ subjectId: string; coefficient: number }>
  ) {
    const results = [];

    for (const { subjectId, coefficient } of coefficients) {
      const result = await this.updateCoefficient(classId, subjectId, coefficient);
      results.push(result);
    }

    return results;
  }

  /**
   * Get all subjects (for selection)
   */
  static async getAllSubjects() {
    return await prisma.subjects.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        code: true,
      },
    });
  }

  /**
   * Get all classes (for selection)
   */
  static async getAllClasses() {
    return await prisma.schoolClass.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
      },
    });
  }
}

