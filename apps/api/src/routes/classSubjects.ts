import { Router } from 'express';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { prisma } from '@school/database';
import { UserRole } from '@school/types';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validate } from '../middleware/validate';

const router = Router();

// ============================================================================
// Validation Schemas
// ============================================================================

const createClassSubjectSchema = z.object({
  body: z.object({
    classId: z.string().uuid(),
    subjectId: z.string().uuid(),
    teacherId: z.string().uuid().optional().nullable(),
    hoursPerWeek: z.number().int().min(1).max(20).default(1),
  }),
});

const updateClassSubjectSchema = z.object({
  body: z.object({
    teacherId: z.string().uuid().optional().nullable(),
    hoursPerWeek: z.number().int().min(1).max(20).optional(),
  }),
});

// ============================================================================
// Routes
// ============================================================================

/**
 * GET /api/class-subjects
 * Get all class-subject assignments with optional filters
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const { classId, subjectId, teacherId } = req.query;

    const where: any = {};
    if (classId) where.class_id = classId as string;
    if (subjectId) where.subject_id = subjectId as string;
    if (teacherId) where.teacher_id = teacherId as string;

    const assignments = await prisma.class_subjects.findMany({
      where,
      include: {
        class: {
          select: {
            id: true,
            name: true,
          },
        },
        subjects: {
          select: {
            id: true,
            name: true,
            code: true,
            coefficient: true,
          },
        },
      },
      orderBy: [
        { class: { name: 'asc' } },
        { subjects: { name: 'asc' } },
      ],
    });

    res.json({
      success: true,
      data: assignments,
    });
  } catch (error) {
    console.error('Error fetching class-subjects:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch class-subjects',
    });
  }
});

/**
 * GET /api/class-subjects/:id
 * Get class-subject assignment by ID
 */
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const assignment = await prisma.class_subjects.findUnique({
      where: { id },
      include: {
        class: {
          include: {
          },
        },
        subjects: true,
      },
    });

    if (!assignment) {
      return res.status(404).json({
        success: false,
        error: 'Affectation non trouvée',
      });
    }

    res.json({
      success: true,
      data: assignment,
    });
  } catch (error) {
    console.error('Error fetching class-subject:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch class-subject',
    });
  }
});

/**
 * POST /api/class-subjects
 * Create new class-subject assignment (ADMIN only)
 */
router.post(
  '/',
  authenticate,
  requireRole(UserRole.ADMIN),
  validate(createClassSubjectSchema),
  async (req, res) => {
    try {
      const { classId, subjectId, teacherId, hoursPerWeek } = req.body;

      // Check uniqueness: one subject per class
      const existing = await prisma.class_subjects.findFirst({
        where: {
          class_id: classId,
          subject_id: subjectId,
        },
      });

      if (existing) {
        return res.status(409).json({
          success: false,
          error: 'Cette matière est déjà affectée à cette classe',
        });
      }

      const assignment = await prisma.class_subjects.create({
        data: {
          id: randomUUID(),
          class_id: classId,
          subject_id: subjectId,
          teacher_id: teacherId || null,
          hours_per_week: hoursPerWeek,
        },
        include: {
          class: {
            select: {
              name: true,
            },
          },
          subjects: {
            select: {
              name: true,
              code: true,
            },
          },
        },
      });

      res.status(201).json({
        success: true,
        data: assignment,
        message: 'Matière affectée avec succès',
      });
    } catch (error) {
      console.error('Error creating class-subject:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create class-subject',
      });
    }
  }
);

/**
 * PATCH /api/class-subjects/:id
 * Update class-subject assignment (ADMIN only)
 */
router.patch(
  '/:id',
  authenticate,
  requireRole(UserRole.ADMIN),
  validate(updateClassSubjectSchema),
  async (req, res) => {
    try {
      const { id } = req.params;
      const data = req.body;

      const assignment = await prisma.class_subjects.update({
        where: { id },
        data,
        include: {
          class: true,
          subjects: true,
        },
      });

      res.json({
        success: true,
        data: assignment,
        message: 'Affectation mise à jour avec succès',
      });
    } catch (error) {
      console.error('Error updating class-subject:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update class-subject',
      });
    }
  }
);

/**
 * DELETE /api/class-subjects/:id
 * Delete class-subject assignment (ADMIN only)
 */
router.delete(
  '/:id',
  authenticate,
  requireRole(UserRole.ADMIN),
  async (req, res) => {
    try {
      const { id } = req.params;

      await prisma.class_subjects.delete({
        where: { id },
      });

      res.json({
        success: true,
        message: 'Affectation supprimée avec succès',
      });
    } catch (error) {
      console.error('Error deleting class-subject:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete class-subject',
      });
    }
  }
);

export default router;

