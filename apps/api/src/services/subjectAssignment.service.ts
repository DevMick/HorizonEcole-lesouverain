import { randomUUID } from 'crypto';
import { prisma } from '@school/database';

export class SubjectAssignmentService {
  /**
   * Get all subjects with assignment status for a class
   */
  static async getSubjectsForClass(classId: string) {
    const allSubjects = await prisma.subjects.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        code: true,
      },
    });

    const assignedSubjects = await prisma.class_subjects.findMany({
      where: { class_id: classId },
      select: {
        subject_id: true,
        coefficient: true,
        hours_per_week: true,
        teacher_id: true,
      },
    });

    // Map to show which subjects are assigned
    const assignmentMap = new Map(
      assignedSubjects.map(cs => [cs.subject_id, cs])
    );

    return allSubjects.map(subject => ({
      ...subject,
      isAssigned: assignmentMap.has(subject.id),
      coefficient: assignmentMap.get(subject.id)?.coefficient || 1,
      hoursPerWeek: assignmentMap.get(subject.id)?.hours_per_week || 1,
      teacherId: assignmentMap.get(subject.id)?.teacher_id || null,
    }));
  }

  /**
   * Assign subjects to a class
   */
  static async assignSubjects(
    classId: string,
    subjectIds: string[]
  ) {
    // Get currently assigned subjects
    const currentAssignments = await prisma.class_subjects.findMany({
      where: { class_id: classId },
      select: { subject_id: true, id: true },
    });

    const currentSubjectIds = new Set(currentAssignments.map(cs => cs.subject_id));
    const newSubjectIds = new Set(subjectIds);

    // Subjects to add (in new list but not in current)
    const toAdd = subjectIds.filter(id => !currentSubjectIds.has(id));

    // Subjects to remove (in current but not in new list)
    const toRemove = currentAssignments.filter(cs => !newSubjectIds.has(cs.subject_id));

    // Remove unassigned subjects
    if (toRemove.length > 0) {
      await prisma.class_subjects.deleteMany({
        where: {
          id: {
            in: toRemove.map(cs => cs.id),
          },
        },
      });
    }

    // Add new subjects with default coefficient
    if (toAdd.length > 0) {
      await prisma.class_subjects.createMany({
        data: toAdd.map(subjectId => ({
          id: randomUUID(),
          class_id: classId,
          subject_id: subjectId,
          coefficient: 1,
          hours_per_week: 1,
        })),
      });
    }

    return {
      added: toAdd.length,
      removed: toRemove.length,
      total: subjectIds.length,
    };
  }

  /**
   * Get all classes
   */
  static async getAllClasses() {
    return await prisma.schoolClass.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            classSubjects: true,
          },
        },
      },
    });
  }
}

