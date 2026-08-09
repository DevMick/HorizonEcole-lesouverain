import express from 'express';
import { TeacherHoursService } from '../services/teacher-hours.service';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { UserRole } from '@school/types';

const router = express.Router();

/**
 * @route   POST /api/teacher-hours
 * @desc    Create or update teacher hours for a month
 * @access  Admin only
 */
router.post('/', authenticate, requireRole(UserRole.ADMIN), async (req, res, next) => {
  try {
    const hours = await TeacherHoursService.upsertHours(req.body);
    res.json({ success: true, data: hours });
  } catch (error: any) {
    next(error);
  }
});

/**
 * @route   GET /api/teacher-hours/teacher/:teacherId
 * @desc    Get all hours for a teacher
 * @access  Admin or Teacher (own hours)
 */
router.get('/teacher/:teacherId', authenticate, async (req, res, next) => {
  try {
    const { teacherId } = req.params;
    const user = (req as any).user;

    // Teachers can only see their own hours
    if (user.role === 'TEACHER' && user.teacherId !== teacherId) {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }

    const hours = await TeacherHoursService.getTeacherHours(teacherId);
    res.json({ success: true, data: hours });
  } catch (error: any) {
    next(error);
  }
});

/**
 * @route   GET /api/teacher-hours/teacher/:teacherId/month/:month/:year
 * @desc    Get hours for a teacher in a specific month
 * @access  Admin or Teacher (own hours)
 */
router.get('/teacher/:teacherId/month/:month/:year', authenticate, async (req, res, next) => {
  try {
    const { teacherId, month, year } = req.params;
    const user = (req as any).user;

    // Teachers can only see their own hours
    if (user.role === 'TEACHER' && user.teacherId !== teacherId) {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }

    const hours = await TeacherHoursService.getHours(teacherId, parseInt(month), parseInt(year));
    res.json({ success: true, data: hours });
  } catch (error: any) {
    next(error);
  }
});

/**
 * @route   GET /api/teacher-hours/month/:month/:year
 * @desc    Get hours for all vacataires in a month
 * @access  Admin only
 */
router.get('/month/:month/:year', authenticate, requireRole(UserRole.ADMIN), async (req, res, next) => {
  try {
    const { month, year } = req.params;
    const hours = await TeacherHoursService.getMonthHours(parseInt(month), parseInt(year));
    res.json({ success: true, data: hours });
  } catch (error: any) {
    next(error);
  }
});

/**
 * @route   DELETE /api/teacher-hours/teacher/:teacherId/month/:month/:year
 * @desc    Delete hours for a teacher in a month
 * @access  Admin only
 */
router.delete('/teacher/:teacherId/month/:month/:year', authenticate, requireRole(UserRole.ADMIN), async (req, res, next) => {
  try {
    const { teacherId, month, year } = req.params;
    await TeacherHoursService.deleteHours(teacherId, parseInt(month), parseInt(year));
    res.json({ success: true, message: 'Heures supprimées avec succès' });
  } catch (error: any) {
    next(error);
  }
});

export default router;

