import { Router } from 'express';
import { z } from 'zod';
import { ClassMainTeacherService } from '../services/classMainTeacher.service';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { UserRole } from '@school/types';

const router = Router();

const createMainTeacherSchema = z.object({
  body: z.object({
    academicYearId: z.string().uuid('L\'année académique est obligatoire'),
    teacherId: z.string().uuid('L\'enseignant est obligatoire'),
    classId: z.string().uuid('La classe est obligatoire'),
  }),
});

const updateMainTeacherSchema = z.object({
  body: z.object({
    teacherId: z.string().uuid('L\'enseignant est obligatoire').optional(),
  }),
});

// Get all main teacher assignments
router.get(
  '/',
  authenticate,
  requireRole(UserRole.ADMIN),
  async (req, res, next) => {
    try {
      const { academicYearId, teacherId, classId } = req.query;
      const mainTeachers = await ClassMainTeacherService.getAll({
        academicYearId: academicYearId as string | undefined,
        teacherId: teacherId as string | undefined,
        classId: classId as string | undefined,
      });
      res.json({ data: mainTeachers });
    } catch (error: any) {
      next(error);
    }
  }
);

// Get main teacher by ID
router.get(
  '/:id',
  authenticate,
  requireRole(UserRole.ADMIN),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const mainTeacher = await ClassMainTeacherService.getById(id);
      res.json({ data: mainTeacher });
    } catch (error: any) {
      next(error);
    }
  }
);

// Get main teacher for a class in a specific academic year
router.get(
  '/class/:classId/year/:academicYearId',
  authenticate,
  requireRole(UserRole.ADMIN),
  async (req, res, next) => {
    try {
      const { classId, academicYearId } = req.params;
      const mainTeacher = await ClassMainTeacherService.getByClassAndYear(classId, academicYearId);
      res.json({ data: mainTeacher });
    } catch (error: any) {
      next(error);
    }
  }
);

// Create a main teacher assignment
router.post(
  '/',
  authenticate,
  requireRole(UserRole.ADMIN),
  validate(createMainTeacherSchema),
  async (req, res, next) => {
    try {
      const { academicYearId, teacherId, classId } = req.body;
      const mainTeacher = await ClassMainTeacherService.create({
        academicYearId,
        teacherId,
        classId,
      });
      res.status(201).json({ data: mainTeacher });
    } catch (error: any) {
      next(error);
    }
  }
);

// Update a main teacher assignment
router.patch(
  '/:id',
  authenticate,
  requireRole(UserRole.ADMIN),
  validate(updateMainTeacherSchema),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { teacherId } = req.body;
      const mainTeacher = await ClassMainTeacherService.update(id, { teacherId });
      res.json({ data: mainTeacher });
    } catch (error: any) {
      next(error);
    }
  }
);

// Delete a main teacher assignment
router.delete(
  '/:id',
  authenticate,
  requireRole(UserRole.ADMIN),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      await ClassMainTeacherService.delete(id);
      res.json({ message: 'Affectation de professeur principal supprimée avec succès' });
    } catch (error: any) {
      next(error);
    }
  }
);

export default router;

