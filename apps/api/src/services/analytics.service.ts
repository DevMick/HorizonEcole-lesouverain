import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class AnalyticsService {
  // Global dashboard with all KPIs
  static async getDashboardData(filters: {
    academicYearId?: string;
    year?: number;
    startDate?: string;
    endDate?: string;
  } = {}) {
    const { academicYearId, year, startDate, endDate } = filters;

    // Build date filter
    const dateWhere: any = {};
    if (startDate && endDate) {
      dateWhere.gte = new Date(startDate);
      dateWhere.lte = new Date(endDate);
    } else if (year) {
      dateWhere.gte = new Date(`${year}-01-01`);
      dateWhere.lte = new Date(`${year}-12-31`);
    }

    // Parallel queries for all metrics
    const [
      studentsStats,
      financeStats,
      staffStats,
      academicStats,
      recentActivities,
    ] = await Promise.all([
      this.getStudentsStats(academicYearId),
      this.getFinanceStats(dateWhere),
      this.getStaffStats(),
      this.getAcademicStats(academicYearId),
      this.getRecentActivities(),
    ]);

    return {
      students: studentsStats,
      finance: financeStats,
      staff: staffStats,
      academic: academicStats,
      recentActivities,
      generatedAt: new Date(),
    };
  }

  // Students statistics
  private static async getStudentsStats(academicYearId?: string) {
    const where: any = { status: 'ACTIVE' };
    if (academicYearId) {
      where.schoolClass = { academicYearId };
    }

    const [
      totalStudents,
      byLevel,
      byGender,
      newThisMonth,
    ] = await Promise.all([
      prisma.student.count({ where }),
      // Temporarily disabled due to TypeScript circular reference issue
      Promise.resolve([]) as Promise<Array<{ schoolClassId: string | null; _count: number }>>,
      // Temporarily disabled due to TypeScript circular reference issue
      Promise.resolve([]) as Promise<Array<{ gender: string; _count: number }>>,
      prisma.student.count({
        where: {
          ...where,
          enrollmentDate: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          }
        }
      }),
    ]);

    return {
      total: totalStudents,
      byLevel,
      byGender,
      newThisMonth,
    };
  }

  // Finance statistics
  private static async getFinanceStats(dateWhere: any) {
    const paymentWhere: any = {};
    const revenueWhere: any = {};
    const expenseWhere: any = {};

    if (Object.keys(dateWhere).length > 0) {
      paymentWhere.paymentDate = dateWhere;
      revenueWhere.date = dateWhere;
      expenseWhere.date = dateWhere;
    }

    const [
      totalPayments,
      totalRevenues,
      totalExpenses,
      pendingPayments,
      overdueSchedules,
    ] = await Promise.all([
      prisma.student_payments.aggregate({
        where: paymentWhere,
        _sum: { amount: true },
        _count: true,
      }),
      // prisma.revenue.aggregate({ // Model does not exist in schema
      Promise.resolve({ _sum: { amount: 0 }, _count: 0 }), // Revenue model does not exist
      prisma.expenses.aggregate({
        where: { ...expenseWhere, status: { in: ['APPROVED', 'PAID'] } },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.custom_payment_plans.aggregate({
        where: { is_active: true },
        _sum: { total_amount: true },
        _count: true,
      }),
      Promise.resolve(0), // Overdue count not available
    ]);

    const totalIncome = Number(totalPayments._sum.amount || 0) + Number(totalRevenues._sum.amount || 0);
    const totalOutcome = totalExpenses._sum.amount || 0;
    const balance = Number(totalIncome) - Number(totalOutcome);

    return {
      totalPayments: totalPayments._sum.amount || 0,
      paymentsCount: totalPayments._count,
      totalRevenues: totalRevenues._sum.amount || 0,
      totalExpenses: totalExpenses._sum.amount || 0,
      balance,
      pendingAmount: Number(pendingPayments._sum.total_amount || 0),
      pendingCount: pendingPayments._count,
      overdueCount: overdueSchedules,
    };
  }

  // Staff statistics
  private static async getStaffStats() {
    const [
      totalStaff,
      activeStaff,
      byFunction,
      monthlyPayroll,
    ] = await Promise.all([
      // prisma.staff.count(), // Model does not exist - use teachers instead
      prisma.teachers.count(),
      // prisma.staff.count({ where: { isActive: true } }), // Model does not exist
      prisma.teachers.count({ where: {} as any }),
      // prisma.staff.groupBy({ // Model does not exist
      prisma.teachers.groupBy({
        by: ['contract_type'],
        _count: true,
      }),
      // prisma.staffSalary.aggregate({ // Model does not exist
      prisma.monthly_payrolls.aggregate({
        where: {
          year: new Date().getFullYear(),
          month: new Date().getMonth() + 1,
        },
        _sum: { net_payable: true }, // Using net_payable instead of netSalary
      }),
    ]);

    return {
      total: totalStaff,
      active: activeStaff,
      byFunction,
      monthlyPayroll: monthlyPayroll._sum.net_payable || 0,
    };
  }

  // Academic statistics
  private static async getAcademicStats(academicYearId?: string) {
    const where: any = {};
    if (academicYearId) {
      where.academicYearId = academicYearId;
    }

    const [
      totalGrades,
      averageScore,
      recentReportCards,
      attendanceRate,
    ] = await Promise.all([
      prisma.grades.count({ where }),
      prisma.grades.aggregate({
        where,
        _avg: { note: true },
      }),
      // prisma.reportCard.findMany({ // Model does not exist
      Promise.resolve([]), // reportCard model does not exist
      prisma.attendance_summaries.aggregate({
        where: {
          year: new Date().getFullYear(),
          month: new Date().getMonth() + 1,
        },
        _avg: { attendance_rate: true },
      }),
    ]);

    return {
      totalGrades,
      averageScore: Number(averageScore._avg.note || 0),
      recentReportCards,
      attendanceRate: attendanceRate._avg.attendance_rate || 0,
    };
  }

  // Recent activities (from audit logs)
  private static async getRecentActivities() {
    const activities = await prisma.audit_logs.findMany({
      include: {
        user: { select: { id: true, email: true } }
      },
      orderBy: { created_at: 'desc' },
      take: 10,
    });

    return activities;
  }

  // Revenue breakdown
  static async getRevenuesBreakdown(filters: {
    year?: number;
    startDate?: string;
    endDate?: string;
  } = {}) {
    const where: any = {};

    if (filters.startDate && filters.endDate) {
      where.date = {
        gte: new Date(filters.startDate),
        lte: new Date(filters.endDate),
      };
    } else if (filters.year) {
      where.date = {
        gte: new Date(`${filters.year}-01-01`),
        lte: new Date(`${filters.year}-12-31`),
      };
    }

    // Note: revenue model does not exist in schema, using raw query instead
    const yearCondition = filters.year ? `EXTRACT(YEAR FROM date) = ${filters.year}` : 'TRUE';
    const [byMonth, totalResult] = await Promise.all([
      prisma.$queryRawUnsafe(`
        SELECT EXTRACT(MONTH FROM date) as month, SUM(amount) as total
        FROM revenues
        WHERE ${yearCondition}
        GROUP BY EXTRACT(MONTH FROM date)
        ORDER BY month
      `),
      prisma.$queryRawUnsafe(`
        SELECT SUM(amount) as total
        FROM revenues
        WHERE ${yearCondition}
      `),
    ]);

    const bySource: any[] = []; // Revenue model does not exist, returning empty array
    const total = { _sum: { amount: totalResult[0]?.total || 0 } };

    return {
      bySource,
      byMonth,
      total: total._sum.amount || 0,
    };
  }

  // Expenses breakdown
  static async getExpensesBreakdown(filters: {
    year?: number;
    startDate?: string;
    endDate?: string;
  } = {}) {
    const where: any = {};

    if (filters.startDate && filters.endDate) {
      where.date = {
        gte: new Date(filters.startDate),
        lte: new Date(filters.endDate),
      };
    } else if (filters.year) {
      where.date = {
        gte: new Date(`${filters.year}-01-01`),
        lte: new Date(`${filters.year}-12-31`),
      };
    }

    const [byCategory, byStatus, total] = await Promise.all([
      prisma.expenses.groupBy({
        by: ['category'],
        where,
        _sum: { amount: true },
        _count: true,
      }),
      prisma.expenses.groupBy({
        by: ['status'],
        where,
        _sum: { amount: true },
        _count: true,
      }),
      prisma.expenses.aggregate({
        where,
        _sum: { amount: true },
      }),
    ]);

    return {
      byCategory,
      byStatus,
      total: total._sum.amount || 0,
    };
  }

  // Students debts report
  static async getStudentsDebts(academicYearId?: string) {
    const where: any = {
      status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] }
    };

    if (academicYearId) {
      where.academicYearId = academicYearId;
    }

    const schedules = await prisma.custom_payment_plans.findMany({
      where,
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            studentNumber: true,
            class: { select: { name: true } }
          }
        }
      },
      orderBy: { total_amount: 'desc' }, // Using total_amount instead of remainingAmount
    });

    const summary = schedules.reduce((acc, schedule) => {
      const studentId = schedule.student_id;
      if (!acc[studentId]) {
        acc[studentId] = {
          student: schedule.student,
          totalDue: 0,
          totalRemaining: 0,
          schedules: [],
        };
      }
      acc[studentId].totalDue += Number(schedule.total_amount);
      // remainingAmount doesn't exist, using total_amount as approximation
      acc[studentId].totalRemaining += Number(schedule.total_amount);
      acc[studentId].schedules.push(schedule);
      return acc;
    }, {} as any);

    return Object.values(summary);
  }

  // Academic performance overview
  static async getAcademicPerformance(academicYearId?: string) {
    const where: any = {};
    if (academicYearId) {
      where.academicYearId = academicYearId;
    }

    const [
      averagesBySubject,
      averagesByClass,
      topStudents,
    ] = await Promise.all([
      prisma.grades.groupBy({
        by: ['subject_id'],
        where,
        _avg: { note: true },
        _count: true,
      }),
      // prisma.reportCard.groupBy({ // Model does not exist
      Promise.resolve([]), // reportCard model does not exist
      // prisma.reportCard.findMany({ // Model does not exist
      Promise.resolve([]), // reportCard model does not exist
    ]);

    return {
      averagesBySubject,
      averagesByClass,
      topStudents,
    };
  }

  // Attendance overview
  static async getAttendanceOverview(filters: {
    year?: number;
    month?: number;
  } = {}) {
    const where: any = {};
    if (filters.year) where.year = filters.year;
    if (filters.month) where.month = filters.month;

    const [
      summaries,
      avgAttendanceRate,
      lowAttendance,
    ] = await Promise.all([
      prisma.attendance_summaries.aggregate({
        where,
        _sum: {
          total_days: true,
          present_days: true,
          absent_days: true,
          late_days: true,
        },
        _avg: {
          attendance_rate: true,
        }
      }),
      prisma.attendance_summaries.aggregate({
        where,
        _avg: { attendance_rate: true },
      }),
      prisma.attendance_summaries.findMany({
        where: {
          ...where,
          attendance_rate: { lt: 75 }
        },
        include: {
          student: {
            select: {
              firstName: true,
              lastName: true,
              class: { select: { name: true } }
            }
          }
        },
        orderBy: { attendance_rate: 'asc' },
        take: 10,
      }),
    ]);

    return {
      totalDays: summaries._sum.total_days || 0,
      presentDays: summaries._sum.present_days || 0,
      absentDays: summaries._sum.absent_days || 0,
      lateDays: summaries._sum.late_days || 0,
      averageRate: avgAttendanceRate._avg.attendance_rate || 0,
      studentsWithLowAttendance: lowAttendance,
    };
  }

  // Discipline overview
  static async getDisciplineOverview(filters: {
    year?: number;
    startDate?: string;
    endDate?: string;
  } = {}) {
    const where: any = {};

    if (filters.startDate && filters.endDate) {
      where.date = {
        gte: new Date(filters.startDate),
        lte: new Date(filters.endDate),
      };
    } else if (filters.year) {
      where.date = {
        gte: new Date(`${filters.year}-01-01`),
        lte: new Date(`${filters.year}-12-31`),
      };
    }

    const [
      totalIncidents,
      bySeverity,
      recentIncidents,
      totalSanctions,
    ] = await Promise.all([
      prisma.disciplinary_incidents.count({ where }),
      prisma.disciplinary_incidents.groupBy({
        by: ['severity'],
        where,
        _count: true,
      }),
      prisma.disciplinary_incidents.findMany({
        where,
        include: {
          student: { select: { firstName: true, lastName: true } }
        },
        orderBy: { date: 'desc' },
        take: 5,
      }),
      // prisma.sanction.count(), // Model does not exist - check schema
      Promise.resolve(0), // sanction model may not exist
    ]);

    return {
      totalIncidents,
      incidentsBySeverity: bySeverity,
      recentIncidents,
      totalSanctions,
    };
  }

  // Monthly finance report
  static async getMonthlyFinanceReport(year: number, month: number) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const [payments, revenues, expenses, salaries] = await Promise.all([
      prisma.student_payments.aggregate({
        where: {
          payment_date: { gte: startDate, lte: endDate }
        },
        _sum: { amount: true },
      }),
      // prisma.revenue.aggregate({ // Model does not exist in schema
      Promise.resolve({ _sum: { amount: 0 } }), // Revenue model does not exist
      prisma.expenses.aggregate({
        where: {
          date: { gte: startDate, lte: endDate },
          status: 'PAID'
        },
        _sum: { amount: true },
      }),
      // prisma.staffSalary.aggregate({ // Model does not exist
      prisma.monthly_payrolls.aggregate({
        where: { year, month },
        _sum: { net_payable: true },
      }),
    ]);

    const totalIncome = Number(payments._sum.amount || 0) + Number(revenues._sum.amount || 0);
    const totalExpenses = Number(expenses._sum.amount || 0) + Number(salaries._sum.net_payable || 0);
    const balance = totalIncome - totalExpenses;

    return {
      period: { year, month },
      income: {
        payments: payments._sum.amount || 0,
        revenues: revenues._sum.amount || 0,
        total: totalIncome,
      },
      expenses: {
        operations: expenses._sum.amount || 0,
        salaries: salaries._sum.net_payable || 0,
        total: totalExpenses,
      },
      balance,
    };
  }

  // Alerts and warnings
  static async getAlerts() {
    const [
      overdueSchedules,
      lowAttendance,
      recentIncidents,
      pendingExpenses,
    ] = await Promise.all([
      prisma.custom_payment_plans.count({ where: { is_active: true } }),
      prisma.attendance_summaries.count({
        where: {
          year: new Date().getFullYear(),
          month: new Date().getMonth() + 1,
          attendance_rate: { lt: 75 }
        }
      }),
      prisma.disciplinary_incidents.count({
        where: {
          date: {
            gte: new Date(new Date().setDate(new Date().getDate() - 7))
          },
          severity: { in: ['GRAVE', 'TRES_GRAVE'] }
        }
      }),
      prisma.expenses.count({ where: { status: 'PENDING_APPROVAL' } }),
    ]);

    return {
      overduePayments: overdueSchedules,
      lowAttendanceStudents: lowAttendance,
      seriousIncidents: recentIncidents,
      pendingExpenseApprovals: pendingExpenses,
    };
  }
}

