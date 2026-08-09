import { Router } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, requireRole } from '../middleware/auth';
import { validateRequest } from '../middleware/validate';
import { StaffService, createStaffSchema, updateStaffSchema, generateSalarySchema } from '../services/staff.service';
import { PDFService } from '../services/pdf.service';
import { auditLogger } from '../middleware/auditTracking';

const router = Router();
const prisma = new PrismaClient();

// Staff CRUD routes
router.get('/', authenticateToken, async (req, res) => {
  try {
    const {
      function: staffFunction,
      contractType,
      isActive,
      search,
      page = '1',
      limit = '10'
    } = req.query;

    const filters = {
      function: staffFunction as string,
      contractType: contractType as string,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      search: search as string,
      page: parseInt(page as string),
      limit: parseInt(limit as string),
    };

    const result = await StaffService.getStaff(filters);

    res.json({
      success: true,
      data: result.staff,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error('Error fetching staff:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch staff members',
    });
  }
});

router.get('/stats', authenticateToken, requireRole(['ADMIN', 'COMPTABLE']), async (req, res) => {
  try {
    const stats = await StaffService.getStaffStats();
    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Error fetching staff stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch staff statistics',
    });
  }
});

router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const staff = await StaffService.getStaffById(id);

    res.json({
      success: true,
      data: staff,
    });
  } catch (error) {
    console.error('Error fetching staff member:', error);
    if (error instanceof Error && error.message === 'Staff member not found') {
      return res.status(404).json({
        success: false,
        error: error.message,
      });
    }
    res.status(500).json({
      success: false,
      error: 'Failed to fetch staff member',
    });
  }
});

router.post('/', authenticateToken, requireRole(['ADMIN']), validateRequest(createStaffSchema), async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const staff = await StaffService.createStaff(req.body, userId);

    auditLogger.info('Staff member created', {
      userId,
      staffId: staff.id,
      staffName: `${staff.first_name} ${staff.last_name}`,
    });

    res.status(201).json({
      success: true,
      data: staff,
      message: 'Staff member created successfully',
    });
  } catch (error) {
    console.error('Error creating staff member:', error);
    if (error instanceof Error && error.message === 'Email already exists') {
      return res.status(400).json({
        success: false,
        error: error.message,
      });
    }
    res.status(500).json({
      success: false,
      error: 'Failed to create staff member',
    });
  }
});

router.put('/:id', authenticateToken, requireRole(['ADMIN']), validateRequest(updateStaffSchema), async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.userId;
    
    const staff = await StaffService.updateStaff(id, req.body);

    auditLogger.info('Staff member updated', {
      userId,
      staffId: id,
      staffName: `${staff.first_name} ${staff.last_name}`,
    });

    res.json({
      success: true,
      data: staff,
      message: 'Staff member updated successfully',
    });
  } catch (error) {
    console.error('Error updating staff member:', error);
    if (error instanceof Error && (error.message === 'Staff member not found' || error.message === 'Email already exists')) {
      return res.status(error.message === 'Staff member not found' ? 404 : 400).json({
        success: false,
        error: error.message,
      });
    }
    res.status(500).json({
      success: false,
      error: 'Failed to update staff member',
    });
  }
});

router.delete('/:id', authenticateToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.userId;
    
    // const staff = await prisma.staff.findUnique({ // Model does not exist - use teachers instead
    const staff = await prisma.teachers.findUnique({
      where: { id },
      select: { first_name: true, last_name: true }
    });

    const result = await StaffService.deleteStaff(id);

    auditLogger.info('Staff member deleted', {
      userId,
      staffId: id,
      staffName: staff ? `${staff.first_name} ${staff.last_name}` : 'Unknown',
    });

    res.json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    console.error('Error deleting staff member:', error);
    if (error instanceof Error && error.message === 'Staff member not found') {
      return res.status(404).json({
        success: false,
        error: error.message,
      });
    }
    res.status(500).json({
      success: false,
      error: 'Failed to delete staff member',
    });
  }
});

// Salary routes
router.get('/:id/salaries', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      month,
      year,
      status,
      page = '1',
      limit = '10'
    } = req.query;

    const filters = {
      staffId: id,
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
    console.error('Error fetching staff salaries:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch staff salaries',
    });
  }
});

router.post('/:id/salaries', authenticateToken, requireRole(['ADMIN', 'COMPTABLE']), validateRequest(generateSalarySchema), async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.userId;
    
    const salary = await StaffService.generateSalary(id, req.body, userId);

    auditLogger.info('Salary generated', {
      userId,
      staffId: id,
      salaryId: salary.id,
      month: req.body.month,
      year: req.body.year,
    });

    res.status(201).json({
      success: true,
      data: salary,
      message: 'Salary generated successfully',
    });
  } catch (error) {
    console.error('Error generating salary:', error);
    if (error instanceof Error && (error.message === 'Staff member not found' || error.message === 'Salary already exists for this month and year')) {
      return res.status(error.message === 'Staff member not found' ? 404 : 400).json({
        success: false,
        error: error.message,
      });
    }
    res.status(500).json({
      success: false,
      error: 'Failed to generate salary',
    });
  }
});

export default router;