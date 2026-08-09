import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth';
import { validateRequest } from '../middleware/validate';
import { ScheduleService, ScheduleExceptionService, createScheduleSchema, updateScheduleSchema, createExceptionSchema, updateExceptionSchema } from '../services/schedule.service';
import { auditLogger } from '../middleware/auditTracking';

const router = Router();

// ========== SCHEDULES ==========

router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await ScheduleService.getSchedules(req.query);
    res.json({ success: true, data: result.schedules, pagination: result.pagination });
  } catch (error) {
    console.error('Error fetching schedules:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch schedules' });
  }
});

router.get('/class/:classId/timetable', authenticateToken, async (req, res) => {
  try {
    const { classId } = req.params;
    const { academicYearId } = req.query;
    const schedules = await ScheduleService.getClassTimetable(classId, academicYearId as string);
    res.json({ success: true, data: schedules });
  } catch (error) {
    console.error('Error fetching class timetable:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch class timetable' });
  }
});

router.get('/teacher/:teacherId/timetable', authenticateToken, async (req, res) => {
  try {
    const { teacherId } = req.params;
    const { academicYearId } = req.query;
    const schedules = await ScheduleService.getTeacherTimetable(teacherId, academicYearId as string);
    res.json({ success: true, data: schedules });
  } catch (error) {
    console.error('Error fetching teacher timetable:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch teacher timetable' });
  }
});

router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const schedule = await ScheduleService.getScheduleById(req.params.id);
    res.json({ success: true, data: schedule });
  } catch (error) {
    if (error instanceof Error && error.message === 'Schedule not found') {
      return res.status(404).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: 'Failed to fetch schedule' });
  }
});

router.post('/', authenticateToken, requireRole(['ADMIN']), validateRequest(createScheduleSchema), async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const schedule = await ScheduleService.createSchedule(req.body);
    auditLogger.info('Schedule created', { userId, scheduleId: schedule.id });
    res.status(201).json({ success: true, data: schedule, message: 'Schedule created successfully' });
  } catch (error) {
    if (error instanceof Error && (error.message.includes('not found') || error.message.includes('Conflit'))) {
      return res.status(400).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: 'Failed to create schedule' });
  }
});

router.put('/:id', authenticateToken, requireRole(['ADMIN']), validateRequest(updateScheduleSchema), async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const schedule = await ScheduleService.updateSchedule(req.params.id, req.body);
    auditLogger.info('Schedule updated', { userId, scheduleId: req.params.id });
    res.json({ success: true, data: schedule, message: 'Schedule updated successfully' });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Schedule not found') {
        return res.status(404).json({ success: false, error: error.message });
      }
      if (error.message.includes('Conflit')) {
        return res.status(400).json({ success: false, error: error.message });
      }
    }
    res.status(500).json({ success: false, error: 'Failed to update schedule' });
  }
});

router.delete('/:id', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const result = await ScheduleService.deleteSchedule(req.params.id);
    auditLogger.info('Schedule deleted', { userId, scheduleId: req.params.id });
    res.json({ success: true, message: result.message });
  } catch (error) {
    if (error instanceof Error && error.message === 'Schedule not found') {
      return res.status(404).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: 'Failed to delete schedule' });
  }
});

// ========== SCHEDULE EXCEPTIONS ==========

router.get('/exceptions', authenticateToken, async (req, res) => {
  try {
    const result = await ScheduleExceptionService.getExceptions(req.query);
    res.json({ success: true, data: result.exceptions, pagination: result.pagination });
  } catch (error) {
    console.error('Error fetching exceptions:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch exceptions' });
  }
});

router.get('/exceptions/:id', authenticateToken, async (req, res) => {
  try {
    const exception = await ScheduleExceptionService.getExceptionById(req.params.id);
    res.json({ success: true, data: exception });
  } catch (error) {
    if (error instanceof Error && error.message === 'Schedule exception not found') {
      return res.status(404).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: 'Failed to fetch exception' });
  }
});

router.post('/exceptions', authenticateToken, requireRole(['ADMIN', 'ENSEIGNANT']), validateRequest(createExceptionSchema), async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const exception = await ScheduleExceptionService.createException(req.body, userId);
    auditLogger.info('Schedule exception created', { userId, exceptionId: exception.id });
    res.status(201).json({ success: true, data: exception, message: 'Exception created successfully' });
  } catch (error) {
    if (error instanceof Error && (error.message.includes('not found') || error.message.includes('conflict'))) {
      return res.status(400).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: 'Failed to create exception' });
  }
});

router.put('/exceptions/:id', authenticateToken, requireRole(['ADMIN', 'ENSEIGNANT']), validateRequest(updateExceptionSchema), async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const exception = await ScheduleExceptionService.updateException(req.params.id, req.body);
    auditLogger.info('Schedule exception updated', { userId, exceptionId: req.params.id });
    res.json({ success: true, data: exception, message: 'Exception updated successfully' });
  } catch (error) {
    if (error instanceof Error && error.message === 'Schedule exception not found') {
      return res.status(404).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: 'Failed to update exception' });
  }
});

router.delete('/exceptions/:id', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const result = await ScheduleExceptionService.deleteException(req.params.id);
    auditLogger.info('Schedule exception deleted', { userId, exceptionId: req.params.id });
    res.json({ success: true, message: result.message });
  } catch (error) {
    if (error instanceof Error && error.message === 'Schedule exception not found') {
      return res.status(404).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: 'Failed to delete exception' });
  }
});

export default router;