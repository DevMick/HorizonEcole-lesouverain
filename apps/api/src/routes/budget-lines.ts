import { Router } from 'express';
import { z } from 'zod';
import { authenticateToken, requireRole } from '../middleware/auth';
import { validateRequest } from '../middleware/validate';
import { BudgetLineService, createBudgetLineSchema, updateBudgetLineSchema } from '../services/finance.service';
import { auditLogger } from '../middleware/auditTracking';

const router = Router();

// Wrap schemas to match validate middleware structure
const createBudgetLineRouteSchema = z.object({
  body: createBudgetLineSchema,
});

const updateBudgetLineRouteSchema = z.object({
  body: updateBudgetLineSchema,
});

router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await BudgetLineService.getBudgetLines(req.query);
    res.json({ success: true, data: result.budgetLines, pagination: result.pagination });
  } catch (error) {
    console.error('Error fetching budget lines:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch budget lines' });
  }
});

router.get('/stats', authenticateToken, requireRole('ADMIN', 'ACCOUNTANT'), async (req, res) => {
  try {
    const { academicYearId } = req.query;
    const stats = await BudgetLineService.getBudgetLineStats(academicYearId as string);
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Error fetching budget line stats:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch budget line statistics' });
  }
});

router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const budgetLine = await BudgetLineService.getBudgetLineById(req.params.id);
    res.json({ success: true, data: budgetLine });
  } catch (error) {
    if (error instanceof Error && error.message === 'Budget line not found') {
      return res.status(404).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: 'Failed to fetch budget line' });
  }
});

router.post('/', authenticateToken, requireRole('ADMIN', 'ACCOUNTANT'), validateRequest(createBudgetLineRouteSchema), async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const budgetLine = await BudgetLineService.createBudgetLine(req.body);
    auditLogger.info('Budget line created', { userId, budgetLineId: budgetLine.id, type: budgetLine.type });
    res.status(201).json({ success: true, data: budgetLine, message: 'Budget line created successfully' });
  } catch (error) {
    if (error instanceof Error && (error.message.includes('not found') || error.message.includes('same type') || error.message.includes('same academic year'))) {
      return res.status(400).json({ success: false, error: error.message });
    }
    console.error('Error creating budget line:', error);
    res.status(500).json({ success: false, error: 'Failed to create budget line' });
  }
});

router.put('/:id', authenticateToken, requireRole('ADMIN', 'ACCOUNTANT'), validateRequest(updateBudgetLineRouteSchema), async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const budgetLine = await BudgetLineService.updateBudgetLine(req.params.id, req.body);
    auditLogger.info('Budget line updated', { userId, budgetLineId: req.params.id });
    res.json({ success: true, data: budgetLine, message: 'Budget line updated successfully' });
  } catch (error) {
    if (error instanceof Error && (error.message === 'Budget line not found' || error.message.includes('same type') || error.message.includes('same academic year') || error.message.includes('Cannot set a child'))) {
      return res.status(400).json({ success: false, error: error.message });
    }
    console.error('Error updating budget line:', error);
    res.status(500).json({ success: false, error: 'Failed to update budget line' });
  }
});

router.delete('/:id', authenticateToken, requireRole('ADMIN', 'ACCOUNTANT'), async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const result = await BudgetLineService.deleteBudgetLine(req.params.id);
    auditLogger.info('Budget line deleted', { userId, budgetLineId: req.params.id });
    res.json({ success: true, message: result.message });
  } catch (error) {
    if (error instanceof Error && (error.message === 'Budget line not found' || error.message.includes('children'))) {
      return res.status(400).json({ success: false, error: error.message });
    }
    console.error('Error deleting budget line:', error);
    res.status(500).json({ success: false, error: 'Failed to delete budget line' });
  }
});

export default router;

