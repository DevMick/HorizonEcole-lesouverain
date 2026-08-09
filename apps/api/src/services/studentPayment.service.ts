import { prisma } from '@school/database';
import { z } from 'zod';
import { randomUUID } from 'crypto';

// Validation schemas
const createStudentPaymentSchema = z.object({
  studentId: z.string().uuid(),
  academicYearId: z.string().uuid(),
  schoolFeeRateDetailId: z.string().uuid(),
  amount: z.number().positive(),
  paymentDate: z.string().transform(str => new Date(str)),
  paymentMethod: z.enum(['CASH', 'CHEQUE', 'VIREMENT', 'MOBILE_MONEY', 'CARTE']),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

const updateStudentPaymentSchema = z.object({
  amount: z.number().positive().optional(),
  paymentDate: z.string().transform(str => new Date(str)).optional(),
  paymentMethod: z.enum(['CASH', 'CHEQUE', 'VIREMENT', 'MOBILE_MONEY', 'CARTE']).optional(),
  reference: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(['PENDING', 'PARTIAL', 'PAID', 'OVERDUE', 'CANCELLED']).optional(),
});

export class StudentPaymentService {
  /**
   * Get all student payments with filters
   */
  static async getAll(filters: {
    studentId?: string;
    academicYearId?: string;
    classId?: string;
    status?: string;
    paymentTypeId?: string;
    page?: number;
    limit?: number;
  } = {}) {
    const {
      studentId,
      academicYearId,
      classId,
      status,
      paymentTypeId,
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

    if (classId) {
      where.student = {
        classId: classId,
      };
    }

    if (status) {
      where.status = status;
    }

    if (paymentTypeId) {
      where.school_fee_rate_details = {
        payment_type_id: paymentTypeId,
      };
    }

    const [payments, total] = await Promise.all([
      prisma.student_payments.findMany({
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
          academicYear: {
            select: {
              id: true,
              name: true,
              isCurrent: true,
            },
          },
          school_fee_rate_details: {
            include: {
              payment_types: {
                select: {
                  id: true,
                  name: true,
                },
              },
              school_fee_rates: {
                select: {
                  id: true,
                  class: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
              },
            },
          },
          recordedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: [
          { payment_date: 'desc' },
          { created_at: 'desc' },
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.student_payments.count({ where }),
    ]);

    return {
      payments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get payment by ID
   */
  static async getById(id: string) {
    return prisma.student_payments.findUnique({
      where: { id },
      include: {
        student: {
          include: {
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
        school_fee_rate_details: {
          include: {
            payment_types: {
              select: {
                id: true,
                name: true,
              },
            },
            school_fee_rates: {
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
        },
        recordedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  /**
   * Get student payment status for an academic year
   * Returns all payment types expected and their status
   */
  static async getStudentPaymentStatus(studentId: string, academicYearId: string) {
    // Get student with class
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        class: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!student || !student.classId) {
      throw new Error('Student not found or not assigned to a class');
    }

    // Check if student has a custom payment plan
    const customPaymentPlan = await prisma.custom_payment_plans.findUnique({
      where: {
        student_id_academic_year_id: {
          student_id: studentId,
          academic_year_id: academicYearId,
        },
      },
      include: {
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

    // Get all payments for this student in this academic year
    const payments = await prisma.student_payments.findMany({
      where: {
        student_id: studentId,
        academic_year_id: academicYearId,
      },
      include: {
        school_fee_rate_details: {
          include: {
            payment_types: true,
          },
        },
      },
    });

    let expectedPayments: any[];
    let totalExpected: number;
    let schoolFeeRate: any = null;

    // If custom payment plan exists and is active, use it
    if (customPaymentPlan && customPaymentPlan.is_active) {
      // Build payment status map based on payment types
      const paymentStatusMap = new Map();
      payments.forEach((payment) => {
        const paymentTypeId = payment.school_fee_rate_details?.payment_types?.id;
        if (paymentTypeId) {
          if (!paymentStatusMap.has(paymentTypeId)) {
            paymentStatusMap.set(paymentTypeId, []);
          }
          paymentStatusMap.get(paymentTypeId).push(payment);
        }
      });

      // Build expected payments from custom plan installments
      expectedPayments = customPaymentPlan.custom_payment_plan_installments.map((installment) => {
        const studentPayments = paymentStatusMap.get(installment.payment_type_id) || [];
        const totalPaid = studentPayments.reduce(
          (sum: number, p: any) => sum + Number(p.amount),
          0
        );
        const expectedAmount = Number(installment.amount);
        const remaining = expectedAmount - totalPaid;

        let status: 'PENDING' | 'PARTIAL' | 'PAID' | 'OVERDUE' = 'PENDING';
        if (totalPaid >= expectedAmount) {
          status = 'PAID';
        } else if (totalPaid > 0) {
          status = 'PARTIAL';
        }

        // Check if overdue
        const today = new Date();
        const dueDate = new Date(installment.due_date);
        if (status !== 'PAID' && today > dueDate) {
          status = 'OVERDUE';
        }

        return {
          paymentType: installment.payment_types,
          expectedAmount,
          totalPaid,
          remaining,
          status,
          payments: studentPayments,
          schoolFeeRateDetailId: null, // Custom plan doesn't use schoolFeeRateDetail
          installmentNumber: installment.installment_number,
          dueDate: installment.due_date,
          isCustom: true,
        };
      });

      totalExpected = Number(customPaymentPlan.total_amount);
    } else {
      // Use standard school fee rate
      const isStateAssigned = student.isStateAssigned || false;

      schoolFeeRate = await prisma.school_fee_rates.findFirst({
        where: {
          class_id: student.classId,
          is_for_state_assigned: isStateAssigned,
        },
        include: {
          school_fee_rate_details: {
            include: {
              payment_types: true,
            },
            orderBy: {
              created_at: 'asc',
            },
          },
        },
      });

      if (!schoolFeeRate) {
        throw new Error('No fee rate found for this student\'s class and academic year');
      }

      // Build payment status map
      const paymentStatusMap = new Map();
      payments.forEach((payment) => {
        const detailId = payment.school_fee_rate_detail_id;
        if (!paymentStatusMap.has(detailId)) {
          paymentStatusMap.set(detailId, []);
        }
        paymentStatusMap.get(detailId).push(payment);
      });

      // Build expected payments with status
      expectedPayments = schoolFeeRate.school_fee_rate_details.map((detail) => {
        const studentPayments = paymentStatusMap.get(detail.id) || [];
        const totalPaid = studentPayments.reduce(
          (sum: number, p: any) => sum + Number(p.amount),
          0
        );
        const expectedAmount = Number(detail.amount);
        const remaining = expectedAmount - totalPaid;

        let status: 'PENDING' | 'PARTIAL' | 'PAID' | 'OVERDUE' = 'PENDING';
        if (totalPaid >= expectedAmount) {
          status = 'PAID';
        } else if (totalPaid > 0) {
          status = 'PARTIAL';
        }

        return {
          paymentType: detail.payment_types,
          expectedAmount,
          totalPaid,
          remaining,
          status,
          payments: studentPayments,
          schoolFeeRateDetailId: detail.id,
          isCustom: false,
        };
      });

      totalExpected = expectedPayments.reduce((sum, p) => sum + p.expectedAmount, 0);
    }

    const totalPaid = expectedPayments.reduce((sum, p) => sum + p.totalPaid, 0);
    const totalRemaining = totalExpected - totalPaid;

    return {
      student: {
        id: student.id,
        firstName: student.firstName,
        lastName: student.lastName,
        studentNumber: student.studentNumber,
        class: student.class,
      },
      academicYear: {
        id: academicYearId,
      },
      schoolFeeRate: schoolFeeRate ? {
        id: schoolFeeRate.id,
        totalAmount: schoolFeeRate.total_amount,
        isForStateAssigned: schoolFeeRate.is_for_state_assigned,
      } : null,
      customPaymentPlan: customPaymentPlan && customPaymentPlan.is_active ? {
        id: customPaymentPlan.id,
        name: customPaymentPlan.name,
        totalAmount: customPaymentPlan.total_amount,
      } : null,
      expectedPayments,
      summary: {
        totalExpected,
        totalPaid,
        totalRemaining,
        completionRate: totalExpected > 0 ? (totalPaid / totalExpected) * 100 : 0,
      },
    };
  }

  /**
   * Find or create a school fee rate detail for a payment type
   * Used for custom payment plans where the payment type might not exist in fee rates
   */
  static async findOrCreateSchoolFeeRateDetail(
    paymentTypeId: string,
    studentClassId: string,
    expectedAmount?: number
  ): Promise<string> {
    // First, try to find an existing detail with this payment type
    const existingDetail = await prisma.school_fee_rate_details.findFirst({
      where: {
        payment_type_id: paymentTypeId,
        school_fee_rates: {
          class_id: studentClassId,
        },
      },
      select: {
        id: true,
      },
    });

    if (existingDetail) {
      return existingDetail.id;
    }

    // If not found, try to find in any fee rate
    const anyDetail = await prisma.school_fee_rate_details.findFirst({
      where: {
        payment_type_id: paymentTypeId,
      },
      select: {
        id: true,
      },
    });

    if (anyDetail) {
      return anyDetail.id;
    }

    // If still not found, get or create a fee rate for the class
    let feeRate = await prisma.school_fee_rates.findFirst({
      where: {
        class_id: studentClassId,
        is_for_state_assigned: false,
      },
    });

    if (!feeRate) {
      // Create a fee rate for the class if it doesn't exist
      feeRate = await prisma.school_fee_rates.create({
        data: {
          id: randomUUID(),
          class_id: studentClassId,
          is_for_state_assigned: false,
          total_amount: 0,
        },
      });
    }

    // Create the school fee rate detail
    const newDetail = await prisma.school_fee_rate_details.create({
      data: {
        id: randomUUID(),
        school_fee_rate_id: feeRate.id,
        payment_type_id: paymentTypeId,
        amount: expectedAmount || 0,
      },
    });

    // Update the fee rate total
    const allDetails = await prisma.school_fee_rate_details.findMany({
      where: {
        school_fee_rate_id: feeRate.id,
      },
      select: {
        amount: true,
      },
    });

    const totalAmount = allDetails.reduce(
      (sum, detail) => sum + Number(detail.amount),
      0
    );

    await prisma.school_fee_rates.update({
      where: { id: feeRate.id },
      data: { total_amount: totalAmount },
    });

    return newDetail.id;
  }

  /**
   * Create a new student payment
   */
  static async create(data: z.infer<typeof createStudentPaymentSchema>, recordedBy: string) {
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

    // Verify academic year exists
    const academicYear = await prisma.academicYear.findUnique({
      where: { id: data.academicYearId },
    });

    if (!academicYear) {
      throw new Error('Academic year not found');
    }

    // Verify school fee rate detail exists
    const schoolFeeRateDetail = await prisma.school_fee_rate_details.findUnique({
      where: { id: data.schoolFeeRateDetailId },
      include: {
        payment_types: true,
        school_fee_rates: {
          include: {
            class: true,
          },
        },
      },
    });

    if (!schoolFeeRateDetail) {
      throw new Error('Payment type not found in fee rate');
    }

    // Check if student has a custom payment plan
    const customPaymentPlan = await prisma.custom_payment_plans.findUnique({
      where: {
        student_id_academic_year_id: {
          student_id: data.studentId,
          academic_year_id: data.academicYearId,
        },
      },
      select: {
        is_active: true,
      },
    });

    // For custom payment plans, allow payment types from any class
    // For standard payments, verify it's the correct class
    if (!customPaymentPlan?.is_active && schoolFeeRateDetail.school_fee_rates.class_id !== student.classId) {
      throw new Error('Class mismatch');
    }

    // Check if payment already exists for this type of versement
    const existingPayment = await prisma.student_payments.findFirst({
      where: {
        student_id: data.studentId,
        academic_year_id: data.academicYearId,
        school_fee_rate_detail_id: data.schoolFeeRateDetailId,
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    // Calculate status
    const expectedAmount = Number(schoolFeeRateDetail.amount);
    const paidAmount = data.amount;
    let status: 'PENDING' | 'PARTIAL' | 'PAID' | 'OVERDUE' = 'PENDING';
    if (paidAmount >= expectedAmount) {
      status = 'PAID';
    } else if (paidAmount > 0) {
      status = 'PARTIAL';
    }

    // Convert paymentDate to Date object if it's a string
    let paymentDate: Date;
    if (typeof data.paymentDate === 'string') {
      // If it's a date string (YYYY-MM-DD), convert it to Date
      // Add time component to make it a valid DateTime
      const dateStr = (data.paymentDate as string).includes('T') 
        ? data.paymentDate 
        : `${data.paymentDate}T00:00:00.000Z`;
      paymentDate = new Date(dateStr);
    } else if (data.paymentDate instanceof Date) {
      paymentDate = data.paymentDate;
    } else {
      throw new Error('Invalid payment date format');
    }

    // If payment exists, update it; otherwise create a new one
    let payment;
    if (existingPayment) {
      // Update existing payment
      // Keep existing receipt number
      const receiptNumber = existingPayment.receipt_number || await this.generateReceiptNumber();
      
      payment = await prisma.student_payments.update({
        where: { id: existingPayment.id },
        data: {
          amount: data.amount,
          expected_amount: expectedAmount,
          payment_date: paymentDate,
          payment_method: data.paymentMethod,
          receipt_number: receiptNumber,
          reference: data.reference,
          notes: data.notes,
          status: status,
          recorded_by: recordedBy,
        },
      include: {
        student: {
          include: {
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
        school_fee_rate_details: {
          include: {
            payment_types: true,
            school_fee_rates: {
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
        },
        recordedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
    } else {
      // Create new payment
      // Generate receipt number
      const receiptNumber = await this.generateReceiptNumber();
      
      // Generate UUID for the payment ID
      const paymentId = randomUUID();
      
      payment = await prisma.student_payments.create({
        data: {
          id: paymentId,
          student_id: data.studentId,
          academic_year_id: data.academicYearId,
          school_fee_rate_detail_id: data.schoolFeeRateDetailId,
          amount: data.amount,
          expected_amount: expectedAmount,
          payment_date: paymentDate,
          payment_method: data.paymentMethod,
          receipt_number: receiptNumber,
          reference: data.reference,
          notes: data.notes,
          status: status,
          recorded_by: recordedBy,
        },
        include: {
          student: {
            include: {
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
          school_fee_rate_details: {
            include: {
              payment_types: true,
              school_fee_rates: {
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
          },
          recordedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });
    }

    return payment;
  }

  /**
   * Update a student payment
   */
  static async update(
    id: string,
    data: Partial<z.infer<typeof updateStudentPaymentSchema>>,
    updatedBy: string
  ) {
    const payment = await prisma.student_payments.findUnique({
      where: { id },
      include: {
        school_fee_rate_details: true,
      },
    });

    if (!payment) {
      throw new Error('Payment not found');
    }

    // Calculate status if amount is updated
    let status = data.status;
    if (data.amount !== undefined) {
      const expectedAmount = Number(payment.expected_amount);
      const paidAmount = data.amount;
      if (paidAmount >= expectedAmount) {
        status = 'PAID';
      } else if (paidAmount > 0) {
        status = 'PARTIAL';
      } else {
        status = 'PENDING';
      }
    }

    const updateData: any = {};
    if (data.amount !== undefined) updateData.amount = data.amount;
    if (data.paymentDate !== undefined) {
      // Convert paymentDate to Date object if it's a string
      if (typeof data.paymentDate === 'string') {
        const dateStr = (data.paymentDate as string).includes('T') 
          ? data.paymentDate 
          : `${data.paymentDate}T00:00:00.000Z`;
        updateData.payment_date = new Date(dateStr);
      } else if (data.paymentDate instanceof Date) {
        updateData.payment_date = data.paymentDate;
      } else {
        throw new Error('Invalid payment date format');
      }
    }
    if (data.paymentMethod !== undefined) updateData.payment_method = data.paymentMethod;
    if (data.reference !== undefined) updateData.reference = data.reference;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (status !== undefined) updateData.status = status;

    return prisma.student_payments.update({
      where: { id },
      data: updateData,
      include: {
        student: {
          include: {
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
        school_fee_rate_details: {
          include: {
            payment_types: true,
            school_fee_rates: {
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
        },
        recordedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  /**
   * Delete a student payment
   */
  static async delete(id: string) {
    const payment = await prisma.student_payments.findUnique({
      where: { id },
    });

    if (!payment) {
      throw new Error('Payment not found');
    }

    await prisma.student_payments.delete({
      where: { id },
    });

    return { message: 'Payment deleted successfully' };
  }

  /**
   * Generate unique receipt number
   */
  static async generateReceiptNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `REC-${year}-`;

    // Get the last receipt number for this year
    const lastPayment = await prisma.student_payments.findFirst({
      where: {
        receipt_number: {
          startsWith: prefix,
        },
      },
      orderBy: {
        receipt_number: 'desc',
      },
    });

    let sequence = 1;
    if (lastPayment && lastPayment.receipt_number) {
      const lastSequence = parseInt(
        lastPayment.receipt_number.replace(prefix, '')
      );
      if (!isNaN(lastSequence)) {
        sequence = lastSequence + 1;
      }
    }

    return `${prefix}${sequence.toString().padStart(6, '0')}`;
  }
}

export default StudentPaymentService;

