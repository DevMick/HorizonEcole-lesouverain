import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth';
import { validateRequest } from '../middleware/validate';
import { AttendanceService, batchAttendanceSchema } from '../services/attendance.service';
import { auditLogger } from '../middleware/auditTracking';

const router = Router();

// Get attendances
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await AttendanceService.getAttendances(req.query);
    res.json({ success: true, data: result.attendances, pagination: result.pagination });
  } catch (error) {
    console.error('Error fetching attendances:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch attendances' });
  }
});

// Get attendance statistics
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const stats = await AttendanceService.getAttendanceStats(req.query);
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Error fetching attendance stats:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch attendance statistics' });
  }
});

// Get class attendance for a specific date
router.get('/class/:classId', authenticateToken, async (req, res) => {
  try {
    const { classId } = req.params;
    const { date, period } = req.query;

    if (!date) {
      return res.status(400).json({ success: false, error: 'Date is required' });
    }

    const attendances = await AttendanceService.getClassAttendance(classId, date as string, period as string);
    res.json({ success: true, data: attendances });
  } catch (error) {
    console.error('Error fetching class attendance:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch class attendance' });
  }
});

// Record batch attendance (idempotent)
router.post('/batch', authenticateToken, requireRole(['ADMIN', 'TEACHER']), validateRequest(batchAttendanceSchema), async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const result = await AttendanceService.recordBatchAttendance(req.body, userId);

    auditLogger.info('Batch attendance recorded', {
      userId,
      classId: req.body.classId,
      date: req.body.date,
      period: req.body.period,
      successful: result.summary.successful,
      failed: result.summary.failed,
    });

    res.status(201).json({
      success: true,
      data: result,
      message: `${result.summary.successful} attendances recorded, ${result.summary.failed} failed`,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      return res.status(400).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: 'Failed to record batch attendance' });
  }
});

// Delete attendance
router.delete('/:id', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const result = await AttendanceService.deleteAttendance(req.params.id);
    auditLogger.info('Attendance deleted', { userId, attendanceId: req.params.id });
    res.json({ success: true, message: result.message });
  } catch (error) {
    if (error instanceof Error && error.message === 'Attendance record not found') {
      return res.status(404).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: 'Failed to delete attendance' });
  }
});

// ========== ATTENDANCE SUMMARIES ==========

router.get('/summaries', authenticateToken, async (req, res) => {
  try {
    const result = await AttendanceService.getAttendanceSummaries(req.query);
    res.json({ success: true, data: result.summaries, pagination: result.pagination });
  } catch (error) {
    console.error('Error fetching attendance summaries:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch attendance summaries' });
  }
});

router.get('/summaries/student/:studentId', authenticateToken, async (req, res) => {
  try {
    const { studentId } = req.params;
    const { month, year } = req.query;

    if (!month || !year) {
      return res.status(400).json({ success: false, error: 'Month and year are required' });
    }

    const summary = await AttendanceService.getStudentMonthlySummary(
      studentId,
      parseInt(month as string),
      parseInt(year as string)
    );

    res.json({ success: true, data: summary });
  } catch (error) {
    console.error('Error fetching student summary:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch student attendance summary' });
  }
});

export default router;
