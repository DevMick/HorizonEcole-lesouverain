import express from 'express';
import { TeacherAbsenceService } from '../services/teacher-absence.service';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { UserRole } from '@school/types';

const router = express.Router();

/**
 * @route   POST /api/teacher-absences
 * @desc    Create an absence record
 * @access  Admin only
 */
router.post('/', authenticate, requireRole(UserRole.ADMIN), async (req, res, next) => {
  try {
    const user = (req as any).user;
    const absence = await TeacherAbsenceService.createAbsence(req.body, user.id);
    res.json({ success: true, data: absence });
  } catch (error: any) {
    next(error);
  }
});

/**
 * @route   PUT /api/teacher-absences/:id
 * @desc    Update an absence record
 * @access  Admin only
 */
router.put('/:id', authenticate, requireRole(UserRole.ADMIN), async (req, res, next) => {
  try {
    const absence = await TeacherAbsenceService.updateAbsence({
      id: req.params.id,
      ...req.body,
    });
    res.json({ success: true, data: absence });
  } catch (error: any) {
    next(error);
  }
});

/**
 * @route   DELETE /api/teacher-absences/:id
 * @desc    Delete an absence record
 * @access  Admin only
 */
router.delete('/:id', authenticate, requireRole(UserRole.ADMIN), async (req, res, next) => {
  try {
    await TeacherAbsenceService.deleteAbsence(req.params.id);
    res.json({ success: true, message: 'Absence supprimée avec succès' });
  } catch (error: any) {
    next(error);
  }
});

/**
 * @route   GET /api/teacher-absences
 * @desc    Get absences with filters
 * @access  Admin or Teacher (own absences)
 */
router.get('/', authenticate, async (req, res, next) => {
  try {
    const user = (req as any).user;
    const filters: any = { ...req.query };

    // Teachers can only see their own absences
    if (user.role === 'TEACHER' && user.teacherId) {
      filters.teacherId = user.teacherId;
    }

    const absences = await TeacherAbsenceService.getAbsences(filters);
    res.json({ success: true, data: absences });
  } catch (error: any) {
    next(error);
  }
});

/**
 * @route   GET /api/teacher-absences/:id
 * @desc    Get an absence by ID
 * @access  Admin or Teacher (own absence)
 */
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    const absence = await TeacherAbsenceService.getAbsenceById(id);

    // Teachers can only see their own absences
    if (user.role === 'TEACHER' && user.teacherId !== absence.teacher_id) {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }

    res.json({ success: true, data: absence });
  } catch (error: any) {
    next(error);
  }
});

/**
 * @route   GET /api/teacher-absences/teacher/:teacherId
 * @desc    Get all absences for a teacher
 * @access  Admin or Teacher (own absences)
 */
router.get('/teacher/:teacherId', authenticate, async (req, res, next) => {
  try {
    const { teacherId } = req.params;
    const user = (req as any).user;

    // Teachers can only see their own absences
    if (user.role === 'TEACHER' && user.teacherId !== teacherId) {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }

    const absences = await TeacherAbsenceService.getAbsences({ teacherId });
    res.json({ success: true, data: absences });
  } catch (error: any) {
    next(error);
  }
});

/**
 * @route   GET /api/teacher-absences/teacher/:teacherId/month/:month/:year
 * @desc    Get absences for a teacher in a specific month
 * @access  Admin or Teacher (own absences)
 */
router.get('/teacher/:teacherId/month/:month/:year', authenticate, async (req, res, next) => {
  try {
    const { teacherId, month, year } = req.params;
    const user = (req as any).user;

    // Teachers can only see their own absences
    if (user.role === 'TEACHER' && user.teacherId !== teacherId) {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }

    const absences = await TeacherAbsenceService.getAbsences({
      teacherId,
      month: parseInt(month),
      year: parseInt(year),
    });
    res.json({ success: true, data: absences });
  } catch (error: any) {
    next(error);
  }
});

/**
 * @route   GET /api/teacher-absences/teacher/:teacherId/month/:month/:year/summary
 * @desc    Get absences summary for a teacher in a month
 * @access  Admin or Teacher (own absences)
 */
router.get('/teacher/:teacherId/month/:month/:year/summary', authenticate, async (req, res, next) => {
  try {
    const { teacherId, month, year } = req.params;
    const user = (req as any).user;

    // Teachers can only see their own absences
    if (user.role === 'TEACHER' && user.teacherId !== teacherId) {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }

    const summary = await TeacherAbsenceService.getAbsencesSummary(
      teacherId,
      parseInt(month),
      parseInt(year)
    );
    res.json({ success: true, data: summary });
  } catch (error: any) {
    next(error);
  }
});

export default router;

