import { Router } from 'express';
import { z } from 'zod';
import { ClassAssignmentService, createAssignmentSchema, updateAssignmentSchema } from '../services/classAssignment.service';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validate } from '../middleware/validate';

const router = Router();

// Validation schemas
const createAssignmentRouteSchema = z.object({
  body: createAssignmentSchema,
});

const updateAssignmentRouteSchema = z.object({
  body: updateAssignmentSchema,
});

// Get all assignments
router.get(
  '/',
  authenticate,
  requireRole('ADMIN', 'COMPTABLE'),
  async (req, res, next) => {
    try {
      const {
        teacherId,
        classId,
        page,
        limit,
        search,
      } = req.query;

      const result = await ClassAssignmentService.getAll({
        teacherId: teacherId as string,
        classId: classId as string,
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        search: search as string,
      });

      res.json({
        success: true,
        data: result.assignments,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get all teachers with their classes
router.get(
  '/teachers',
  authenticate,
  requireRole('ADMIN', 'COMPTABLE'),
  async (req, res, next) => {
    try {
      const {
        page,
        limit,
        search,
      } = req.query;

      const result = await ClassAssignmentService.getTeachersWithClasses({
        academicYearId: req.query.academicYearId as string,
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        search: search as string,
      });

      res.json({
        success: true,
        data: result.teachers,
        pagination: result.pagination,
        total: result.pagination.total,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get assignments by teacher ID
router.get(
  '/teacher/:teacherId',
  authenticate,
  requireRole('ADMIN', 'COMPTABLE'),
  async (req, res, next) => {
    try {
      const { teacherId } = req.params;
      const { academicYearId } = req.query;
      const assignments = await ClassAssignmentService.getByTeacherId(teacherId, academicYearId as string);

      res.json({
        success: true,
        data: assignments,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get assignments by class ID
router.get(
  '/class/:classId',
  authenticate,
  requireRole('ADMIN', 'COMPTABLE'),
  async (req, res, next) => {
    try {
      const { classId } = req.params;
      const { academicYearId } = req.query;
      const assignments = await ClassAssignmentService.getByClassId(classId, academicYearId as string);

      res.json({
        success: true,
        data: assignments,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Create assignments for a teacher
router.post(
  '/',
  authenticate,
  requireRole('ADMIN'),
  validate(createAssignmentRouteSchema),
  async (req, res, next) => {
    try {
      const { teacherId, assignments, academicYearId } = req.body;
      const result = await ClassAssignmentService.createAssignments(teacherId, assignments, academicYearId);

      res.status(201).json({
        success: true,
        data: result,
        message: 'Affectations créées avec succès',
      });
    } catch (error: any) {
      if (error.message.includes('non trouvé') || error.message.includes('n\'existent pas')) {
        return res.status(400).json({
          success: false,
          error: error.message,
        });
      }
      next(error);
    }
  }
);

// Update assignments for a teacher (replace all)
router.patch(
  '/teacher/:teacherId',
  authenticate,
  requireRole('ADMIN'),
  validate(updateAssignmentRouteSchema),
  async (req, res, next) => {
    try {
      const { teacherId } = req.params;
      const { assignments, academicYearId } = req.body;
      const result = await ClassAssignmentService.updateAssignments(teacherId, assignments, academicYearId);

      res.json({
        success: true,
        data: result,
        message: 'Affectations mises à jour avec succès',
      });
    } catch (error: any) {
      if (error.message.includes('non trouvé') || error.message.includes('n\'existent pas')) {
        return res.status(400).json({
          success: false,
          error: error.message,
        });
      }
      next(error);
    }
  }
);

// Delete an assignment
router.delete(
  '/:id',
  authenticate,
  requireRole('ADMIN'),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      await ClassAssignmentService.deleteAssignment(id);

      res.json({
        success: true,
        message: 'Affectation supprimée avec succès',
      });
    } catch (error: any) {
      if (error.message.includes('non trouvée')) {
        return res.status(404).json({
          success: false,
          error: error.message,
        });
      }
      next(error);
    }
  }
);

// Delete all assignments for a teacher
router.delete(
  '/teacher/:teacherId',
  authenticate,
  requireRole('ADMIN'),
  async (req, res, next) => {
    try {
      const { teacherId } = req.params;
      await ClassAssignmentService.deleteAllByTeacher(teacherId);

      res.json({
        success: true,
        message: 'Toutes les affectations ont été supprimées avec succès',
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;

