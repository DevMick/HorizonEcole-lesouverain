import { Router } from 'express';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { prisma } from '@school/database';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validate } from '../middleware/validate';

const router = Router();

// ============================================================================
// Validation Schemas
// ============================================================================

const createSubjectSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Le nom doit contenir au moins 2 caractères'),
    code: z.string()
      .min(2, 'Le code doit contenir au moins 2 caractères')
      .max(10, 'Le code doit contenir au maximum 10 caractères')
      .regex(/^[A-Za-z0-9]+$/, 'Le code ne doit contenir que des lettres et des chiffres'),
  }),
});

const updateSubjectSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Le nom doit contenir au moins 2 caractères'),
  }),
});

// ============================================================================
// Routes
// ============================================================================

/**
 * GET /api/school-subjects
 * Get all subjects
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const subjects = await prisma.subjects.findMany({
      orderBy: { name: 'asc' },
    });

    // Get counts for each subject
    const subjectsWithCounts = await Promise.all(
      subjects.map(async (subject) => {
        const [classSubjectsCount, schedulesCount] = await Promise.all([
          prisma.class_subjects.count({ where: { subject_id: subject.id } }),
          prisma.schedules.count({ where: { subject_id: subject.id } }),
        ]);
        return {
          ...subject,
          _count: {
            class_subjects: classSubjectsCount,
            schedules: schedulesCount,
          },
        };
      })
    );

    res.json({
      success: true,
      data: subjectsWithCounts,
    });
  } catch (error: any) {
    console.error('Error fetching subjects:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      meta: error.meta,
      stack: error.stack,
    });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch subjects',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

/**
 * GET /api/school-subjects/:id
 * Get subject by ID
 */
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const subject = await prisma.subjects.findUnique({
      where: { id },
      include: {
        class_subjects: {
          include: {
            class: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!subject) {
      return res.status(404).json({
        success: false,
        error: 'Matière non trouvée',
      });
    }

    // Get counts
    const [classSubjectsCount, schedulesCount] = await Promise.all([
      prisma.class_subjects.count({ where: { subject_id: subject.id } }),
      prisma.schedules.count({ where: { subject_id: subject.id } }),
    ]);

    const subjectWithCounts = {
      ...subject,
      _count: {
        class_subjects: classSubjectsCount,
        schedules: schedulesCount,
      },
    };

    res.json({
      success: true,
      data: subjectWithCounts,
    });
  } catch (error) {
    console.error('Error fetching subject:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch subject',
    });
  }
});

/**
 * POST /api/school-subjects
 * Create new subject (ADMIN only)
 */
router.post(
  '/',
  authenticate,
  requireRole('ADMIN'),
  validate(createSubjectSchema),
  async (req, res) => {
    try {
      const { name } = req.body;
      const code = String(req.body.code).toUpperCase();

      const existing = await prisma.subjects.findUnique({ where: { code } });
      if (existing) {
        return res.status(400).json({
          success: false,
          error: `Le code "${code}" est d\u00e9j\u00e0 utilis\u00e9 par une autre mati\u00e8re`,
        });
      }

      const subject = await prisma.subjects.create({
        data: {
          id: randomUUID(),
          name,
          code,
          coefficient: 1, // Default coefficient
          description: null,
        },
      });

      res.status(201).json({
        success: true,
        data: subject,
        message: 'Matière créée avec succès',
      });
    } catch (error: any) {
      console.error('Error creating subject:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        meta: error.meta,
        stack: error.stack,
      });
      res.status(500).json({
        success: false,
        error: 'Failed to create subject',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }
);

/**
 * PATCH /api/school-subjects/:id
 * Update subject (ADMIN only)
 */
router.patch(
  '/:id',
  authenticate,
  requireRole('ADMIN'),
  validate(updateSubjectSchema),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { name } = req.body;

      const subject = await prisma.subjects.update({
        where: { id },
        data: { name },
      });

      res.json({
        success: true,
        data: subject,
        message: 'Matière mise à jour avec succès',
      });
    } catch (error) {
      console.error('Error updating subject:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update subject',
      });
    }
  }
);

/**
 * DELETE /api/school-subjects/:id
 * Delete subject (ADMIN only)
 */
router.delete(
  '/:id',
  authenticate,
  requireRole('ADMIN'),
  async (req, res) => {
    try {
      const { id } = req.params;

      // Check dependencies
      const subject = await prisma.subjects.findUnique({
        where: { id },
      });

      if (!subject) {
        return res.status(404).json({
          success: false,
          error: 'Matière non trouvée',
        });
      }

      const [classSubjectsCount, schedulesCount] = await Promise.all([
        prisma.class_subjects.count({ where: { subject_id: subject.id } }),
        prisma.schedules.count({ where: { subject_id: subject.id } }),
      ]);

      const totalDeps = classSubjectsCount + schedulesCount;

      if (totalDeps > 0) {
        return res.status(400).json({
          success: false,
          error: `Impossible de supprimer la matière : ${classSubjectsCount} affectation(s), ${schedulesCount} horaire(s)`,
        });
      }

      await prisma.subjects.delete({
        where: { id },
      });

      res.json({
        success: true,
        message: 'Matière supprimée avec succès',
      });
    } catch (error) {
      console.error('Error deleting subject:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete subject',
      });
    }
  }
);

export default router;
