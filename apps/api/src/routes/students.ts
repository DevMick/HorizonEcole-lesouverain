import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '@school/database';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { StudentService } from '../services/student.service';
import { avatarUpload, documentUpload, handleUploadError, getFileUrl } from '../middleware/upload';

const router = Router();

// Validation schemas
const createStudentSchema = z.object({
  body: z.object({
    studentNumber: z.string().min(1, 'Le matricule est requis'),
    firstName: z.string().min(2, 'Le prénom doit contenir au moins 2 caractères'),
    lastName: z.string().min(2, 'Le nom doit contenir au moins 2 caractères'),
    dateOfBirth: z.string().refine((date) => !isNaN(Date.parse(date)), 'Date de naissance invalide'),
    placeOfBirth: z.string().min(2, 'Le lieu de naissance est requis'),
    gender: z.enum(['M', 'F'], { errorMap: () => ({ message: 'Genre invalide' }) }),
    nationality: z.string().optional(),
    phone: z.string().min(8, 'Contact invalide').optional().or(z.literal('')),
    email: z.string().email().optional().or(z.literal('')),
    address: z.string().optional(),
    bloodType: z.string().optional(),
    allergies: z.string().optional(),
    medicalNotes: z.string().optional(),
    classId: z.string().optional(),
    enrollmentDate: z.string().refine((date) => !isNaN(Date.parse(date)), 'Invalid enrollment date').optional(),
    status: z.enum(['ACTIVE', 'INACTIVE', 'GRADUATED', 'TRANSFERRED', 'EXPELLED']).optional(),
    isStateAssigned: z.boolean().optional(),
    birthCertificateUrl: z.string().optional(),
    vaccinationCardUrl: z.string().optional(),
    previousSchoolReportUrl: z.string().optional(),
  }),
});

const updateStudentSchema = z.object({
  params: z.object({
    id: z.string(),
  }),
  body: z.object({
    studentNumber: z.string().optional(),
    firstName: z.string().min(2).optional(),
    lastName: z.string().min(2).optional(),
    dateOfBirth: z.string().refine((date) => !isNaN(Date.parse(date)), 'Invalid date').optional(),
    placeOfBirth: z.string().optional(),
    gender: z.string().optional(),
    nationality: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email().optional().or(z.literal('')),
    address: z.string().optional(),
    bloodType: z.string().optional(),
    allergies: z.string().optional(),
    medicalNotes: z.string().optional(),
    classId: z.string().optional(),
    enrollmentDate: z.string().refine((date) => !isNaN(Date.parse(date)), 'Invalid enrollment date').optional(),
    status: z.enum(['ACTIVE', 'INACTIVE', 'GRADUATED', 'TRANSFERRED', 'EXPELLED']).optional(),
    isStateAssigned: z.boolean().optional(),
    birthCertificateUrl: z.string().optional(),
    vaccinationCardUrl: z.string().optional(),
    previousSchoolReportUrl: z.string().optional(),
  }),
});

const getStudentsSchema = z.object({
  query: z.object({
    page: z.string().transform(Number).optional(),
    limit: z.string().transform(Number).optional(),
    search: z.string().optional(),
    status: z.string().optional(),
    classId: z.string().optional(),
    gender: z.string().optional(),
    academicYearId: z.string().optional(),
  }),
});

const linkParentSchema = z.object({
  params: z.object({
    id: z.string(),
  }),
  body: z.object({
    parentId: z.string(),
    relation: z.enum(['PERE', 'MERE', 'TUTEUR', 'AUTRE']),
  }),
});

const unlinkParentSchema = z.object({
  params: z.object({
    id: z.string(),
    parentId: z.string(),
  }),
});

// Get all students with pagination and filters
router.get('/', authenticate, validate(getStudentsSchema), async (req, res) => {
  try {
    // After validation, page and limit should be numbers (transformed by Zod)
    const page = typeof req.query.page === 'number' ? req.query.page : (req.query.page ? parseInt(req.query.page as string, 10) : 1);
    const limit = typeof req.query.limit === 'number' ? req.query.limit : (req.query.limit ? parseInt(req.query.limit as string, 10) : 10);

    const result = await StudentService.getStudents({
      page: isNaN(page) || page < 1 ? 1 : page,
      limit: isNaN(limit) || limit < 1 ? 10 : limit,
      search: req.query.search as string,
      status: req.query.status as any,
      classId: req.query.classId as string,
      gender: req.query.gender as string,
      academicYearId: req.query.academicYearId as string,
    });

    res.json({
      success: true,
      data: result.students,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch students',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
  }
});

// Get student by ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const student = await StudentService.getStudentById(req.params.id);

    if (!student) {
      return res.status(404).json({ 
        success: false,
        error: 'Student not found' 
      });
    }

    res.json({
      success: true,
      data: student,
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch student',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Create new student (multipart/form-data: fields + optional 'attachments' files)
router.post('/', authenticate, authorize('ADMIN', 'SECRETARY'),
  documentUpload.array('attachments'), handleUploadError, async (req, res) => {
  try {
    // Multipart bodies arrive as strings - coerce the checkbox before validation
    if (req.body.isStateAssigned !== undefined) {
      req.body.isStateAssigned = req.body.isStateAssigned === 'true' || req.body.isStateAssigned === true;
    }

    const parsed = createStudentSchema.shape.body.parse(req.body);

    const files = (req.files as Express.Multer.File[]) || [];
    const attachments = files.map((file) => getFileUrl(file.filename, 'document'));

    const student = await StudentService.createStudent({
      ...parsed,
      studentNumber: parsed.studentNumber!,
      firstName: parsed.firstName!,
      lastName: parsed.lastName!,
      gender: parsed.gender!,
      address: parsed.address!,
      phone: parsed.phone!,
      placeOfBirth: parsed.placeOfBirth!,
      dateOfBirth: new Date(parsed.dateOfBirth!),
      enrollmentDate: parsed.enrollmentDate ? new Date(parsed.enrollmentDate) : new Date(),
      attachments,
    });

    res.status(201).json({
      success: true,
      data: student,
      message: 'Student created successfully',
    });
  } catch (error: any) {
    if (error?.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        error: 'Données invalides',
        details: error.errors,
      });
    }
    res.status(400).json({
      success: false,
      error: 'Failed to create student',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Update student (multipart/form-data: fields + optional new 'attachments' files)
router.put('/:id', authenticate, authorize('ADMIN', 'SECRETARY'),
  documentUpload.array('attachments'), handleUploadError, async (req, res) => {
  try {
    if (req.body.isStateAssigned !== undefined) {
      req.body.isStateAssigned = req.body.isStateAssigned === 'true' || req.body.isStateAssigned === true;
    }

    const parsed = updateStudentSchema.shape.body.parse(req.body);

    const files = (req.files as Express.Multer.File[]) || [];
    const newAttachments = files.map((file) => getFileUrl(file.filename, 'document'));

    let attachmentsToRemove: string[] = [];
    if (req.body.attachmentsToRemove) {
      try {
        attachmentsToRemove = JSON.parse(req.body.attachmentsToRemove);
      } catch {
        // ignore malformed payload
      }
    }

    const updatePayload: any = { ...parsed };
    if (newAttachments.length > 0 || attachmentsToRemove.length > 0) {
      const existing = await StudentService.getStudentById(req.params.id);
      const remaining = ((existing as any)?.attachments || []).filter(
        (att: string) => !attachmentsToRemove.includes(att)
      );
      updatePayload.attachments = [...remaining, ...newAttachments];
    }

    const student = await StudentService.updateStudent(req.params.id, updatePayload);

    res.json({
      success: true,
      data: student,
      message: 'Student updated successfully',
    });
  } catch (error: any) {
    if (error?.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        error: 'Données invalides',
        details: error.errors,
      });
    }
    if (error instanceof Error && error.message === 'Student not found') {
      return res.status(404).json({ 
        success: false,
        error: 'Student not found' 
      });
    }
    res.status(400).json({ 
      success: false,
      error: 'Failed to update student',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Delete student
router.delete('/:id', authenticate, authorize('ADMIN'), async (req, res) => {
  try {
    await StudentService.deleteStudent(req.params.id);

    res.json({
      success: true,
      message: 'Student deleted successfully',
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Student not found') {
      return res.status(404).json({ 
        success: false,
        error: 'Student not found' 
      });
    }
    res.status(400).json({ 
      success: false,
      error: 'Failed to delete student',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Create a login account for a student (ADMIN only).
// Le mot de passe est généré automatiquement si aucun n'est fourni. Le compte
// reste inactif tant que l'élève n'a pas d'adresse email réelle.
router.post('/:id/create-account', authenticate, authorize('ADMIN'), async (req, res) => {
  try {
    const { password } = req.body || {};
    const result = await StudentService.createUserAccount(req.params.id, password);

    res.status(201).json({
      success: true,
      data: result,
      message: result.isActive
        ? (result.emailSent ? 'Compte créé et actif. Identifiants envoyés par email.' : 'Compte créé et actif.')
        : "Compte créé mais inactif : renseignez une adresse email pour l'activer.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message.includes('non trouvé') || message.includes('déjà') || message.includes('existe déjà')) {
      return res.status(400).json({ success: false, error: message });
    }
    res.status(400).json({
      success: false,
      error: 'Failed to create student account',
      message,
    });
  }
});

// Reset (regenerate) a student's account password (ADMIN only).
router.post('/:id/reset-password', authenticate, authorize('ADMIN'), async (req, res) => {
  try {
    const { password } = req.body || {};
    const result = await StudentService.resetUserPassword(req.params.id, password);

    res.json({
      success: true,
      data: result,
      message: result.emailSent
        ? 'Mot de passe réinitialisé avec succès. Nouveaux identifiants envoyés par email.'
        : 'Mot de passe réinitialisé avec succès',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message.includes('non trouvé') || message.includes('pas encore')) {
      return res.status(400).json({ success: false, error: message });
    }
    res.status(400).json({
      success: false,
      error: 'Failed to reset student password',
      message,
    });
  }
});

// Upload student avatar
router.post('/:id/avatar', authenticate, authorize('ADMIN', 'SECRETARY'),
  avatarUpload.single('avatar'), handleUploadError, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded',
        message: 'Please select an avatar file to upload'
      });
    }

    const avatarUrl = getFileUrl(req.file.filename, 'avatar');
    const student = await StudentService.updateAvatar(req.params.id, avatarUrl);

    res.json({
      success: true,
      data: student,
      message: 'Avatar uploaded successfully',
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: 'Failed to upload avatar',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Upload student documents
router.post('/:id/documents', authenticate, authorize('ADMIN', 'SECRETARY'),
  documentUpload.array('documents', 5), handleUploadError, async (req, res) => {
  try {
    if (!req.files || (req.files as Express.Multer.File[]).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No files uploaded',
        message: 'Please select at least one document to upload'
      });
    }

    const files = req.files as Express.Multer.File[];
    const documentUrls = files.map(file => getFileUrl(file.filename, 'document'));

    res.json({
      success: true,
      data: { documentUrls },
      message: `${files.length} document(s) uploaded successfully`,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: 'Failed to upload documents',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Link parent to student
router.post('/:id/parents', authenticate, authorize('ADMIN', 'SECRETARY'), 
  validate(linkParentSchema), async (req, res) => {
  try {
    const studentParent = await StudentService.linkParent(
      req.params.id,
      req.body.parentId,
      req.body.relation
    );

    res.status(201).json({
      success: true,
      data: studentParent,
      message: 'Parent linked successfully',
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: 'Failed to link parent',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Unlink parent from student
router.delete('/:id/parents/:parentId', authenticate, authorize('ADMIN', 'SECRETARY'),
  validate(unlinkParentSchema), async (req, res) => {
  try {
    await StudentService.unlinkParent(req.params.id, req.params.parentId);

    res.json({
      success: true,
      message: 'Parent unlinked successfully',
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: 'Failed to unlink parent',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get student statistics
router.get('/stats/overview', authenticate, async (req, res) => {
  try {
    const stats = await StudentService.getStudentStats();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch student statistics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
