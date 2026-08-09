import { Router } from 'express';
import { z } from 'zod';
import { authenticateToken, requireRole } from '../middleware/auth';
import { validateRequest } from '../middleware/validate';
import { StaffService } from '../services/staff.service';
import { PDFService } from '../services/pdf.service';
import { auditLogger } from '../middleware/auditTracking';

const router = Router();

// Salary CRUD routes
router.get('/', authenticateToken, requireRole(['ADMIN', 'COMPTABLE']), async (req, res) => {
  try {
    const {
      staffId,
      month,
      year,
      status,
      page = '1',
      limit = '10'
    } = req.query;

    const filters = {
      staffId: staffId as string,
      month: month ? parseInt(month as string) : undefined,
      year: year ? parseInt(year as string) : undefined,
      status: status as string,
      page: parseInt(page as string),
      limit: parseInt(limit as string),
    };

    const result = await StaffService.getSalaries(filters);

    res.json({
      success: true,
      data: result.salaries,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error('Error fetching salaries:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch salaries',
    });
  }
});

router.get('/overview', authenticateToken, requireRole(['ADMIN', 'COMPTABLE']), async (req, res) => {
  try {
    const { year, month } = req.query;
    
    const overview = await StaffService.getPayrollOverview(
      year ? parseInt(year as string) : undefined,
      month ? parseInt(month as string) : undefined
    );

    res.json({
      success: true,
      data: overview,
    });
  } catch (error) {
    console.error('Error fetching payroll overview:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch payroll overview',
    });
  }
});

router.get('/:id', authenticateToken, requireRole(['ADMIN', 'COMPTABLE']), async (req, res) => {
  try {
    const { id } = req.params;
    const salary = await StaffService.getSalaryById(id);

    res.json({
      success: true,
      data: salary,
    });
  } catch (error) {
    console.error('Error fetching salary:', error);
    if (error instanceof Error && error.message === 'Salary record not found') {
      return res.status(404).json({
        success: false,
        error: error.message,
      });
    }
    res.status(500).json({
      success: false,
      error: 'Failed to fetch salary record',
    });
  }
});

router.put('/:id/status', authenticateToken, requireRole(['ADMIN', 'COMPTABLE']), async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = (req as any).user.userId;

    if (!status || !['DRAFT', 'APPROVED', 'PAID'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status. Must be DRAFT, APPROVED, or PAID',
      });
    }

    const salary = await StaffService.updateSalaryStatus(id, status);

    auditLogger.info('Salary status updated', {
      userId,
      salaryId: id,
      newStatus: status,
        staffId: salary.teacher_id,
    });

    res.json({
      success: true,
      data: salary,
      message: 'Salary status updated successfully',
    });
  } catch (error) {
    console.error('Error updating salary status:', error);
    if (error instanceof Error && error.message === 'Salary record not found') {
      return res.status(404).json({
        success: false,
        error: error.message,
      });
    }
    res.status(500).json({
      success: false,
      error: 'Failed to update salary status',
    });
  }
});

router.post('/:id/generate-pdf', authenticateToken, requireRole(['ADMIN', 'COMPTABLE']), async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.userId;

    const pdfUrl = await PDFService.generateSalarySlip(id);

    auditLogger.info('Salary slip PDF generated', {
      userId,
      salaryId: id,
      pdfUrl,
    });

    res.json({
      success: true,
      data: { pdfUrl },
      message: 'Salary slip PDF generated successfully',
    });
  } catch (error) {
    console.error('Error generating salary slip PDF:', error);
    if (error instanceof Error && error.message === 'Salary record not found') {
      return res.status(404).json({
        success: false,
        error: error.message,
      });
    }
    res.status(500).json({
      success: false,
      error: 'Failed to generate salary slip PDF',
    });
  }
});

router.get('/:id/pdf', authenticateToken, requireRole(['ADMIN', 'COMPTABLE']), async (req, res) => {
  try {
    const { id } = req.params;
    const pdfUrl = await PDFService.getSalarySlipUrl(id);

    if (!pdfUrl) {
      return res.status(404).json({
        success: false,
        error: 'Salary slip PDF not found. Please generate it first.',
      });
    }

    res.json({
      success: true,
      data: { pdfUrl },
    });
  } catch (error) {
    console.error('Error fetching salary slip PDF URL:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch salary slip PDF URL',
    });
  }
});

router.delete('/:id', authenticateToken, requireRole(['ADMIN', 'COMPTABLE']), async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.userId;

    // Delete the PDF file if it exists
    await PDFService.deleteSalarySlip(id);
    
    const result = await StaffService.deleteSalary(id);

    auditLogger.info('Salary record deleted', {
      userId,
      salaryId: id,
    });

    res.json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    console.error('Error deleting salary:', error);
    if (error instanceof Error && (error.message === 'Salary record not found' || error.message === 'Cannot delete a paid salary record')) {
      return res.status(error.message === 'Salary record not found' ? 404 : 400).json({
        success: false,
        error: error.message,
      });
    }
    res.status(500).json({
      success: false,
      error: 'Failed to delete salary record',
    });
  }
});

// Bulk operations
router.post('/bulk-generate', authenticateToken, requireRole(['ADMIN', 'COMPTABLE']), async (req, res) => {
  try {
    const { staffIds, month, year, allowances = [], deductions = [], notes } = req.body;
    const userId = (req as any).user.userId;

    if (!Array.isArray(staffIds) || staffIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Staff IDs array is required',
      });
    }

    if (!month || !year) {
      return res.status(400).json({
        success: false,
        error: 'Month and year are required',
      });
    }

    const results = [];
    const errors = [];

    for (const staffId of staffIds) {
      try {
        const salary = await StaffService.generateSalary(staffId, {
          month,
          year,
          allowances,
          deductions,
          notes,
        }, userId);

        results.push(salary);
      } catch (error) {
        errors.push({
          staffId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    auditLogger.info('Bulk salary generation completed', {
      userId,
      month,
      year,
      successful: results.length,
      failed: errors.length,
    });

    res.json({
      success: true,
      data: {
        generated: results,
        errors,
        summary: {
          total: staffIds.length,
          successful: results.length,
          failed: errors.length,
        },
      },
      message: `Generated ${results.length} salaries, ${errors.length} failed`,
    });
  } catch (error) {
    console.error('Error in bulk salary generation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate salaries in bulk',
    });
  }
});

router.post('/bulk-approve', authenticateToken, requireRole(['ADMIN', 'COMPTABLE']), async (req, res) => {
  try {
    const { salaryIds } = req.body;
    const userId = (req as any).user.userId;

    if (!Array.isArray(salaryIds) || salaryIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Salary IDs array is required',
      });
    }

    const results = [];
    const errors = [];

    for (const salaryId of salaryIds) {
      try {
        const salary = await StaffService.updateSalaryStatus(salaryId, 'VALIDATED');
        results.push(salary);
      } catch (error) {
        errors.push({
          salaryId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    auditLogger.info('Bulk salary approval completed', {
      userId,
      successful: results.length,
      failed: errors.length,
    });

    res.json({
      success: true,
      data: {
        approved: results,
        errors,
        summary: {
          total: salaryIds.length,
          successful: results.length,
          failed: errors.length,
        },
      },
      message: `Approved ${results.length} salaries, ${errors.length} failed`,
    });
  } catch (error) {
    console.error('Error in bulk salary approval:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to approve salaries in bulk',
    });
  }
});

export default router;
