import { Router } from 'express';
import { TeacherService, createTeacherSchema, updateTeacherSchema } from '../services/teacher.service';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { documentUpload, handleUploadError, getFileUrl } from '../middleware/upload';
import { prisma } from '@school/database';
import { UserRole } from '@school/types';

const router = Router();

// Get all teachers with filters
router.get(
  '/',
  authenticate,
  requireRole(UserRole.ADMIN, UserRole.ACCOUNTANT),
  async (req, res, next) => {
    try {
      const {
        contractType,
        page,
        limit,
        search,
      } = req.query;

      const result = await TeacherService.getAll({
        contractType: contractType as string,
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        search: search as string,
      });

      res.json({
        success: true,
        data: result.teachers,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get current teacher's info (MUST BE BEFORE /:id route)
router.get(
  '/me/info',
  authenticate,
  requireRole(UserRole.TEACHER),
  async (req, res, next) => {
    try {
      const user = (req as any).user;
      
      // Find teacher by user_id
      const teacher = await prisma.teachers.findUnique({
        where: { user_id: user.id },
        select: {
          id: true,
          first_name: true,
          last_name: true,
          email: true,
          phone: true,
          contract_type: true,
          hire_date: true,
          specialties: true,
          qualifications: true,
        },
      });

      if (!teacher) {
        return res.status(404).json({
          success: false,
          error: 'Enseignant non trouvé pour cet utilisateur',
        });
      }

      res.json({
        success: true,
        data: {
          id: teacher.id,
          firstName: teacher.first_name,
          lastName: teacher.last_name,
          email: teacher.email,
          phone: teacher.phone,
          contractType: teacher.contract_type,
          hireDate: teacher.hire_date,
          specialties: teacher.specialties,
          qualifications: teacher.qualifications,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get current teacher's class assignments (MUST BE BEFORE /:id route)
router.get(
  '/me/assignments',
  authenticate,
  requireRole(UserRole.TEACHER),
  async (req, res, next) => {
    try {
      const user = (req as any).user;
      const { academicYearId } = req.query;
      
      // Find teacher by user_id
      const teacher = await prisma.teachers.findUnique({
        where: { user_id: user.id },
        select: { id: true },
      });

      if (!teacher) {
        return res.status(404).json({
          success: false,
          error: 'Enseignant non trouvé pour cet utilisateur',
        });
      }

      const assignments = await TeacherService.getTeacherClassAssignments(
        teacher.id,
        academicYearId as string
      );

      res.json({
        success: true,
        data: assignments,
      });
    } catch (error: any) {
      if (error.message.includes('non trouvé')) {
        return res.status(404).json({
          success: false,
          error: error.message,
        });
      }
      next(error);
    }
  }
);

// Get current teacher's timetable (MUST BE BEFORE /:id route)
router.get(
  '/me/timetable',
  authenticate,
  requireRole(UserRole.TEACHER),
  async (req, res, next) => {
    try {
      const user = (req as any).user;
      const { academicYearId } = req.query;
      
      // Find teacher by user_id
      const teacher = await prisma.teachers.findUnique({
        where: { user_id: user.id },
        select: { id: true },
      });

      if (!teacher) {
        return res.status(404).json({
          success: false,
          error: 'Enseignant non trouvé pour cet utilisateur',
        });
      }

      const timetable = await TeacherService.getTeacherTimetable(
        teacher.id,
        academicYearId as string
      );

      res.json({
        success: true,
        data: timetable,
      });
    } catch (error: any) {
      if (error.message.includes('non trouvé')) {
        return res.status(404).json({
          success: false,
          error: error.message,
        });
      }
      next(error);
    }
  }
);

// Get teacher by ID
router.get(
  '/:id',
  authenticate,
  requireRole(UserRole.ADMIN, UserRole.ACCOUNTANT),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const teacher = await TeacherService.getById(id);

      if (!teacher) {
        return res.status(404).json({
          success: false,
          error: 'Enseignant non trouvé',
        });
      }

      res.json({
        success: true,
        data: teacher,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Create a new teacher (multipart/form-data: fields + optional 'attachments' files)
router.post(
  '/',
  authenticate,
  requireRole(UserRole.ADMIN, UserRole.ACCOUNTANT),
  documentUpload.array('attachments'), handleUploadError,
  async (req, res, next) => {
    try {
      let subjectIds: string[] | undefined;
      if (req.body.subjectIds) {
        try { subjectIds = JSON.parse(req.body.subjectIds); } catch { subjectIds = undefined; }
      }
      const parsed = createTeacherSchema.parse({ ...req.body, subjectIds });
      const files = (req.files as Express.Multer.File[]) || [];
      const attachments = files.map((file) => getFileUrl(file.filename, 'document'));

      const teacher = await TeacherService.create({ ...parsed, attachments });

      res.status(201).json({
        success: true,
        data: teacher,
        message: 'Enseignant créé avec succès',
      });
    } catch (error: any) {
      if (error?.name === 'ZodError') {
        return res.status(400).json({
          success: false,
          error: 'Données invalides',
          details: error.errors,
        });
      }
      if (error.code === 'P2002') {
        return res.status(400).json({
          success: false,
          error: 'Un enseignant avec cet email existe déjà',
        });
      }
      if (error.message.includes('existe déjà')) {
        return res.status(400).json({
          success: false,
          error: error.message,
        });
      }
      next(error);
    }
  }
);

// Update a teacher (multipart/form-data: fields + optional new 'attachments' files)
router.patch(
  '/:id',
  authenticate,
  requireRole(UserRole.ADMIN, UserRole.ACCOUNTANT),
  documentUpload.array('attachments'), handleUploadError,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      let subjectIds: string[] | undefined;
      if (req.body.subjectIds) {
        try { subjectIds = JSON.parse(req.body.subjectIds); } catch { subjectIds = undefined; }
      }
      const parsed = updateTeacherSchema.parse({ ...req.body, subjectIds });

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
        const existing = await TeacherService.getById(id);
        const remaining = ((existing as any)?.attachments || []).filter(
          (a: string) => !attachmentsToRemove.includes(a)
        );
        updatePayload.attachments = [...remaining, ...newAttachments];
      }

      const teacher = await TeacherService.update(id, updatePayload);

      res.json({
        success: true,
        data: teacher,
        message: 'Enseignant modifié avec succès',
      });
    } catch (error: any) {
      if (error?.name === 'ZodError') {
        return res.status(400).json({
          success: false,
          error: 'Données invalides',
          details: error.errors,
        });
      }
      if (error.message.includes('non trouvé') || error.message.includes('existe déjà')) {
        return res.status(400).json({
          success: false,
          error: error.message,
        });
      }
      next(error);
    }
  }
);

// Delete a teacher
router.delete(
  '/:id',
  authenticate,
  requireRole(UserRole.ADMIN, UserRole.ACCOUNTANT),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      await TeacherService.delete(id);

      res.json({
        success: true,
        message: 'Enseignant supprimé avec succès',
      });
    } catch (error: any) {
      if (error.message.includes('non trouvé')) {
        return res.status(404).json({
          success: false,
          error: error.message,
        });
      }
      next(error);
    }
  }
);

// Create user account for a teacher (ADMIN only)
// Le mot de passe est généré automatiquement si aucun n'est fourni dans le body.
router.post(
  '/:id/create-account',
  authenticate,
  requireRole(UserRole.ADMIN),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { password } = req.body || {};

      const result = await TeacherService.createUserAccount(id, password);

      res.status(201).json({
        success: true,
        data: result,
        message: result.emailSent
          ? 'Compte utilisateur créé avec succès. Identifiants envoyés par email.'
          : 'Compte utilisateur créé avec succès',
      });
    } catch (error: any) {
      if (error.message.includes('non trouvé') ||
          error.message.includes('déjà') ||
          error.message.includes('existe déjà')) {
        return res.status(400).json({
          success: false,
          error: error.message,
        });
      }
      next(error);
    }
  }
);

// Reset (regenerate) a teacher's account password (ADMIN only)
router.post(
  '/:id/reset-password',
  authenticate,
  requireRole(UserRole.ADMIN),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { password } = req.body || {};

      const result = await TeacherService.resetUserPassword(id, password);

      res.json({
        success: true,
        data: result,
        message: result.emailSent
          ? 'Mot de passe réinitialisé avec succès. Nouveaux identifiants envoyés par email.'
          : 'Mot de passe réinitialisé avec succès',
      });
    } catch (error: any) {
      if (error.message.includes('non trouvé') || error.message.includes('pas encore')) {
        return res.status(400).json({
          success: false,
          error: error.message,
        });
      }
      next(error);
    }
  }
);

// Get teacher's class assignments (ADMIN or the teacher themselves)
router.get(
  '/:id/assignments',
  authenticate,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { academicYearId } = req.query;
      
      // Check if user is accessing their own data or is ADMIN
      const user = (req as any).user;
      if (user.role !== 'ADMIN') {
        // Teacher accessing their own data - find teacher by user_id
        const teacher = await TeacherService.getById(id);
        if (!teacher || (teacher as any).user_id !== user.id) {
          return res.status(403).json({
            success: false,
            error: 'Accès non autorisé',
          });
        }
      }

      const assignments = await TeacherService.getTeacherClassAssignments(
        id,
        academicYearId as string
      );

      res.json({
        success: true,
        data: assignments,
      });
    } catch (error: any) {
      if (error.message.includes('non trouvé')) {
        return res.status(404).json({
          success: false,
          error: error.message,
        });
      }
      next(error);
    }
  }
);

// Get teacher's timetable (ADMIN or the teacher themselves)
router.get(
  '/:id/timetable',
  authenticate,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { academicYearId } = req.query;
      
      // Check if user is accessing their own data or is ADMIN
      const user = (req as any).user;
      if (user.role !== 'ADMIN') {
        // Teacher accessing their own data - find teacher by user_id
        const teacher = await TeacherService.getById(id);
        if (!teacher || (teacher as any).user_id !== user.id) {
          return res.status(403).json({
            success: false,
            error: 'Accès non autorisé',
          });
        }
      }

      const timetable = await TeacherService.getTeacherTimetable(
        id,
        academicYearId as string
      );

      res.json({
        success: true,
        data: timetable,
      });
    } catch (error: any) {
      if (error.message.includes('non trouvé')) {
        return res.status(404).json({
          success: false,
          error: error.message,
        });
      }
      next(error);
    }
  }
);

export default router;

