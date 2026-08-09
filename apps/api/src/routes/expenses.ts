import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth';
import { validateRequest } from '../middleware/validate';
import { ExpenseService, createExpenseSchema, updateExpenseSchema } from '../services/finance.service';
import { auditLogger } from '../middleware/auditTracking';

const router = Router();

router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await ExpenseService.getExpenses(req.query);
    res.json({ success: true, data: result.expenses, pagination: result.pagination });
  } catch (error) {
    console.error('Error fetching expenses:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch expenses' });
  }
});

router.get('/stats', authenticateToken, requireRole(['ADMIN', 'COMPTABLE']), async (req, res) => {
  try {
    const stats = await ExpenseService.getExpenseStats(req.query);
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Error fetching expense stats:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch expense statistics' });
  }
});

router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const expense = await ExpenseService.getExpenseById(req.params.id);
    res.json({ success: true, data: expense });
  } catch (error) {
    if (error instanceof Error && error.message === 'Expense not found') {
      return res.status(404).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: 'Failed to fetch expense' });
  }
});

router.post('/', authenticateToken, requireRole(['ADMIN', 'COMPTABLE']), validateRequest(createExpenseSchema), async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const expense = await ExpenseService.createExpense(req.body, userId);
    auditLogger.info('Expense created', { userId, expenseId: expense.id, amount: expense.amount });
    res.status(201).json({ success: true, data: expense, message: 'Expense created successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create expense' });
  }
});

router.put('/:id', authenticateToken, requireRole(['ADMIN', 'COMPTABLE']), validateRequest(updateExpenseSchema), async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const expense = await ExpenseService.updateExpense(req.params.id, req.body);
    auditLogger.info('Expense updated', { userId, expenseId: req.params.id });
    res.json({ success: true, data: expense, message: 'Expense updated successfully' });
  } catch (error) {
    if (error instanceof Error && error.message === 'Expense not found') {
      return res.status(404).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: 'Failed to update expense' });
  }
});

router.post('/:id/approve', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const expense = await ExpenseService.approveExpense(req.params.id, userId);
    auditLogger.info('Expense approved', { userId, expenseId: req.params.id });
    res.json({ success: true, data: expense, message: 'Expense approved successfully' });
  } catch (error) {
    if (error instanceof Error && error.message === 'Expense not found') {
      return res.status(404).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: 'Failed to approve expense' });
  }
});

router.delete('/:id', authenticateToken, requireRole(['ADMIN', 'COMPTABLE']), async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const result = await ExpenseService.deleteExpense(req.params.id);
    auditLogger.info('Expense deleted', { userId, expenseId: req.params.id });
    res.json({ success: true, message: result.message });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Expense not found') {
        return res.status(404).json({ success: false, error: error.message });
      }
      if (error.message.includes('Cannot delete')) {
        return res.status(400).json({ success: false, error: error.message });
      }
    }
    res.status(500).json({ success: false, error: 'Failed to delete expense' });
  }
});

export default router;
