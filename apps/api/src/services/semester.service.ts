import { prisma } from '@school/database';
import crypto from 'crypto';

export class SemesterService {
  /**
   * Get all semesters
   */
  static async getAll(filters?: {
    academicYearId?: string;
  }) {
    try {
      const where: any = {};
      
      if (filters?.academicYearId) {
        where.academic_year_id = filters.academicYearId;
      }

      const semesters = await prisma.semesters.findMany({
        where,
        include: {
          academicYear: true,
        },
        orderBy: [
          { start_date: 'asc' },
        ],
      });
      
      return semesters;
    } catch (error) {
      console.error('Error in getAll semesters:', error);
      throw error;
    }
  }

  /**
   * Get semester by ID
   */
  static async getById(id: string) {
    return await prisma.semesters.findUnique({
      where: { id },
      include: {
        academicYear: true,
      },
    });
  }

  /**
   * Create semester
   */
  static async create(data: {
    name: string;
    startDate: Date;
    endDate: Date;
    academicYearId: string;
  }) {
    // Validate dates
    if (data.startDate >= data.endDate) {
      throw new Error('La date de début doit être antérieure à la date de fin');
    }

    // Check if academic year exists
    const academicYear = await prisma.academicYear.findUnique({
      where: { id: data.academicYearId },
    });

    if (!academicYear) {
      throw new Error('Année académique non trouvée');
    }

    // Check for overlapping semesters in the same academic year
    const overlappingSemester = await prisma.semesters.findFirst({
      where: {
        academic_year_id: data.academicYearId,
        OR: [
          {
            AND: [
              { start_date: { lte: data.startDate } },
              { end_date: { gte: data.startDate } },
            ],
          },
          {
            AND: [
              { start_date: { lte: data.endDate } },
              { end_date: { gte: data.endDate } },
            ],
          },
          {
            AND: [
              { start_date: { gte: data.startDate } },
              { end_date: { lte: data.endDate } },
            ],
          },
        ],
      },
    });

    if (overlappingSemester) {
      throw new Error('Un semestre avec des dates qui se chevauchent existe déjà pour cette année académique');
    }

    // Generate UUID for the semester ID
    const id = crypto.randomUUID();
    
    // Create the new semester
    const newSemester = await prisma.semesters.create({
      data: {
        id,
        name: data.name,
        start_date: data.startDate,
        end_date: data.endDate,
        academic_year_id: data.academicYearId,
      },
      include: {
        academicYear: true,
      },
    });

    return newSemester;
  }

  /**
   * Update semester
   */
  static async update(id: string, data: {
    name?: string;
    startDate?: Date;
    endDate?: Date;
    academicYearId?: string;
  }) {
    const semester = await prisma.semesters.findUnique({
      where: { id },
    });

    if (!semester) {
      throw new Error('Semestre non trouvé');
    }

    // Validate dates if both are provided
    if (data.startDate && data.endDate) {
      if (data.startDate >= data.endDate) {
        throw new Error('La date de début doit être antérieure à la date de fin');
      }
    }

    // Check for overlapping semesters if dates are being updated
    if (data.startDate || data.endDate) {
      const startDate = data.startDate || semester.start_date;
      const endDate = data.endDate || semester.end_date;
      const academicYearId = data.academicYearId || semester.academic_year_id;

      const overlappingSemester = await prisma.semesters.findFirst({
        where: {
          academic_year_id: academicYearId,
          id: { not: id },
          OR: [
            {
              AND: [
                { start_date: { lte: startDate } },
                { end_date: { gte: startDate } },
              ],
            },
            {
              AND: [
                { start_date: { lte: endDate } },
                { end_date: { gte: endDate } },
              ],
            },
            {
              AND: [
                { start_date: { gte: startDate } },
                { end_date: { lte: endDate } },
              ],
            },
          ],
        },
      });

      if (overlappingSemester) {
        throw new Error('Un semestre avec des dates qui se chevauchent existe déjà pour cette année académique');
      }
    }

    // Check if academic year exists if being updated
    if (data.academicYearId) {
      const academicYear = await prisma.academicYear.findUnique({
        where: { id: data.academicYearId },
      });

      if (!academicYear) {
        throw new Error('Année académique non trouvée');
      }
    }

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.startDate !== undefined) updateData.start_date = data.startDate;
    if (data.endDate !== undefined) updateData.end_date = data.endDate;
    if (data.academicYearId !== undefined) updateData.academic_year_id = data.academicYearId;

    return await prisma.semesters.update({
      where: { id },
      data: updateData,
      include: {
        academicYear: true,
      },
    });
  }

  /**
   * Delete semester
   */
  static async delete(id: string) {
    const semester = await prisma.semesters.findUnique({
      where: { id },
    });

    if (!semester) {
      throw new Error('Semestre non trouvé');
    }

    await prisma.semesters.delete({
      where: { id },
    });

    return { message: 'Semestre supprimé avec succès' };
  }
}

