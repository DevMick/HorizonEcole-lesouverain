import { Router } from 'express';
import { TeacherRemunerationService } from '../services/teacher-remuneration.service';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { UserRole } from '@school/types';

const router = Router();

// Get remuneration for a teacher
router.get(
  '/:teacherId',
  authenticate,
  requireRole(UserRole.ADMIN, UserRole.ACCOUNTANT),
  async (req, res, next) => {
    try {
      const { teacherId } = req.params;
      const remuneration = await TeacherRemunerationService.getOrCreateRemuneration(teacherId);
      
      res.json({
        success: true,
        data: remuneration,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Update remuneration for a teacher
router.put(
  '/:teacherId',
  authenticate,
  requireRole(UserRole.ADMIN, UserRole.ACCOUNTANT),
  async (req, res, next) => {
    try {
      const { teacherId } = req.params;
      const remuneration = await TeacherRemunerationService.updateRemuneration(teacherId, req.body);
      
      res.json({
        success: true,
        data: remuneration,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get allowances for a teacher
router.get(
  '/:teacherId/allowances',
  authenticate,
  requireRole(UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.TEACHER),
  async (req, res, next) => {
    try {
      const { teacherId } = req.params;
      const { isRecurring, effectiveDate } = req.query;
      
      const filters: any = {};
      if (isRecurring !== undefined) {
        filters.isRecurring = isRecurring === 'true';
      }
      if (effectiveDate) {
        filters.effectiveDate = new Date(effectiveDate as string);
      }
      
      const allowances = await TeacherRemunerationService.getAllowances(teacherId, filters);
      
      res.json({
        success: true,
        data: allowances,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Create an allowance
router.post(
  '/:teacherId/allowances',
  authenticate,
  requireRole(UserRole.ADMIN, UserRole.ACCOUNTANT),
  async (req, res, next) => {
    try {
      const { teacherId } = req.params;
      const allowance = await TeacherRemunerationService.createAllowance({
        ...req.body,
        teacherId,
      });
      
      res.json({
        success: true,
        data: allowance,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Update an allowance
router.put(
  '/allowances/:id',
  authenticate,
  requireRole(UserRole.ADMIN, UserRole.ACCOUNTANT),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const allowance = await TeacherRemunerationService.updateAllowance(id, req.body);
      
      res.json({
        success: true,
        data: allowance,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Delete an allowance
router.delete(
  '/allowances/:id',
  authenticate,
  requireRole(UserRole.ADMIN, UserRole.ACCOUNTANT),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      await TeacherRemunerationService.deleteAllowance(id);
      
      res.json({
        success: true,
        message: 'Prime/indemnité supprimée avec succès',
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get teacher with remuneration data
router.get(
  '/:teacherId/full',
  authenticate,
  requireRole(UserRole.ADMIN, UserRole.ACCOUNTANT),
  async (req, res, next) => {
    try {
      const { teacherId } = req.params;
      const teacher = await TeacherRemunerationService.getTeacherWithRemuneration(teacherId);
      
      if (!teacher) {
        return res.status(404).json({
          success: false,
          error: 'Enseignant non trouvé',
        });
      }
      
      res.json({
        success: true,
        data: teacher,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;

