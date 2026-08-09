import { Router } from 'express';
import { z } from 'zod';

import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { StudentService } from '../services/student.service';

const router = Router();

// Validation schemas
const linkStudentParentSchema = z.object({
  body: z.object({
    studentId: z.string(),
    parentId: z.string(),
    relation: z.enum(['PERE', 'MERE', 'TUTEUR', 'AUTRE']),
  }),
});

const unlinkStudentParentSchema = z.object({
  params: z.object({
    studentId: z.string(),
    parentId: z.string(),
  }),
});

// Link parent to student
router.post('/link', authenticate, authorize('ADMIN', 'SECRETARY'), validate(linkStudentParentSchema), async (req, res) => {
  try {
    const studentParent = await StudentService.linkParent(
      req.body.studentId,
      req.body.parentId,
      req.body.relation
    );

    res.status(201).json({
      success: true,
      data: studentParent,
      message: 'Parent linked to student successfully',
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: 'Failed to link parent to student',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Unlink parent from student
router.delete('/unlink/:studentId/:parentId', authenticate, authorize('ADMIN', 'SECRETARY'),
  validate(unlinkStudentParentSchema), async (req, res) => {
  try {
    await StudentService.unlinkParent(req.params.studentId, req.params.parentId);

    res.json({
      success: true,
      message: 'Parent unlinked from student successfully',
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: 'Failed to unlink parent from student',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
