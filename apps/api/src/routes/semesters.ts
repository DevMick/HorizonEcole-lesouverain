import { Router } from 'express';
import { z } from 'zod';
import { SemesterService } from '../services/semester.service';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validate } from '../middleware/validate';

const router = Router();

// Validation schemas
const createSemesterSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Le nom est obligatoire').max(100, 'Le nom ne peut pas dépasser 100 caractères'),
    startDate: z.string().or(z.date()).transform((val) => {
      if (typeof val === 'string') {
        return new Date(val);
      }
      return val;
    }),
    endDate: z.string().or(z.date()).transform((val) => {
      if (typeof val === 'string') {
        return new Date(val);
      }
      return val;
    }),
    academicYearId: z.string().min(1, 'L\'année académique est obligatoire'),
  }).refine((data) => {
    const startDate = typeof data.startDate === 'string' ? new Date(data.startDate) : data.startDate;
    const endDate = typeof data.endDate === 'string' ? new Date(data.endDate) : data.endDate;
    return startDate < endDate;
  }, {
    message: 'La date de début doit être antérieure à la date de fin',
    path: ['endDate'],
  }),
});

const updateSemesterSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100).optional(),
    startDate: z.string().or(z.date()).transform((val) => {
      if (typeof val === 'string') {
        return new Date(val);
      }
      return val;
    }).optional(),
    endDate: z.string().or(z.date()).transform((val) => {
      if (typeof val === 'string') {
        return new Date(val);
      }
      return val;
    }).optional(),
    academicYearId: z.string().min(1).optional(),
  }),
});

// Get all semesters
router.get(
  '/',
  authenticate,
  async (req, res, next) => {
    try {
      const { academicYearId } = req.query;

      const semesters = await SemesterService.getAll({
        academicYearId: academicYearId as string,
      });

      res.json({
        success: true,
        data: semesters,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get semester by ID
router.get(
  '/:id',
  authenticate,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const semester = await SemesterService.getById(id);

      if (!semester) {
        return res.status(404).json({
          success: false,
          error: 'Semestre non trouvé',
        });
      }

      res.json({
        success: true,
        data: semester,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Create a new semester
router.post(
  '/',
  authenticate,
  requireRole('ADMIN'),
  validate(createSemesterSchema),
  async (req, res, next) => {
    try {
      const semester = await SemesterService.create(req.body);

      res.status(201).json({
        success: true,
        data: semester,
        message: 'Semestre créé avec succès',
      });
    } catch (error: any) {
      if (error.message.includes('non trouvé') || error.message.includes('se chevauchent') || error.message.includes('antérieure')) {
        return res.status(400).json({
          success: false,
          error: error.message,
        });
      }
      next(error);
    }
  }
);

// Update a semester
router.patch(
  '/:id',
  authenticate,
  requireRole('ADMIN'),
  validate(updateSemesterSchema),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const semester = await SemesterService.update(id, req.body);

      res.json({
        success: true,
        data: semester,
        message: 'Semestre modifié avec succès',
      });
    } catch (error: any) {
      if (error.message.includes('non trouvé') || error.message.includes('se chevauchent') || error.message.includes('antérieure')) {
        return res.status(400).json({
          success: false,
          error: error.message,
        });
      }
      next(error);
    }
  }
);

// Delete a semester
router.delete(
  '/:id',
  authenticate,
  requireRole('ADMIN'),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      await SemesterService.delete(id);

      res.json({
        success: true,
        message: 'Semestre supprimé avec succès',
      });
    } catch (error: any) {
      if (error.message.includes('non trouvé')) {
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

