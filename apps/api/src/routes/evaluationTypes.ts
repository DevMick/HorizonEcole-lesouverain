import { Router } from 'express';
import { z } from 'zod';
import { EvaluationTypeService, createEvaluationTypeSchema, updateEvaluationTypeSchema } from '../services/evaluationType.service';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { prisma } from '@school/database';

const router = Router();

// Validation schemas
const createEvaluationTypeRouteSchema = z.object({
  body: createEvaluationTypeSchema,
});

const updateEvaluationTypeRouteSchema = z.object({
  body: updateEvaluationTypeSchema,
});

// Get all evaluation types
router.get(
  '/',
  authenticate,
  requireRole('ADMIN', 'TEACHER'),
  async (req, res, next) => {
    try {
      const { teacherId, academicYearId, classId, subjectId } = req.query;
      const user = (req as any).user;

      // If user is TEACHER, only show their own evaluation types
      let filterTeacherId = teacherId as string | undefined;
      if (user.role === 'TEACHER') {
        const teacher = await prisma.teachers.findUnique({
          where: { user_id: user.id },
          select: { id: true },
        });
        if (teacher) {
          filterTeacherId = teacher.id;
        } else {
          return res.json({
            success: true,
            data: [],
          });
        }
      }

      const evaluationTypes = await EvaluationTypeService.getAll({
        teacherId: filterTeacherId,
        academicYearId: academicYearId as string | undefined,
        classId: classId as string | undefined,
        subjectId: subjectId as string | undefined,
      });

      res.json({
        success: true,
        data: evaluationTypes,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get evaluation type by ID
router.get(
  '/:id',
  authenticate,
  requireRole('ADMIN', 'TEACHER'),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const evaluationType = await EvaluationTypeService.getById(id);

      if (!evaluationType) {
        return res.status(404).json({
          success: false,
          error: 'Type d\'évaluation non trouvé',
        });
      }

      // Check if user is TEACHER and owns this evaluation type
      const user = (req as any).user;
      if (user.role === 'TEACHER') {
        const teacher = await prisma.teachers.findUnique({
          where: { user_id: user.id },
          select: { id: true },
        });
        if (teacher && evaluationType.teacher_id !== teacher.id) {
          return res.status(403).json({
            success: false,
            error: 'Accès non autorisé',
          });
        }
      }

      res.json({
        success: true,
        data: evaluationType,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Create evaluation type
router.post(
  '/',
  authenticate,
  requireRole('ADMIN', 'TEACHER'),
  validate(createEvaluationTypeRouteSchema),
  async (req, res, next) => {
    try {
      const user = (req as any).user;
      let teacherId = req.body.teacherId;

      // If user is TEACHER, use their own teacher ID
      if (user.role === 'TEACHER') {
        const teacher = await prisma.teachers.findUnique({
          where: { user_id: user.id },
          select: { id: true },
        });
        if (!teacher) {
          return res.status(404).json({
            success: false,
            error: 'Enseignant non trouvé pour cet utilisateur',
          });
        }
        teacherId = teacher.id;
      }

      const evaluationType = await EvaluationTypeService.create({
        name: req.body.name,
        teacherId,
        academicYearId: req.body.academicYearId,
        classId: req.body.classId,
        subjectId: req.body.subjectId,
        coefficient: req.body.coefficient,
        maxNote: req.body.maxNote,
      });

      res.status(201).json({
        success: true,
        data: evaluationType,
      });
    } catch (error: any) {
      if (error.message.includes('non trouvé') || error.message.includes('obligatoire') || error.message.includes('non autorisé')) {
        return res.status(400).json({
          success: false,
          error: error.message,
        });
      }
      next(error);
    }
  }
);

// Update evaluation type
router.patch(
  '/:id',
  authenticate,
  requireRole('ADMIN', 'TEACHER'),
  validate(updateEvaluationTypeRouteSchema),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const user = (req as any).user;

      // Check if user is TEACHER and owns this evaluation type
      if (user.role === 'TEACHER') {
        const evaluationType = await EvaluationTypeService.getById(id);
        if (!evaluationType) {
          return res.status(404).json({
            success: false,
            error: 'Type d\'évaluation non trouvé',
          });
        }

        const teacher = await prisma.teachers.findUnique({
          where: { user_id: user.id },
          select: { id: true },
        });
        if (teacher && evaluationType.teacher_id !== teacher.id) {
          return res.status(403).json({
            success: false,
            error: 'Accès non autorisé',
          });
        }
      }

      const evaluationType = await EvaluationTypeService.update(id, {
        name: req.body.name,
        coefficient: req.body.coefficient,
        maxNote: req.body.maxNote,
      });

      res.json({
        success: true,
        data: evaluationType,
      });
    } catch (error: any) {
      if (error.message.includes('non trouvé') || error.message.includes('obligatoire') || error.message.includes('non autorisé')) {
        return res.status(400).json({
          success: false,
          error: error.message,
        });
      }
      next(error);
    }
  }
);

// Delete evaluation type
router.delete(
  '/:id',
  authenticate,
  requireRole('ADMIN', 'TEACHER'),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const user = (req as any).user;

      // Check if user is TEACHER and owns this evaluation type
      if (user.role === 'TEACHER') {
        const evaluationType = await EvaluationTypeService.getById(id);
        if (!evaluationType) {
          return res.status(404).json({
            success: false,
            error: 'Type d\'évaluation non trouvé',
          });
        }

        const teacher = await prisma.teachers.findUnique({
          where: { user_id: user.id },
          select: { id: true },
        });
        if (teacher && evaluationType.teacher_id !== teacher.id) {
          return res.status(403).json({
            success: false,
            error: 'Accès non autorisé',
          });
        }
      }

      await EvaluationTypeService.delete(id);

      res.json({
        success: true,
        message: 'Type d\'évaluation supprimé avec succès',
      });
    } catch (error: any) {
      if (error.message.includes('non trouvé') || error.message.includes('utilisé')) {
        return res.status(400).json({
          success: false,
          error: error.message,
        });
      }
      next(error);
    }
  }
);

export default router;

