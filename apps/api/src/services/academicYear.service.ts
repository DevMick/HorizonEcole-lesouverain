import { prisma } from '@school/database';
import crypto from 'crypto';

export class AcademicYearService {
  /**
   * Get all academic years
   */
  static async getAll() {
    try {
      const years = await prisma.academicYear.findMany({
        orderBy: { startYear: 'desc' },
        // Retirer _count pour simplifier la réponse et éviter les problèmes de sérialisation
        // include: {
        //   _count: {
        //     select: {
        //       schedules: true,
        //       inscriptions: true,
        //       schoolFeeRates: true,
        //       budgets: true,
        //     },
        //   },
        // },
      });
      
      console.log('Academic years fetched:', years.length);
      return years;
    } catch (error) {
      console.error('Error in getAll academic years:', error);
      throw error;
    }
  }

  /**
   * Get academic year by ID
   */
  static async getById(id: string) {
    return await prisma.academicYear.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            schedules: true,
            inscriptions: true,
            budgets: true,
          },
        },
      },
    });
  }

  /**
   * Get current academic year
   */
  static async getCurrent() {
    return await prisma.academicYear.findFirst({
      where: { isCurrent: true },
    });
  }

  /**
   * Create academic year
   */
  static async create(data: {
    name: string;
    startYear: number;
    endYear: number;
    isCurrent?: boolean;
  }) {
    // Generate UUID for the academic year ID
    const id = crypto.randomUUID();
    
    // Create the new academic year
    const newYear = await prisma.academicYear.create({
      data: {
        id, // ID généré automatiquement
        ...data,
        isCurrent: false, // Temporarily set to false
      },
    });

    // Find the academic year with the highest endYear
    const mostRecentYear = await prisma.academicYear.findFirst({
      orderBy: { endYear: 'desc' },
    });

    // Set all years as not current
    await prisma.academicYear.updateMany({
      where: {},
      data: { isCurrent: false },
    });

    // Set the most recent year (highest endYear) as current
    if (mostRecentYear) {
      await prisma.academicYear.update({
        where: { id: mostRecentYear.id },
        data: { isCurrent: true },
      });
    }

    // Return the newly created year with updated isCurrent status
    return await prisma.academicYear.findUnique({
      where: { id: newYear.id },
    });
  }

  /**
   * Update academic year
   */
  static async update(id: string, data: any) {
    // If setting as current, unset other current years
    if (data.isCurrent) {
      await prisma.academicYear.updateMany({
        where: { 
          isCurrent: true,
          id: { not: id },
        },
        data: { isCurrent: false },
      });
    }

    return await prisma.academicYear.update({
      where: { id },
      data,
    });
  }

  /**
   * Delete academic year
   */
  static async delete(id: string) {
    // Check if has dependencies
    const year = await prisma.academicYear.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            schedules: true,
            inscriptions: true,
            budgets: true,
          },
        },
      },
    });

    if (!year) {
      throw new Error('Academic year not found');
    }

    const totalDependencies = 
      year._count.schedules + 
      year._count.inscriptions +
      year._count.budgets;

    if (totalDependencies > 0) {
      throw new Error(
        `Cannot delete academic year with ${totalDependencies} dependencies (schedules: ${year._count.schedules}, inscriptions: ${year._count.inscriptions}, budgets: ${year._count.budgets})`
      );
    }

    // Delete the academic year
    await prisma.academicYear.delete({
      where: { id },
    });

    // After deletion, ensure the most recent year is marked as current
    const mostRecentYear = await prisma.academicYear.findFirst({
      orderBy: { endYear: 'desc' },
    });

    if (mostRecentYear) {
      // Set all years as not current
      await prisma.academicYear.updateMany({
        where: {},
        data: { isCurrent: false },
      });

      // Set the most recent year as current
      await prisma.academicYear.update({
        where: { id: mostRecentYear.id },
        data: { isCurrent: true },
      });
    }

    return { message: 'Academic year deleted successfully' };
  }

  /**
   * Set academic year as current
   */
  static async setCurrent(id: string) {
    // Unset all other current years
    await prisma.academicYear.updateMany({
      where: { isCurrent: true },
      data: { isCurrent: false },
    });

    // Set this year as current
    return await prisma.academicYear.update({
      where: { id },
      data: { isCurrent: true },
    });
  }
}

