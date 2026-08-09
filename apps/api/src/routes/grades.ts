import { Router } from 'express';
import { z } from 'zod';
import { UserRole } from '@school/types';
import { GradeService } from '../services/grade.service';
import { PDFService } from '../services/pdf.service';
import {
  getRelease,
  publishRelease,
  unpublishRelease,
} from '../services/bulletin-release.service';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import fs from 'fs';
import path from 'path';

const router = Router();

// Validation schemas
const createGradeSchema = z.object({
  body: z.object({
    academicYearId: z.string().min(1, 'L\'année académique est obligatoire'),
    teacherId: z.string().min(1, 'L\'enseignant est obligatoire'),
    subjectId: z.string().min(1, 'La matière est obligatoire'),
    semesterId: z.string().min(1, 'Le trimestre est obligatoire'),
    studentId: z.string().min(1, 'L\'élève est obligatoire'),
    classId: z.string().min(1, 'La classe est obligatoire'),
    evaluationTypeId: z.string().min(1, 'Le type d\'évaluation est obligatoire'),
    note: z.number().min(0).max(20),
    maxNote: z.number().refine((val) => val === 10 || val === 20, {
      message: 'La note maximale doit être 10 ou 20',
    }),
  }).refine((data) => data.note <= data.maxNote, {
    message: 'La note ne peut pas dépasser la note maximale',
    path: ['note'],
  }),
});

const updateGradeSchema = z.object({
  body: z.object({
    evaluationTypeId: z.string().min(1).optional(),
    note: z.number().min(0).max(20).optional(),
    maxNote: z.number().refine((val) => val === 10 || val === 20, {
      message: 'La note maximale doit être 10 ou 20',
    }).optional(),
    semesterId: z.string().min(1).optional(),
  }),
});

// Get all grades
router.get(
  '/',
  authenticate,
  async (req, res, next) => {
    try {
      const {
        academicYearId,
        teacherId,
        subjectId,
        semesterId,
        studentId,
        classId,
      } = req.query;

      const grades = await GradeService.getAll({
        academicYearId: academicYearId as string,
        teacherId: teacherId as string,
        subjectId: subjectId as string,
        semesterId: semesterId as string,
        studentId: studentId as string,
        classId: classId as string,
      });

      res.json({
        success: true,
        data: grades,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get teacher's assignments
router.get(
  '/teacher/:teacherId/assignments',
  authenticate,
  async (req, res, next) => {
    try {
      const { teacherId } = req.params;
      const { academicYearId } = req.query;

      if (!academicYearId) {
        return res.status(400).json({
          success: false,
          error: 'L\'année académique est obligatoire',
        });
      }

      const assignments = await GradeService.getTeacherAssignments(
        teacherId,
        academicYearId as string
      );

      res.json({
        success: true,
        data: assignments,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get grade by ID
router.get(
  '/:id',
  authenticate,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const grade = await GradeService.getById(id);

      if (!grade) {
        return res.status(404).json({
          success: false,
          error: 'Note non trouvée',
        });
      }

      res.json({
        success: true,
        data: grade,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Create a new grade
router.post(
  '/',
  authenticate,
  requireRole('ADMIN', 'TEACHER'),
  validate(createGradeSchema),
  async (req, res, next) => {
    try {
      const grade = await GradeService.create(req.body);

      res.status(201).json({
        success: true,
        data: grade,
        message: 'Note créée avec succès',
      });
    } catch (error: any) {
      if (error.message.includes('non trouvé') || error.message.includes('n\'est pas affecté') || error.message.includes('doit être')) {
        return res.status(400).json({
          success: false,
          error: error.message,
        });
      }
      next(error);
    }
  }
);

// Update a grade
router.patch(
  '/:id',
  authenticate,
  requireRole('ADMIN', 'TEACHER'),
  validate(updateGradeSchema),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const grade = await GradeService.update(id, req.body);

      res.json({
        success: true,
        data: grade,
        message: 'Note modifiée avec succès',
      });
    } catch (error: any) {
      if (error.message.includes('non trouvé') || error.message.includes('doit être') || error.message.includes('dépasse')) {
        return res.status(400).json({
          success: false,
          error: error.message,
        });
      }
      next(error);
    }
  }
);

// Delete a grade
router.delete(
  '/:id',
  authenticate,
  requireRole('ADMIN', 'TEACHER'),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      await GradeService.delete(id);

      res.json({
        success: true,
        message: 'Note supprimée avec succès',
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

// Generate complete averages PDF
router.get(
  '/complete-averages/pdf',
  authenticate,
  async (req, res, next) => {
    try {
      const { classId, semesterId, academicYearId } = req.query;

      if (!classId || !semesterId || !academicYearId) {
        return res.status(400).json({
          success: false,
          error: 'Les paramètres classId, semesterId et academicYearId sont obligatoires',
        });
      }

      // Generate PDF
      const pdfPath = await PDFService.generateCompleteAveragesPDF(
        classId as string,
        semesterId as string,
        academicYearId as string
      );
      const filePath = path.join(process.cwd(), pdfPath);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({
          success: false,
          error: 'PDF file not found',
        });
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="moyennes-completes-${classId}-${semesterId}.pdf"`);
      fs.createReadStream(filePath).pipe(res);
    } catch (error: any) {
      console.error('Error generating complete averages PDF:', error);
      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          error: error.message,
        });
      }
      next(error);
    }
  }
);

// Generate class grades PDF by subject
router.get(
  '/class-grades-by-subject/pdf',
  authenticate,
  async (req, res, next) => {
    try {
      const { classId, semesterId, academicYearId, subjectId } = req.query;

      if (!classId || !semesterId || !academicYearId || !subjectId) {
        return res.status(400).json({
          success: false,
          error: 'Les paramètres classId, semesterId, academicYearId et subjectId sont obligatoires',
        });
      }

      // Generate PDF
      const pdfPath = await PDFService.generateClassGradesBySubjectPDF(
        classId as string,
        semesterId as string,
        academicYearId as string,
        subjectId as string
      );
      const filePath = path.join(process.cwd(), pdfPath);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({
          success: false,
          error: 'PDF file not found',
        });
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="notes-${classId}-${subjectId}-${semesterId}.pdf"`);
      fs.createReadStream(filePath).pipe(res);
    } catch (error: any) {
      console.error('Error generating class grades by subject PDF:', error);
      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          error: error.message,
        });
      }
      next(error);
    }
  }
);

// Generate student bulletin PDF
router.get(
  '/student-bulletin/pdf',
  authenticate,
  async (req, res, next) => {
    try {
      const { studentId, classId, semesterId, academicYearId } = req.query;

      if (!studentId || !classId || !semesterId || !academicYearId) {
        return res.status(400).json({
          success: false,
          error: 'Les paramètres studentId, classId, semesterId et academicYearId sont obligatoires',
        });
      }

      // Si les bulletins de la classe ont été générés, le document porte la date
      // de cette génération. Sinon (prévisualisation avant publication, réservée
      // au personnel), il porte la date du jour.
      const release = await getRelease(
        classId as string,
        semesterId as string,
        academicYearId as string
      );

      const pdfPath = await PDFService.generateStudentBulletinPDF(
        studentId as string,
        classId as string,
        semesterId as string,
        academicYearId as string,
        release?.generatedAt
      );
      const filePath = path.join(process.cwd(), pdfPath);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({
          success: false,
          error: 'PDF file not found',
        });
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="bulletin-${studentId}-${semesterId}.pdf"`);
      fs.createReadStream(filePath).pipe(res);
    } catch (error: any) {
      console.error('Error generating student bulletin PDF:', error);
      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          error: error.message,
        });
      }
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// Génération des bulletins d'une classe (§9.5)
//
// Générer, c'est publier : l'acte est enregistré (classe, trimestre, date), et
// c'est lui qui ouvre le bulletin aux espaces Parent et Élève — jusque-là ils
// n'y ont pas accès, même si toutes les notes sont saisies.
// ---------------------------------------------------------------------------

const bulletinScopeSchema = z.object({
  body: z.object({
    classId: z.string().min(1, 'La classe est obligatoire'),
    semesterId: z.string().min(1, 'Le trimestre est obligatoire'),
    academicYearId: z.string().min(1, 'L\'année académique est obligatoire'),
  }),
});

// Statut de publication d'une classe pour un trimestre
router.get('/bulletins/release', authenticate, async (req, res, next) => {
  try {
    const { classId, semesterId, academicYearId } = req.query;

    if (!classId || !semesterId || !academicYearId) {
      return res.status(400).json({
        success: false,
        error: 'Les paramètres classId, semesterId et academicYearId sont obligatoires',
      });
    }

    const release = await getRelease(
      classId as string,
      semesterId as string,
      academicYearId as string
    );

    res.json({
      success: true,
      data: {
        published: !!release,
        generatedAt: release?.generatedAt ?? null,
        generatedBy: release?.generatedBy ?? null,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Générer (ou regénérer) les bulletins de la classe pour le trimestre
router.post(
  '/bulletins/generate',
  authenticate,
  requireRole(UserRole.ADMIN),
  validate(bulletinScopeSchema),
  async (req: AuthRequest, res, next) => {
    try {
      const { classId, semesterId, academicYearId } = req.body;

      // Publier une classe sans aucune note produirait des bulletins vides et
      // visibles par les familles : on refuse plutôt que de laisser faire.
      const grades = await GradeService.getAll({
        classId,
        semesterId,
        academicYearId,
      });

      if (!grades.length) {
        return res.status(400).json({
          success: false,
          error: 'Aucune note saisie pour cette classe sur ce trimestre : il n\'y a rien à générer.',
        });
      }

      const release = await publishRelease({
        classId,
        semesterId,
        academicYearId,
        userId: req.user?.id,
      });

      res.json({
        success: true,
        message: 'Bulletins générés et publiés.',
        data: {
          published: true,
          generatedAt: release.generatedAt,
          generatedBy: release.generatedBy,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Annuler la publication : les bulletins redeviennent invisibles côté familles
router.delete(
  '/bulletins/release',
  authenticate,
  requireRole(UserRole.ADMIN),
  async (req, res, next) => {
    try {
      const { classId, semesterId, academicYearId } = req.query;

      if (!classId || !semesterId || !academicYearId) {
        return res.status(400).json({
          success: false,
          error: 'Les paramètres classId, semesterId et academicYearId sont obligatoires',
        });
      }

      const removed = await unpublishRelease(
        classId as string,
        semesterId as string,
        academicYearId as string
      );

      res.json({
        success: true,
        message: removed
          ? 'Publication annulée : les bulletins ne sont plus visibles par les familles.'
          : 'Ces bulletins n\'étaient pas publiés.',
        data: { published: false },
      });
    } catch (error) {
      next(error);
    }
  }
);

// PDF unique regroupant les bulletins de tous les élèves de la classe
router.get(
  '/class-bulletins/pdf',
  authenticate,
  requireRole(UserRole.ADMIN),
  async (req, res, next) => {
    try {
      const { classId, semesterId, academicYearId } = req.query;

      if (!classId || !semesterId || !academicYearId) {
        return res.status(400).json({
          success: false,
          error: 'Les paramètres classId, semesterId et academicYearId sont obligatoires',
        });
      }

      const release = await getRelease(
        classId as string,
        semesterId as string,
        academicYearId as string
      );

      if (!release) {
        return res.status(409).json({
          success: false,
          error: 'Les bulletins de cette classe ne sont pas encore générés.',
        });
      }

      const { path: pdfPath } = await PDFService.generateClassBulletinsPDF(
        classId as string,
        semesterId as string,
        academicYearId as string,
        release.generatedAt
      );
      const filePath = path.join(process.cwd(), pdfPath);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({
          success: false,
          error: 'PDF file not found',
        });
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `inline; filename="bulletins-${classId}-${semesterId}.pdf"`
      );
      fs.createReadStream(filePath).pipe(res);
    } catch (error: any) {
      console.error('Error generating class bulletins PDF:', error);
      if (error.message?.includes('Aucun élève')) {
        return res.status(400).json({ success: false, error: error.message });
      }
      next(error);
    }
  }
);

export default router;
