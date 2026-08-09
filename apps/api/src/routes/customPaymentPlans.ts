import { Router } from 'express';
import { z } from 'zod';
import { CustomPaymentPlanService, createCustomPaymentPlanSchema, updateCustomPaymentPlanSchema } from '../services/customPaymentPlan.service';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validate } from '../middleware/validate';

const router = Router();

// Validation schemas
const createCustomPaymentPlanRouteSchema = z.object({
  body: createCustomPaymentPlanSchema,
});

const updateCustomPaymentPlanRouteSchema = z.object({
  body: updateCustomPaymentPlanSchema,
});

// Get all custom payment plans with filters
router.get(
  '/',
  authenticate,
  requireRole('ADMIN', 'COMPTABLE'),
  async (req, res, next) => {
    try {
      const {
        studentId,
        academicYearId,
        isActive,
        page,
        limit,
      } = req.query;

      const result = await CustomPaymentPlanService.getAll({
        studentId: studentId as string,
        academicYearId: academicYearId as string,
        isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
      });

      res.json({
        success: true,
        data: result.plans,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get custom payment plan by ID
router.get(
  '/:id',
  authenticate,
  requireRole('ADMIN', 'COMPTABLE'),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const plan = await CustomPaymentPlanService.getById(id);

      if (!plan) {
        return res.status(404).json({
          success: false,
          error: 'Custom payment plan not found',
        });
      }

      res.json({
        success: true,
        data: plan,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get custom payment plan by student and academic year
router.get(
  '/student/:studentId/academic-year/:academicYearId',
  authenticate,
  requireRole('ADMIN', 'COMPTABLE'),
  async (req, res, next) => {
    try {
      const { studentId, academicYearId } = req.params;
      const plan = await CustomPaymentPlanService.getByStudentAndAcademicYear(studentId, academicYearId);

      if (!plan) {
        return res.status(404).json({
          success: false,
          error: 'Custom payment plan not found',
        });
      }

      res.json({
        success: true,
        data: plan,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Create a new custom payment plan
router.post(
  '/',
  authenticate,
  requireRole('ADMIN', 'COMPTABLE'),
  validate(createCustomPaymentPlanRouteSchema),
  async (req, res, next) => {
    try {
      const userId = (req as any).user.userId;
      const plan = await CustomPaymentPlanService.create(req.body, userId);

      res.status(201).json({
        success: true,
        data: plan,
        message: 'Custom payment plan created successfully',
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        return res.status(400).json({
          success: false,
          error: 'A custom payment plan already exists for this student and academic year',
        });
      }
      if (error.message.includes('not found') || error.message.includes('must match')) {
        return res.status(400).json({
          success: false,
          error: error.message,
        });
      }
      next(error);
    }
  }
);

// Update a custom payment plan
router.patch(
  '/:id',
  authenticate,
  requireRole('ADMIN', 'COMPTABLE'),
  validate(updateCustomPaymentPlanRouteSchema),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = (req as any).user.userId;
      const plan = await CustomPaymentPlanService.update(id, req.body, userId);

      res.json({
        success: true,
        data: plan,
        message: 'Custom payment plan updated successfully',
      });
    } catch (error: any) {
      if (error.message.includes('not found') || error.message.includes('must match')) {
        return res.status(400).json({
          success: false,
          error: error.message,
        });
      }
      next(error);
    }
  }
);

// Delete a custom payment plan
router.delete(
  '/:id',
  authenticate,
  requireRole('ADMIN', 'COMPTABLE'),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      await CustomPaymentPlanService.delete(id);

      res.json({
        success: true,
        message: 'Custom payment plan deleted successfully',
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

export default router;

