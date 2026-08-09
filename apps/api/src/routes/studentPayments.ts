import { Router } from 'express';
import { z } from 'zod';
import StudentPaymentService from '../services/studentPayment.service';
import { PDFService } from '../services/pdf.service';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import path from 'path';
import fs from 'fs';

const router = Router();

// Validation schemas
const createStudentPaymentSchema = z.object({
  body: z.object({
    studentId: z.string().uuid(),
    academicYearId: z.string().uuid(),
    schoolFeeRateDetailId: z.string().uuid(),
    amount: z.number().positive(),
    paymentDate: z.string(),
    paymentMethod: z.enum(['CASH', 'CHEQUE', 'VIREMENT', 'MOBILE_MONEY', 'CARTE']),
    reference: z.string().optional(),
    notes: z.string().optional(),
  }),
});

const updateStudentPaymentSchema = z.object({
  body: z.object({
    amount: z.number().positive().optional(),
    paymentDate: z.string().optional(),
    paymentMethod: z.enum(['CASH', 'CHEQUE', 'VIREMENT', 'MOBILE_MONEY', 'CARTE']).optional(),
    reference: z.string().optional(),
    notes: z.string().optional(),
    status: z.enum(['PENDING', 'PARTIAL', 'PAID', 'OVERDUE', 'CANCELLED']).optional(),
  }),
});

// Get all student payments with filters
router.get(
  '/',
  authenticate,
  requireRole('ADMIN', 'COMPTABLE'),
  async (req, res, next) => {
    try {
      const {
        studentId,
        academicYearId,
        classId,
        status,
        paymentTypeId,
        page,
        limit,
      } = req.query;

      const result = await StudentPaymentService.getAll({
        studentId: studentId as string,
        academicYearId: academicYearId as string,
        classId: classId as string,
        status: status as string,
        paymentTypeId: paymentTypeId as string,
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
      });

      res.json({
        success: true,
        data: result.payments,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get payment by ID
router.get(
  '/:id',
  authenticate,
  requireRole('ADMIN', 'COMPTABLE'),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const payment = await StudentPaymentService.getById(id);

      if (!payment) {
        return res.status(404).json({
          success: false,
          error: 'Payment not found',
        });
      }

      res.json({
        success: true,
        data: payment,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get student payment status for an academic year
router.get(
  '/student/:studentId/academic-year/:academicYearId/status',
  authenticate,
  requireRole('ADMIN', 'COMPTABLE'),
  async (req, res, next) => {
    try {
      const { studentId, academicYearId } = req.params;
      const status = await StudentPaymentService.getStudentPaymentStatus(
        studentId,
        academicYearId
      );

      res.json({
        success: true,
        data: status,
      });
    } catch (error: any) {
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

// Find or create school fee rate detail for a payment type (for custom payment plans)
router.post(
  '/find-or-create-fee-rate-detail',
  authenticate,
  requireRole('ADMIN', 'COMPTABLE'),
  async (req, res, next) => {
    try {
      const { paymentTypeId, studentClassId, expectedAmount } = req.body;

      if (!paymentTypeId || !studentClassId) {
        return res.status(400).json({
          success: false,
          error: 'paymentTypeId and studentClassId are required',
        });
      }

      const schoolFeeRateDetailId = await StudentPaymentService.findOrCreateSchoolFeeRateDetail(
        paymentTypeId,
        studentClassId,
        expectedAmount
      );

      res.json({
        success: true,
        data: { schoolFeeRateDetailId },
      });
    } catch (error: any) {
      next(error);
    }
  }
);

// Create a new student payment
router.post(
  '/',
  authenticate,
  requireRole('ADMIN', 'COMPTABLE'),
  validate(createStudentPaymentSchema),
  async (req, res, next) => {
    try {
      const userId = (req as any).user.userId;
      const payment = await StudentPaymentService.create(req.body, userId);

      res.status(201).json({
        success: true,
        data: payment,
        message: 'Payment recorded successfully',
      });
    } catch (error: any) {
      if (error.message.includes('not found') || error.message.includes('mismatch')) {
        return res.status(400).json({
          success: false,
          error: error.message,
        });
      }
      if (error.code === 'P2002') {
        return res.status(400).json({
          success: false,
          error: 'Payment already exists for this payment type',
        });
      }
      next(error);
    }
  }
);

// Update a student payment
router.patch(
  '/:id',
  authenticate,
  requireRole('ADMIN', 'COMPTABLE'),
  validate(updateStudentPaymentSchema),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = (req as any).user.userId;
      const payment = await StudentPaymentService.update(id, req.body, userId);

      res.json({
        success: true,
        data: payment,
        message: 'Payment updated successfully',
      });
    } catch (error: any) {
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

// Delete a student payment
router.delete(
  '/:id',
  authenticate,
  requireRole('ADMIN', 'COMPTABLE'),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      await StudentPaymentService.delete(id);

      res.json({
        success: true,
        message: 'Payment deleted successfully',
      });
    } catch (error: any) {
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

// Generate payment receipt PDF
router.post(
  '/:id/generate-receipt',
  authenticate,
  requireRole('ADMIN', 'COMPTABLE'),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const pdfUrl = await PDFService.generatePaymentReceipt(id);

      res.json({
        success: true,
        data: { pdfUrl },
        message: 'Payment receipt generated successfully',
      });
    } catch (error: any) {
      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          error: error.message,
        });
      }
      console.error('Error generating payment receipt:', error);
      next(error);
    }
  }
);

// Get payment receipt Word document
router.get(
  '/:id/receipt',
  authenticate,
  requireRole('ADMIN', 'COMPTABLE'),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const docUrl = await PDFService.generatePaymentReceipt(id);
      const filePath = path.join(process.cwd(), docUrl);

      if (!fs.existsSync(filePath)) {
        console.error(`Word document not found at: ${filePath}`);
        return res.status(404).json({
          success: false,
          error: 'Receipt file not found',
          details: `Expected path: ${filePath}`,
        });
      }

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `inline; filename="receipt-${id}.docx"`);
      fs.createReadStream(filePath).pipe(res);
    } catch (error: any) {
      console.error('Error generating/serving payment receipt:', error);
      if (error.message.includes('not found') || error.message.includes('Template file')) {
        return res.status(404).json({
          success: false,
          error: error.message,
        });
      }
      if (error.message.includes('LibreOffice') || error.message.includes('PDF conversion')) {
        return res.status(500).json({
          success: false,
          error: error.message,
        });
      }
      next(error);
    }
  }
);

// Get payment receipt PDF document (generated directly with HTML + Puppeteer)
router.get(
  '/:id/receipt-pdf',
  authenticate,
  requireRole('ADMIN', 'COMPTABLE'),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      // Use the new direct PDF generation method (HTML + Puppeteer)
      const pdfUrl = await PDFService.generateStudentPaymentReceiptPDFDirect(id);
      const filePath = path.join(process.cwd(), pdfUrl);

      if (!fs.existsSync(filePath)) {
        console.error(`PDF document not found at: ${filePath}`);
        return res.status(404).json({
          success: false,
          error: 'Receipt PDF file not found',
          details: `Expected path: ${filePath}`,
        });
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="receipt-${id}.pdf"`);
      fs.createReadStream(filePath).pipe(res);
    } catch (error: any) {
      console.error('Error generating/serving payment receipt PDF:', error);
      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          error: error.message,
        });
      }
      if (error.message.includes('Failed to generate') || error.message.includes('Puppeteer')) {
        return res.status(500).json({
          success: false,
          error: error.message,
        });
      }
      next(error);
    }
  }
);

export default router;

