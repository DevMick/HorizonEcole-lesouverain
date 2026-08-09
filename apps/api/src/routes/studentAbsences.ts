import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { StudentAbsenceService } from '../services/studentAbsence.service';
import { z } from 'zod';

const router = Router();

const createAbsenceSchema = z.object({
  academicYearId: z.string().uuid('Invalid academic year ID'),
  studentId: z.string().uuid('Invalid student ID'),
  semesterId: z.string().uuid('Invalid semester ID'),
  subjectId: z.string().uuid('Invalid subject ID'),
  teacherId: z.string().uuid('Invalid teacher ID'),
  hoursAbsent: z.number().positive('Hours absent must be positive'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
});

const updateAbsenceSchema = z.object({
  hoursAbsent: z.number().positive('Hours absent must be positive').optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional(),
});

/**
 * GET /api/student-absences
 * Get all student absences with optional filters
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const filters: any = {};
    
    if (req.query.academicYearId) {
      filters.academicYearId = req.query.academicYearId as string;
    }
    if (req.query.teacherId) {
      filters.teacherId = req.query.teacherId as string;
    }
    if (req.query.studentId) {
      filters.studentId = req.query.studentId as string;
    }
    if (req.query.subjectId) {
      filters.subjectId = req.query.subjectId as string;
    }
    if (req.query.semesterId) {
      filters.semesterId = req.query.semesterId as string;
    }
    if (req.query.date) {
      filters.date = req.query.date as string;
    }
    if (req.query.classId) {
      filters.classId = req.query.classId as string;
    }

    const absences = await StudentAbsenceService.getAll(filters);

    res.json({
      success: true,
      data: absences,
    });
  } catch (error: any) {
    console.error('Error fetching student absences:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch student absences',
    });
  }
});

/**
 * GET /api/student-absences/teacher/:teacherId/classes
 * Get classes for a teacher
 */
router.get('/teacher/:teacherId/classes', authenticate, async (req, res) => {
  try {
    const { teacherId } = req.params;
    const academicYearId = req.query.academicYearId as string;

    if (!academicYearId) {
      return res.status(400).json({
        success: false,
        error: 'academicYearId is required',
      });
    }

    const classes = await StudentAbsenceService.getTeacherClasses(teacherId, academicYearId);

    res.json({
      success: true,
      data: classes,
    });
  } catch (error: any) {
    console.error('Error fetching teacher classes:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch teacher classes',
    });
  }
});

/**
 * GET /api/student-absences/timetable
 * Get timetable for a teacher's class/subject
 */
router.get('/timetable', authenticate, async (req, res) => {
  try {
    const { teacherId, classId, subjectId, academicYearId } = req.query;

    if (!teacherId || !classId || !subjectId || !academicYearId) {
      return res.status(400).json({
        success: false,
        error: 'teacherId, classId, subjectId, and academicYearId are required',
      });
    }

    const timetables = await StudentAbsenceService.getTeacherTimetableForClass(
      teacherId as string,
      classId as string,
      subjectId as string,
      academicYearId as string
    );

    res.json({
      success: true,
      data: timetables,
    });
  } catch (error: any) {
    console.error('Error fetching timetable:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch timetable',
    });
  }
});

/**
 * GET /api/student-absences/:id
 * Get absence by ID
 */
router.get('/:id', authenticate, async (req, res) => {
  try {
    const absence = await StudentAbsenceService.getById(req.params.id);

    res.json({
      success: true,
      data: absence,
    });
  } catch (error: any) {
    console.error('Error fetching absence:', error);
    res.status(404).json({
      success: false,
      error: error.message || 'Absence not found',
    });
  }
});

/**
 * POST /api/student-absences
 * Create a new absence
 */
router.post('/', authenticate, requireRole('TEACHER', 'ADMIN'), async (req, res) => {
  try {
    const validatedData = createAbsenceSchema.parse(req.body);

    const absence = await StudentAbsenceService.create({
      academicYearId: validatedData.academicYearId,
      studentId: validatedData.studentId,
      semesterId: validatedData.semesterId,
      subjectId: validatedData.subjectId,
      teacherId: validatedData.teacherId,
      hoursAbsent: validatedData.hoursAbsent,
      date: validatedData.date,
    });

    res.status(201).json({
      success: true,
      data: absence,
      message: 'Absence created successfully',
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: error.errors[0].message,
        details: error.errors,
      });
    }

    console.error('Error creating absence:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create absence',
    });
  }
});

/**
 * PATCH /api/student-absences/:id
 * Update an absence
 */
router.patch('/:id', authenticate, requireRole('TEACHER', 'ADMIN'), async (req, res) => {
  try {
    const validatedData = updateAbsenceSchema.parse(req.body);

    const absence = await StudentAbsenceService.update(req.params.id, validatedData);

    res.json({
      success: true,
      data: absence,
      message: 'Absence updated successfully',
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: error.errors[0].message,
        details: error.errors,
      });
    }

    console.error('Error updating absence:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update absence',
    });
  }
});

/**
 * DELETE /api/student-absences/:id
 * Delete an absence
 */
router.delete('/:id', authenticate, requireRole('TEACHER', 'ADMIN'), async (req, res) => {
  try {
    await StudentAbsenceService.delete(req.params.id);

    res.json({
      success: true,
      message: 'Absence deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting absence:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete absence',
    });
  }
});

export default router;

