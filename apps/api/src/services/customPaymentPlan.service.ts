import { prisma } from '@school/database';
import { z } from 'zod';

// Validation schemas
const createCustomPaymentPlanSchema = z.object({
  studentId: z.string().uuid(),
  classId: z.string().uuid(),
  academicYearId: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  totalAmount: z.number().positive(),
  installments: z.array(z.object({
    paymentTypeId: z.string().uuid(),
    installmentNumber: z.number().int().positive(),
    dueDate: z.string().transform(str => new Date(str)),
    amount: z.number().positive(),
    notes: z.string().optional(),
  })).min(1, 'At least one installment is required'),
});

const updateCustomPaymentPlanSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  totalAmount: z.number().positive().optional(),
  isActive: z.boolean().optional(),
  installments: z.array(z.object({
    paymentTypeId: z.string().uuid(),
    installmentNumber: z.number().int().positive(),
    dueDate: z.string().transform(str => new Date(str)),
    amount: z.number().positive(),
    notes: z.string().optional(),
  })).optional(),
});

export class CustomPaymentPlanService {
  /**
   * Get all custom payment plans with filters
   */
  static async getAll(filters: {
    studentId?: string;
    academicYearId?: string;
    isActive?: boolean;
    page?: number;
    limit?: number;
  } = {}) {
    const {
      studentId,
      academicYearId,
      isActive,
      page = 1,
      limit = 50,
    } = filters;

    const where: any = {};

    if (studentId) {
      where.student_id = studentId;
    }

    if (academicYearId) {
      where.academic_year_id = academicYearId;
    }

    if (isActive !== undefined) {
      where.is_active = isActive;
    }

    const [plans, total] = await Promise.all([
      prisma.custom_payment_plans.findMany({
        where,
        include: {
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
          academicYear: {
            select: {
              id: true,
              name: true,
              isCurrent: true,
            },
          },
          creator: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          custom_payment_plan_installments: {
            include: {
              payment_types: true,
            },
            orderBy: {
              installment_number: 'asc',
            },
          },
        },
        orderBy: {
          created_at: 'desc',
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.custom_payment_plans.count({ where }),
    ]);

    return {
      plans,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get custom payment plan by ID
   */
  static async getById(id: string) {
    return prisma.custom_payment_plans.findUnique({
      where: { id },
      include: {
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
        academicYear: {
          select: {
            id: true,
            name: true,
            isCurrent: true,
          },
        },
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        custom_payment_plan_installments: {
          include: {
            payment_types: true,
          },
          orderBy: {
            installment_number: 'asc',
          },
        },
      },
    });
  }

  /**
   * Get custom payment plan for a student and academic year
   */
  static async getByStudentAndAcademicYear(studentId: string, academicYearId: string) {
    return prisma.custom_payment_plans.findUnique({
      where: {
        student_id_academic_year_id: {
          student_id: studentId,
          academic_year_id: academicYearId,
        },
      },
      include: {
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
        academicYear: {
          select: {
            id: true,
            name: true,
            isCurrent: true,
          },
        },
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        custom_payment_plan_installments: {
          include: {
            payment_types: true,
          },
          orderBy: {
            installment_number: 'asc',
          },
        },
      },
    });
  }

  /**
   * Create a new custom payment plan
   */
  static async create(data: z.infer<typeof createCustomPaymentPlanSchema>, createdBy: string) {
    // Verify student exists
    const student = await prisma.student.findUnique({
      where: { id: data.studentId },
      include: {
        class: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!student) {
      throw new Error('Student not found');
    }

    // Verify class exists
    const schoolClass = await prisma.schoolClass.findUnique({
      where: { id: data.classId },
    });

    if (!schoolClass) {
      throw new Error('Class not found');
    }

    // Verify that student belongs to the selected class
    if (student.classId !== data.classId) {
      throw new Error('Student does not belong to the selected class');
    }

    // Verify academic year exists
    const academicYear = await prisma.academicYear.findUnique({
      where: { id: data.academicYearId },
    });

    if (!academicYear) {
      throw new Error('Academic year not found');
    }

    // Check if a plan already exists for this student and academic year
    const existingPlan = await prisma.custom_payment_plans.findUnique({
      where: {
        student_id_academic_year_id: {
          student_id: data.studentId,
          academic_year_id: data.academicYearId,
        },
      },
    });

    if (existingPlan) {
      throw new Error('A custom payment plan already exists for this student and academic year');
    }

    // Verify total amount matches sum of installments
    const totalInstallmentsAmount = data.installments.reduce((sum, inst) => sum + inst.amount, 0);
    if (Math.abs(totalInstallmentsAmount - data.totalAmount) > 0.01) {
      throw new Error('Total amount must match the sum of all installments');
    }

    // Verify payment types exist
    const paymentTypeIds = data.installments.map(inst => inst.paymentTypeId);
    const paymentTypes = await prisma.payment_types.findMany({
      where: {
        id: { in: paymentTypeIds },
      },
    });

    if (paymentTypes.length !== paymentTypeIds.length) {
      throw new Error('One or more payment types not found');
    }

    // Convert due dates to Date objects
    const installments = data.installments.map(inst => ({
      payment_type_id: inst.paymentTypeId,
      installment_number: inst.installmentNumber,
      due_date: inst.dueDate instanceof Date ? inst.dueDate : new Date(inst.dueDate),
      amount: inst.amount,
      notes: inst.notes,
    }));

    // Create plan with installments
    return prisma.custom_payment_plans.create({
      data: {
        student_id: data.studentId,
        class_id: data.classId,
        academic_year_id: data.academicYearId,
        name: data.name,
        description: data.description,
        total_amount: data.totalAmount,
        created_by: createdBy,
        custom_payment_plan_installments: {
          create: installments,
        },
      },
      include: {
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
        academicYear: {
          select: {
            id: true,
            name: true,
            isCurrent: true,
          },
        },
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        custom_payment_plan_installments: {
          include: {
            payment_types: true,
          },
          orderBy: {
            installment_number: 'asc',
          },
        },
      },
    });
  }

  /**
   * Update a custom payment plan
   */
  static async update(
    id: string,
    data: Partial<z.infer<typeof updateCustomPaymentPlanSchema>>,
    updatedBy: string
  ) {
    const plan = await prisma.custom_payment_plans.findUnique({
      where: { id },
      include: {
        custom_payment_plan_installments: true,
      },
    });

    if (!plan) {
      throw new Error('Custom payment plan not found');
    }

    const updateData: any = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.isActive !== undefined) updateData.is_active = data.isActive;

    // If installments are being updated
    if (data.installments) {
      // Verify total amount matches sum of installments if totalAmount is provided
      if (data.totalAmount !== undefined) {
        const totalInstallmentsAmount = data.installments.reduce((sum, inst) => sum + inst.amount, 0);
        if (Math.abs(totalInstallmentsAmount - data.totalAmount) > 0.01) {
          throw new Error('Total amount must match the sum of all installments');
        }
        updateData.total_amount = data.totalAmount;
      }

      // Verify payment types exist
      const paymentTypeIds = data.installments.map(inst => inst.paymentTypeId);
      const paymentTypes = await prisma.payment_types.findMany({
        where: {
          id: { in: paymentTypeIds },
        },
      });

      if (paymentTypes.length !== paymentTypeIds.length) {
        throw new Error('One or more payment types not found');
      }

      // Convert due dates to Date objects
      const installments = data.installments.map(inst => ({
        payment_type_id: inst.paymentTypeId,
        installment_number: inst.installmentNumber,
        due_date: inst.dueDate instanceof Date ? inst.dueDate : new Date(inst.dueDate),
        amount: inst.amount,
        notes: inst.notes,
      }));

      // Delete existing installments and create new ones
      await prisma.custom_payment_plan_installments.deleteMany({
        where: { custom_payment_plan_id: id },
      });

      updateData.custom_payment_plan_installments = {
        create: installments,
      };
    } else if (data.totalAmount !== undefined) {
      updateData.total_amount = data.totalAmount;
    }

    return prisma.custom_payment_plans.update({
      where: { id },
      data: updateData,
      include: {
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
        academicYear: {
          select: {
            id: true,
            name: true,
            isCurrent: true,
          },
        },
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        custom_payment_plan_installments: {
          include: {
            payment_types: true,
          },
          orderBy: {
            installment_number: 'asc',
          },
        },
      },
    });
  }

  /**
   * Delete a custom payment plan
   */
  static async delete(id: string) {
    const plan = await prisma.custom_payment_plans.findUnique({
      where: { id },
    });

    if (!plan) {
      throw new Error('Custom payment plan not found');
    }

    return prisma.custom_payment_plans.delete({
      where: { id },
    });
  }
}

export { createCustomPaymentPlanSchema, updateCustomPaymentPlanSchema };

