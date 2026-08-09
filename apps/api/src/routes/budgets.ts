import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth';
import { validateRequest } from '../middleware/validate';
import { BudgetService, createBudgetSchema, updateBudgetSchema } from '../services/finance.service';
import { auditLogger } from '../middleware/auditTracking';

const router = Router();

router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await BudgetService.getBudgets(req.query);
    res.json({ success: true, data: result.budgets, pagination: result.pagination });
  } catch (error) {
    console.error('Error fetching budgets:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch budgets' });
  }
});

router.get('/stats', authenticateToken, requireRole(['ADMIN', 'COMPTABLE']), async (req, res) => {
  try {
    const { academicYearId } = req.query;
    const stats = await BudgetService.getBudgetStats(academicYearId as string);
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Error fetching budget stats:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch budget statistics' });
  }
});

router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const budget = await BudgetService.getBudgetById(req.params.id);
    res.json({ success: true, data: budget });
  } catch (error) {
    if (error instanceof Error && error.message === 'Budget not found') {
      return res.status(404).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: 'Failed to fetch budget' });
  }
});

router.post('/', authenticateToken, requireRole(['ADMIN', 'COMPTABLE']), validateRequest(createBudgetSchema), async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const budget = await BudgetService.createBudget(req.body);
    auditLogger.info('Budget created', { userId, budgetId: budget.id, category: budget.category });
    res.status(201).json({ success: true, data: budget, message: 'Budget created successfully' });
  } catch (error) {
    if (error instanceof Error && (error.message.includes('not found') || error.message.includes('already exists'))) {
      return res.status(400).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: 'Failed to create budget' });
  }
});

router.put('/:id', authenticateToken, requireRole(['ADMIN', 'COMPTABLE']), validateRequest(updateBudgetSchema), async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const budget = await BudgetService.updateBudget(req.params.id, req.body);
    auditLogger.info('Budget updated', { userId, budgetId: req.params.id });
    res.json({ success: true, data: budget, message: 'Budget updated successfully' });
  } catch (error) {
    if (error instanceof Error && error.message === 'Budget not found') {
      return res.status(404).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: 'Failed to update budget' });
  }
});

router.delete('/:id', authenticateToken, requireRole(['ADMIN', 'COMPTABLE']), async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const result = await BudgetService.deleteBudget(req.params.id);
    auditLogger.info('Budget deleted', { userId, budgetId: req.params.id });
    res.json({ success: true, message: result.message });
  } catch (error) {
    if (error instanceof Error && error.message === 'Budget not found') {
      return res.status(404).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: 'Failed to delete budget' });
  }
});

export default router;
