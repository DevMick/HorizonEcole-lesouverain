import { Router } from 'express';
import { PayrollService } from '../services/payroll.service';
import { PDFService } from '../services/pdf.service';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { UserRole } from '@school/types';
import { prisma } from '@school/database';
import fs from 'fs';
import path from 'path';

const router = Router();

// Get payroll settings
router.get(
  '/settings',
  authenticate,
  requireRole(UserRole.ADMIN, UserRole.ACCOUNTANT),
  async (req, res, next) => {
    try {
      const settings = await PayrollService.getSettings();
      
      res.json({
        success: true,
        data: settings,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Update payroll settings
router.put(
  '/settings',
  authenticate,
  requireRole(UserRole.ADMIN),
  async (req, res, next) => {
    try {
      const settings = await PayrollService.updateSettings(req.body);
      
      res.json({
        success: true,
        data: settings,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Generate payrolls
router.post(
  '/generate',
  authenticate,
  requireRole(UserRole.ADMIN, UserRole.ACCOUNTANT),
  async (req, res, next) => {
    try {
      const user = (req as any).user;
      const result = await PayrollService.generatePayrolls(req.body, user.id);
      
      res.json({
        success: true,
        data: result.results,
        errors: result.errors,
        message: `${result.results.length} paie(s) générée(s) avec succès${result.errors.length > 0 ? `, ${result.errors.length} erreur(s)` : ''}`,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get payrolls with filters
router.get(
  '/',
  authenticate,
  requireRole(UserRole.ADMIN, UserRole.ACCOUNTANT),
  async (req, res, next) => {
    try {
      const {
        month,
        year,
        teacherId,
        status,
        page,
        limit,
      } = req.query;
      
      const result = await PayrollService.getPayrolls({
        month: month ? parseInt(month as string) : undefined,
        year: year ? parseInt(year as string) : undefined,
        teacherId: teacherId as string,
        status: status as string,
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
      });
      
      res.json({
        success: true,
        data: result.payrolls,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get payroll by ID
router.get(
  '/:id',
  authenticate,
  requireRole(UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.TEACHER),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const user = (req as any).user;
      
      // If teacher, check if it's their own payroll
      if (user.role === UserRole.TEACHER) {
        const teacher = await prisma.teachers.findUnique({
          where: { user_id: user.id },
        });
        
        if (teacher) {
          const payroll = await PayrollService.getPayrollById(id);
          
          if (payroll && payroll.teacher_id !== teacher.id) {
            return res.status(403).json({
              success: false,
              error: 'Accès non autorisé',
            });
          }
        }
      }
      
      const payroll = await PayrollService.getPayrollById(id);
      
      if (!payroll) {
        return res.status(404).json({
          success: false,
          error: 'Paie non trouvée',
        });
      }
      
      res.json({
        success: true,
        data: payroll,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Validate a payroll
router.post(
  '/:id/validate',
  authenticate,
  requireRole(UserRole.ADMIN, UserRole.ACCOUNTANT),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const user = (req as any).user;
      
      const payroll = await PayrollService.validatePayroll(id, user.id);
      
      res.json({
        success: true,
        data: payroll,
        message: 'Paie validée avec succès',
      });
    } catch (error) {
      next(error);
    }
  }
);

// Record a payment
router.post(
  '/:id/payments',
  authenticate,
  requireRole(UserRole.ADMIN, UserRole.ACCOUNTANT),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const user = (req as any).user;
      
      const payment = await PayrollService.recordPayment({
        ...req.body,
        payrollId: id,
      }, user.id);
      
      res.json({
        success: true,
        data: payment,
        message: 'Paiement enregistré avec succès',
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get teacher's payrolls (for teacher role)
const getTeacherPayrolls = async (req: any, res: any, next: any) => {
  try {
    const user = (req as any).user;
    const { month, year } = req.query;
    
    const teacher = await prisma.teachers.findUnique({
      where: { user_id: user.id },
    });
    
    if (!teacher) {
      return res.status(404).json({
        success: false,
        error: 'Enseignant non trouvé',
      });
    }
    
    const result = await PayrollService.getPayrolls({
      teacherId: teacher.id,
      month: month ? parseInt(month as string) : undefined,
      year: year ? parseInt(year as string) : undefined,
    });
    
    res.json({
      success: true,
      data: result.payrolls,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
};

router.get(
  '/teacher/me',
  authenticate,
  requireRole(UserRole.TEACHER),
  getTeacherPayrolls
);

// Alias route for frontend compatibility
router.get(
  '/teacher/my-payrolls',
  authenticate,
  requireRole(UserRole.TEACHER),
  getTeacherPayrolls
);

// Create an advance payment
router.post(
  '/advances',
  authenticate,
  requireRole(UserRole.ADMIN, UserRole.ACCOUNTANT),
  async (req, res, next) => {
    try {
      const user = (req as any).user;
      const advance = await PayrollService.createAdvance(req.body, user.id);
      
      res.json({
        success: true,
        data: advance,
        message: 'Acompte créé avec succès',
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get advances for a teacher
router.get(
  '/advances/teacher/:teacherId',
  authenticate,
  requireRole(UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.TEACHER),
  async (req, res, next) => {
    try {
      const { teacherId } = req.params;
      const { deducted } = req.query;
      
      const advances = await PayrollService.getAdvances(
        teacherId,
        deducted !== undefined ? deducted === 'true' : undefined
      );
      
      res.json({
        success: true,
        data: advances,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get payroll PDF
router.get(
  '/:id/pdf',
  authenticate,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;
      const userRole = (req as any).user?.role;

      // Fetch payroll to check permissions
      const payroll = await prisma.monthly_payrolls.findUnique({
        where: { id },
        include: {
          teacher: {
            select: {
              id: true,
              user_id: true,
            },
          },
        },
      });

      if (!payroll) {
        return res.status(404).json({
          success: false,
          error: 'Payroll not found',
        });
      }

      // Check permissions: teacher can only access their own payrolls, admin/accountant can access all
      if (userRole !== UserRole.ADMIN && userRole !== UserRole.ACCOUNTANT) {
        if (payroll.teacher.user_id !== userId) {
          return res.status(403).json({
            success: false,
            error: 'Access denied',
          });
        }
      }

      // Only generate PDF for validated or paid payrolls (unless admin)
      if (userRole !== UserRole.ADMIN && payroll.status !== 'VALIDATED' && payroll.status !== 'PAID') {
        return res.status(400).json({
          success: false,
          error: 'Payroll must be validated before generating PDF',
        });
      }

      // Generate PDF
      const pdfPath = await PDFService.generatePayrollSlipPDF(id);
      const filePath = path.join(process.cwd(), pdfPath);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({
          success: false,
          error: 'PDF file not found',
        });
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="bulletin-paie-${id}.pdf"`);
      fs.createReadStream(filePath).pipe(res);
    } catch (error: any) {
      console.error('Error generating payroll PDF:', error);
      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          error: error.message,
        });
      }
      next(error);
    }
  }
);

// Get payment receipt PDF for a payroll (uses the latest payment)
router.get(
  '/:id/payment-receipt',
  authenticate,
  requireRole(UserRole.ADMIN, UserRole.ACCOUNTANT),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const userRole = (req as any).user?.role;

      // Fetch payroll to check if it exists and is validated/paid
      const payroll = await prisma.monthly_payrolls.findUnique({
        where: { id },
        include: {
          payments: {
            orderBy: { payment_date: 'desc' },
            take: 1,
          },
        },
      });

      if (!payroll) {
        return res.status(404).json({
          success: false,
          error: 'Payroll not found',
        });
      }

      // Check if payroll is validated or paid
      if (payroll.status !== 'VALIDATED' && payroll.status !== 'PAID') {
        return res.status(400).json({
          success: false,
          error: 'Payroll must be validated before generating payment receipt',
        });
      }

      // Generate receipt PDF - use payment if exists, otherwise generate from payroll
      let pdfPath: string;
      if (payroll.payments && payroll.payments.length > 0) {
        // Use the latest payment
        const latestPayment = payroll.payments[0];
        pdfPath = await PDFService.generatePayrollPaymentReceipt(latestPayment.id);
      } else {
        // Generate receipt directly from payroll (no payment recorded yet)
        const user = (req as any).user;
        pdfPath = await PDFService.generatePayrollPaymentReceiptFromPayroll(id, user);
      }

      const filePath = path.join(process.cwd(), pdfPath);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({
          success: false,
          error: 'Receipt PDF file not found',
        });
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="receipt-payroll-${id}.pdf"`);
      fs.createReadStream(filePath).pipe(res);
    } catch (error: any) {
      console.error('Error generating payment receipt PDF:', error);
      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          error: error.message,
        });
      }
      next(error);
    }
  }
);

export default router;

