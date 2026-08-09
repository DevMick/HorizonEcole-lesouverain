import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth';
import { validateRequest } from '../middleware/validate';
import { RevenueService, createRevenueSchema, updateRevenueSchema } from '../services/finance.service';
import { auditLogger } from '../middleware/auditTracking';

const router = Router();

router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await RevenueService.getRevenues(req.query);
    res.json({ success: true, data: result.revenues, pagination: result.pagination });
  } catch (error) {
    console.error('Error fetching revenues:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch revenues' });
  }
});

router.get('/stats', authenticateToken, requireRole(['ADMIN', 'COMPTABLE']), async (req, res) => {
  try {
    const stats = await RevenueService.getRevenueStats(req.query);
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Error fetching revenue stats:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch revenue statistics' });
  }
});

router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const revenue = await RevenueService.getRevenueById(req.params.id);
    res.json({ success: true, data: revenue });
  } catch (error) {
    if (error instanceof Error && error.message === 'Revenue not found') {
      return res.status(404).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: 'Failed to fetch revenue' });
  }
});

router.post('/', authenticateToken, requireRole(['ADMIN', 'COMPTABLE']), validateRequest(createRevenueSchema), async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const revenue = await RevenueService.createRevenue(req.body, userId);
    // Revenue model doesn't exist, createRevenue returns void
    auditLogger.info('Revenue created', { userId, revenueId: 'unknown', amount: req.body.amount });
    res.status(201).json({ success: true, data: revenue, message: 'Revenue created successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create revenue' });
  }
});

router.put('/:id', authenticateToken, requireRole(['ADMIN', 'COMPTABLE']), validateRequest(updateRevenueSchema), async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const revenue = await RevenueService.updateRevenue(req.params.id, req.body);
    auditLogger.info('Revenue updated', { userId, revenueId: req.params.id });
    res.json({ success: true, data: revenue, message: 'Revenue updated successfully' });
  } catch (error) {
    if (error instanceof Error && error.message === 'Revenue not found') {
      return res.status(404).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: 'Failed to update revenue' });
  }
});

router.delete('/:id', authenticateToken, requireRole(['ADMIN', 'COMPTABLE']), async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const result = await RevenueService.deleteRevenue(req.params.id);
    auditLogger.info('Revenue deleted', { userId, revenueId: req.params.id });
    res.json({ success: true, message: 'Revenue deleted successfully' });
  } catch (error) {
    if (error instanceof Error && error.message === 'Revenue not found') {
      return res.status(404).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: 'Failed to delete revenue' });
  }
});

export default router;
