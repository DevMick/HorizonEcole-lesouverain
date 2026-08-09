import { Router } from 'express';
import { z } from 'zod';
import schoolFeeRateService from '../services/schoolFeeRate.service';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validate } from '../middleware/validate';

const router = Router();

// Validation schemas
const createSchoolFeeRateSchema = z.object({
  body: z.object({
    classId: z.string().uuid(),
    details: z.array(z.object({
      paymentTypeId: z.string().uuid(),
      amount: z.number().min(0),
    })).min(1, 'At least one payment type is required'),
    isForStateAssigned: z.boolean().optional(),
  }),
});

const updateSchoolFeeRateSchema = z.object({
  body: z.object({
    classId: z.string().uuid().optional(),
    details: z.array(z.object({
      paymentTypeId: z.string().uuid(),
      amount: z.number().min(0),
    })).min(1, 'At least one payment type is required').optional(),
    isForStateAssigned: z.boolean().optional(),
  }),
});

// Get all school fee rates (with optional filters)
router.get(
  '/',
  authenticate,
  requireRole('ADMIN', 'COMPTABLE'),
  async (req, res, next) => {
    try {
      const { classId } = req.query;
      const filters: { classId?: string } = {};
      
      if (classId && typeof classId === 'string') {
        filters.classId = classId;
      }
      
      const rates = await schoolFeeRateService.getAll(filters);
      res.json({
        success: true,
        data: rates,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get current academic year
router.get(
  '/current-year',
  authenticate,
  requireRole('ADMIN', 'COMPTABLE'),
  async (req, res, next) => {
    try {
      const currentYear = await schoolFeeRateService.getCurrentAcademicYear();
      res.json({
        success: true,
        data: currentYear,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get school fee rates by class
router.get(
  '/class/:classId',
  authenticate,
  requireRole('ADMIN', 'COMPTABLE'),
  async (req, res, next) => {
    try {
      const { classId } = req.params;
      const rates = await schoolFeeRateService.getByClass(classId);
      res.json({
        success: true,
        data: rates,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get single school fee rate
router.get(
  '/:id',
  authenticate,
  requireRole('ADMIN', 'COMPTABLE'),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const rate = await schoolFeeRateService.getById(id);

      if (!rate) {
        return res.status(404).json({
          success: false,
          error: 'School fee rate not found',
        });
      }

      res.json({
        success: true,
        data: rate,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Create school fee rate
router.post(
  '/',
  authenticate,
  requireRole('ADMIN', 'COMPTABLE'),
  validate(createSchoolFeeRateSchema),
  async (req, res, next) => {
    try {
      const rate = await schoolFeeRateService.create(req.body);
      res.status(201).json({
        success: true,
        data: rate,
        message: 'School fee rate created successfully',
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        return res.status(400).json({
          success: false,
          error: 'Un tarif existe déjà pour cette classe',
        });
      }
      next(error);
    }
  }
);

// Update school fee rate
router.patch(
  '/:id',
  authenticate,
  requireRole('ADMIN', 'COMPTABLE'),
  validate(updateSchoolFeeRateSchema),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const rate = await schoolFeeRateService.update(id, req.body);
      res.json({
        success: true,
        data: rate,
        message: 'School fee rate updated successfully',
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        return res.status(400).json({
          success: false,
          error: 'Un tarif existe déjà pour cette classe',
        });
      }
      if (error.code === 'P2025') {
        return res.status(404).json({
          success: false,
          error: 'School fee rate not found',
        });
      }
      next(error);
    }
  }
);

// Delete school fee rate
router.delete(
  '/:id',
  authenticate,
  requireRole('ADMIN'),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      await schoolFeeRateService.delete(id);
      res.json({
        success: true,
        message: 'School fee rate deleted successfully',
      });
    } catch (error: any) {
      if (error.code === 'P2025') {
        return res.status(404).json({
          success: false,
          error: 'School fee rate not found',
        });
      }
      next(error);
    }
  }
);

export default router;

