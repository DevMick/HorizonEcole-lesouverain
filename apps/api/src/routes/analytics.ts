import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth';
import { AnalyticsService } from '../services/analytics.service';

const router = Router();

// Global dashboard
router.get('/dashboard', authenticateToken, requireRole(['ADMIN', 'COMPTABLE']), async (req, res) => {
  try {
    const data = await AnalyticsService.getDashboardData(req.query);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching dashboard:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch dashboard data' });
  }
});

// Revenue breakdown
router.get('/revenues-breakdown', authenticateToken, requireRole(['ADMIN', 'COMPTABLE']), async (req, res) => {
  try {
    const { year, startDate, endDate } = req.query;
    const data = await AnalyticsService.getRevenuesBreakdown({
      year: year ? parseInt(year as string) : undefined,
      startDate: startDate as string,
      endDate: endDate as string,
    });
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching revenues breakdown:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch revenues breakdown' });
  }
});

// Expenses breakdown
router.get('/expenses-breakdown', authenticateToken, requireRole(['ADMIN', 'COMPTABLE']), async (req, res) => {
  try {
    const { year, startDate, endDate } = req.query;
    const data = await AnalyticsService.getExpensesBreakdown({
      year: year ? parseInt(year as string) : undefined,
      startDate: startDate as string,
      endDate: endDate as string,
    });
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching expenses breakdown:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch expenses breakdown' });
  }
});

// Students debts report
router.get('/debts', authenticateToken, requireRole(['ADMIN', 'COMPTABLE']), async (req, res) => {
  try {
    const { academicYearId } = req.query;
    const data = await AnalyticsService.getStudentsDebts(academicYearId as string);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching debts:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch debts report' });
  }
});

// Academic performance
router.get('/academic-performance', authenticateToken, requireRole(['ADMIN', 'ENSEIGNANT']), async (req, res) => {
  try {
    const { academicYearId } = req.query;
    const data = await AnalyticsService.getAcademicPerformance(academicYearId as string);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching academic performance:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch academic performance' });
  }
});

// Attendance overview
router.get('/attendance-overview', authenticateToken, requireRole(['ADMIN', 'ENSEIGNANT']), async (req, res) => {
  try {
    const { year, month } = req.query;
    const data = await AnalyticsService.getAttendanceOverview({
      year: year ? parseInt(year as string) : undefined,
      month: month ? parseInt(month as string) : undefined,
    });
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching attendance overview:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch attendance overview' });
  }
});

// Discipline overview
router.get('/discipline-overview', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { year, startDate, endDate } = req.query;
    const data = await AnalyticsService.getDisciplineOverview({
      year: year ? parseInt(year as string) : undefined,
      startDate: startDate as string,
      endDate: endDate as string,
    });
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching discipline overview:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch discipline overview' });
  }
});

// Monthly finance report
router.get('/reports/finance/monthly', authenticateToken, requireRole(['ADMIN', 'COMPTABLE']), async (req, res) => {
  try {
    const { year, month } = req.query;
    
    if (!year || !month) {
      return res.status(400).json({ success: false, error: 'Year and month are required' });
    }

    const data = await AnalyticsService.getMonthlyFinanceReport(
      parseInt(year as string),
      parseInt(month as string)
    );
    
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error generating monthly report:', error);
    res.status(500).json({ success: false, error: 'Failed to generate monthly report' });
  }
});

// Alerts
router.get('/alerts', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const data = await AnalyticsService.getAlerts();
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch alerts' });
  }
});

export default router;
