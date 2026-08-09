import { Router } from 'express';
import { z } from 'zod';
import { authenticateToken, requireRole } from '../middleware/auth';
import { validateRequest } from '../middleware/validate';
import { BudgetTransactionService, createBudgetTransactionSchema, updateBudgetTransactionSchema } from '../services/finance.service';
import { auditLogger } from '../middleware/auditTracking';
import { justificatifUpload, handleUploadError, getFileUrl, getFilePath, deleteFile } from '../middleware/upload';

const router = Router();

// Wrap schemas to match validate middleware structure
// Note: justificatifUrl and justificatifFilename will come from the uploaded file
const createBudgetTransactionRouteSchema = z.object({
  body: createBudgetTransactionSchema.omit({ justificatifUrl: true, justificatifFilename: true }),
});

const updateBudgetTransactionRouteSchema = z.object({
  body: updateBudgetTransactionSchema.omit({ justificatifUrl: true, justificatifFilename: true }),
});

router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await BudgetTransactionService.getTransactions(req.query);
    res.json({ success: true, data: result.transactions, pagination: result.pagination });
  } catch (error) {
    console.error('Error fetching budget transactions:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch budget transactions' });
  }
});

router.get('/comparison', authenticateToken, async (req, res) => {
  try {
    const { academicYearId } = req.query;
    const comparison = await BudgetTransactionService.getBudgetComparison(academicYearId as string);
    res.json({ success: true, data: comparison });
  } catch (error) {
    console.error('Error fetching budget comparison:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch budget comparison' });
  }
});

router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const transaction = await BudgetTransactionService.getTransactionById(req.params.id);
    res.json({ success: true, data: transaction });
  } catch (error) {
    if (error instanceof Error && error.message === 'Transaction not found') {
      return res.status(404).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: 'Failed to fetch transaction' });
  }
});

router.post('/', authenticateToken, requireRole('ADMIN', 'ACCOUNTANT'), justificatifUpload.single('justificatif'), handleUploadError, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }

    // Convert FormData values (all strings) to proper types
    const bodyData = {
      ...req.body,
      amount: req.body.amount ? Number(req.body.amount) : undefined,
    };

    // Validate body
    const bodySchema = createBudgetTransactionRouteSchema.shape.body;
    const validatedBody = bodySchema.parse(bodyData);

    // Handle file upload
    let justificatifUrl: string | undefined;
    let justificatifFilename: string | undefined;
    
    if (req.file) {
      justificatifUrl = getFileUrl(req.file.filename, 'justificatif');
      justificatifFilename = req.file.originalname;
    }

    const transactionData = {
      ...validatedBody,
      justificatifUrl,
      justificatifFilename,
    };
    
    const transaction = await BudgetTransactionService.createTransaction(transactionData, userId);
    auditLogger.info('Budget transaction created', { userId, transactionId: transaction.id, budgetLineId: transaction.budget_line_id });
    res.status(201).json({ success: true, data: transaction, message: 'Transaction created successfully' });
  } catch (error) {
    // If validation error, clean up uploaded file
    if (req.file) {
      try {
        await deleteFile(getFilePath(req.file.filename, 'justificatif'));
      } catch (deleteError) {
        console.error('Error deleting uploaded file:', deleteError);
      }
    }

    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
    }
    if (error instanceof Error && error.message.includes('not found')) {
      return res.status(400).json({ success: false, error: error.message });
    }
    console.error('Error creating budget transaction:', error);
    res.status(500).json({ success: false, error: 'Failed to create transaction' });
  }
});

router.put('/:id', authenticateToken, requireRole('ADMIN', 'ACCOUNTANT'), justificatifUpload.single('justificatif'), handleUploadError, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    
    // Get existing transaction to check for old file
    const existingTransaction = await BudgetTransactionService.getTransactionById(req.params.id);
    
    // Convert FormData values (all strings) to proper types
    const bodyData = {
      ...req.body,
      amount: req.body.amount ? Number(req.body.amount) : undefined,
    };

    // Validate body
    const bodySchema = updateBudgetTransactionRouteSchema.shape.body;
    const validatedBody = bodySchema.parse(bodyData);

    // Handle file upload
    let justificatifUrl: string | undefined;
    let justificatifFilename: string | undefined;
    
    if (req.file) {
      // Delete old file if exists
      if (existingTransaction.justificatif_url) {
        try {
          const oldFilename = existingTransaction.justificatif_url.split('/').pop();
          if (oldFilename) {
            await deleteFile(getFilePath(oldFilename, 'justificatif'));
          }
        } catch (deleteError) {
          console.error('Error deleting old file:', deleteError);
        }
      }
      
      justificatifUrl = getFileUrl(req.file.filename, 'justificatif');
      justificatifFilename = req.file.originalname;
    } else {
      // Keep existing file if not uploading new one
      justificatifUrl = existingTransaction.justificatif_url || undefined;
      justificatifFilename = existingTransaction.justificatif_filename || undefined;
    }

    const transactionData = {
      ...validatedBody,
      justificatifUrl,
      justificatifFilename,
    };
    
    const transaction = await BudgetTransactionService.updateTransaction(req.params.id, transactionData);
    auditLogger.info('Budget transaction updated', { userId, transactionId: req.params.id });
    res.json({ success: true, data: transaction, message: 'Transaction updated successfully' });
  } catch (error) {
    // If error, clean up uploaded file
    if (req.file) {
      try {
        await deleteFile(getFilePath(req.file.filename, 'justificatif'));
      } catch (deleteError) {
        console.error('Error deleting uploaded file:', deleteError);
      }
    }

    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
    }
    if (error instanceof Error && error.message === 'Transaction not found') {
      return res.status(404).json({ success: false, error: error.message });
    }
    console.error('Error updating budget transaction:', error);
    res.status(500).json({ success: false, error: 'Failed to update transaction' });
  }
});

router.delete('/:id', authenticateToken, requireRole('ADMIN', 'ACCOUNTANT'), async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    
    // Get transaction to delete associated file
    const transaction = await BudgetTransactionService.getTransactionById(req.params.id);
    
    // Delete associated file if exists
    if (transaction.justificatif_url) {
      try {
        const filename = transaction.justificatif_url.split('/').pop();
        if (filename) {
          await deleteFile(getFilePath(filename, 'justificatif'));
        }
      } catch (deleteError) {
        console.error('Error deleting associated file:', deleteError);
        // Continue with transaction deletion even if file deletion fails
      }
    }
    
    const result = await BudgetTransactionService.deleteTransaction(req.params.id);
    auditLogger.info('Budget transaction deleted', { userId, transactionId: req.params.id });
    res.json({ success: true, message: result.message });
  } catch (error) {
    if (error instanceof Error && error.message === 'Transaction not found') {
      return res.status(404).json({ success: false, error: error.message });
    }
    console.error('Error deleting budget transaction:', error);
    res.status(500).json({ success: false, error: 'Failed to delete transaction' });
  }
});

export default router;

