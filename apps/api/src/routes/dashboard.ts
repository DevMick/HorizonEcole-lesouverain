import { Router } from 'express';

import { prisma } from '@school/database';
import { authenticate } from '../middleware/auth';

const router = Router();

// Get dashboard statistics
router.get('/stats', authenticate, async (req, res) => {
  try {
    const [
      totalStudents,
      activeStudents,
      totalTeachers,
      totalClasses,
      totalRevenue,
      monthlyRevenue,
      pendingPayments,
    ] = await Promise.all([
      // Total students
      prisma.student.count(),
      
      // Active students
      prisma.student.count({
        where: { status: 'ACTIVE' },
      }),
      
      // Total teachers
      prisma.user.count({
        where: { role: 'TEACHER' },
      }),
      
      // Total classes
      prisma.schoolClass.count(),
      
      // Total revenue (all time)
      prisma.student_payments.aggregate({
        _sum: { amount: true },
      }),
      
      // Monthly revenue (current month)
      prisma.student_payments.aggregate({
        where: {
          payment_date: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
            lt: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1),
          },
        },
        _sum: { amount: true },
      }),
      
      // Pending payments (students with unpaid fees)
      prisma.student.count({
        where: {
          studentPayments: {
            none: {},
          },
        },
      }),
    ]);

    res.json({
      success: true,
      data: {
        totalStudents,
        activeStudents,
        totalTeachers,
        totalClasses,
        totalRevenue: totalRevenue._sum.amount || 0,
        monthlyRevenue: monthlyRevenue._sum.amount || 0,
        pendingPayments,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
  }
});

// Get recent activities
router.get('/activities', authenticate, async (req, res) => {
  try {
    const [recentStudents, recentPayments, recentGrades] = await Promise.all([
      // Recent students
      prisma.student.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          studentNumber: true,
          createdAt: true,
        },
      }),
      
      // Recent payments
      prisma.student_payments.findMany({
        take: 5,
        orderBy: { payment_date: 'desc' },
        select: {
          id: true,
          amount: true,
          payment_date: true,
          payment_method: true,
          receipt_number: true,
          student: {
            select: { firstName: true, lastName: true, studentNumber: true },
          },
        },
      }),
      
      // Recent grades
      prisma.grades.findMany({
        take: 5,
        orderBy: { created_at: 'desc' },
        select: {
          id: true,
          note: true,
          max_note: true,
          created_at: true,
          student: {
            select: { firstName: true, lastName: true, studentNumber: true },
          },
          subject: {
            select: { name: true },
          },
        },
      }),
    ]);

    res.json({
      success: true,
      data: {
        recentStudents,
        recentPayments,
        recentGrades,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch recent activities' });
  }
});

export default router;
