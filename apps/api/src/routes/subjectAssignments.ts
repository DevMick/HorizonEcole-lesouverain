import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { SubjectAssignmentService } from '../services/subjectAssignment.service';

const router = Router();

// ============================================================================
// Validation Schemas
// ============================================================================

const assignSubjectsSchema = z.object({
  body: z.object({
    subjectIds: z.array(z.string().uuid()),
  }),
});

// ============================================================================
// Routes
// ============================================================================

/**
 * GET /api/subject-assignments/classes
 * Get all classes
 */
router.get('/classes', authenticate, async (req, res) => {
  try {
    const classes = await SubjectAssignmentService.getAllClasses();

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
 * GET /api/subject-assignments/class/:classId
 * Get subjects for a class with assignment status
 */
router.get('/class/:classId', authenticate, async (req, res) => {
  try {
    const { classId } = req.params;

    const subjects = await SubjectAssignmentService.getSubjectsForClass(classId);

    res.json({
      success: true,
      data: subjects,
    });
  } catch (error) {
    console.error('Error fetching subjects for class:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch subjects',
    });
  }
});

/**
 * POST /api/subject-assignments/class/:classId
 * Assign subjects to a class
 */
router.post(
  '/class/:classId',
  authenticate,
  requireRole('ADMIN'),
  validate(assignSubjectsSchema),
  async (req, res) => {
    try {
      const { classId } = req.params;
      const { subjectIds } = req.body;

      const result = await SubjectAssignmentService.assignSubjects(
        classId,
        subjectIds
      );

      res.json({
        success: true,
        data: result,
        message: `${result.added} matière(s) ajoutée(s), ${result.removed} retirée(s)`,
      });
    } catch (error: any) {
      console.error('Error assigning subjects:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to assign subjects',
      });
    }
  }
);

export default router;

