import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { CoefficientService } from '../services/coefficient.service';

const router = Router();

// ============================================================================
// Validation Schemas
// ============================================================================

const updateCoefficientSchema = z.object({
  body: z.object({
    coefficient: z.number().int().min(1).max(20, 'Coefficient max: 20'),
  }),
});

const batchUpdateSchema = z.object({
  body: z.object({
    coefficients: z.array(
      z.object({
        subjectId: z.string().uuid(),
        coefficient: z.number().int().min(1).max(20),
      })
    ),
  }),
});

// ============================================================================
// Routes
// ============================================================================

/**
 * GET /api/coefficients/classes
 * Get all classes (for selection)
 */
router.get('/classes', authenticate, async (req, res) => {
  try {
    const classes = await CoefficientService.getAllClasses();

    res.json({
      success: true,
      data: classes,
    });
  } catch (error) {
    console.error('Error fetching classes:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch classes',
    });
  }
});

/**
 * GET /api/coefficients/subjects
 * Get all subjects (for selection)
 */
router.get('/subjects', authenticate, async (req, res) => {
  try {
    const subjects = await CoefficientService.getAllSubjects();

    res.json({
      success: true,
      data: subjects,
    });
  } catch (error) {
    console.error('Error fetching subjects:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch subjects',
    });
  }
});

/**
 * GET /api/coefficients/class/:classId
 * Get all subjects with coefficients for a specific class
 */
router.get('/class/:classId', authenticate, async (req, res) => {
  try {
    const { classId } = req.params;

    const classSubjects = await CoefficientService.getClassSubjectsWithCoefficients(
      classId
    );

    res.json({
      success: true,
      data: classSubjects,
    });
  } catch (error) {
    console.error('Error fetching class subjects:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch class subjects',
    });
  }
});

/**
 * PATCH /api/coefficients/class/:classId/subject/:subjectId
 * Update coefficient for a class-subject
 */
router.patch(
  '/class/:classId/subject/:subjectId',
  authenticate,
  requireRole('ADMIN'),
  validate(updateCoefficientSchema),
  async (req, res) => {
    try {
      const { classId, subjectId } = req.params;
      const { coefficient } = req.body;

      const updated = await CoefficientService.updateCoefficient(
        classId,
        subjectId,
        coefficient
      );

      res.json({
        success: true,
        data: updated,
        message: 'Coefficient mis à jour',
      });
    } catch (error: any) {
      console.error('Error updating coefficient:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to update coefficient',
      });
    }
  }
);

/**
 * POST /api/coefficients/class/:classId/batch
 * Batch update coefficients for a class
 */
router.post(
  '/class/:classId/batch',
  authenticate,
  requireRole('ADMIN'),
  validate(batchUpdateSchema),
  async (req, res) => {
    try {
      const { classId } = req.params;
      const { coefficients } = req.body;

      const results = await CoefficientService.batchUpdateCoefficients(
        classId,
        coefficients
      );

      res.json({
        success: true,
        data: results,
        message: 'Coefficients mis à jour avec succès',
      });
    } catch (error: any) {
      console.error('Error batch updating coefficients:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to update coefficients',
      });
    }
  }
);

export default router;

