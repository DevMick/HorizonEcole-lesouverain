import { Router } from 'express';
import { z } from 'zod';
import { EvaluationCoefficientService, createCoefficientSchema } from '../services/evaluationCoefficient.service';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { prisma } from '@school/database';

const router = Router();

const createRouteSchema = z.object({
  body: createCoefficientSchema,
});

/**
 * Résout l'enseignant concerné : un TEACHER n'agit que sur ses propres
 * coefficients ; un ADMIN doit passer `teacherId` explicitement.
 */
async function resolveTeacherId(req: any): Promise<string | null> {
  const user = req.user;
  if (user.role === 'TEACHER') {
    const teacher = await prisma.teachers.findUnique({
      where: { user_id: user.id },
      select: { id: true },
    });
    return teacher?.id ?? null;
  }
  return (req.query.teacherId as string) || req.body?.teacherId || null;
}

// Liste des coefficients proposés (2 défauts + personnalisés de l'enseignant)
router.get(
  '/',
  authenticate,
  requireRole('ADMIN', 'TEACHER'),
  async (req, res, next) => {
    try {
      const teacherId = await resolveTeacherId(req);
      if (!teacherId) {
        // Pas d'enseignant résolu : on renvoie au moins les défauts pour que le
        // select ne soit jamais vide.
        return res.json({
          success: true,
          data: await EvaluationCoefficientService.getOptions('__none__'),
        });
      }

      res.json({
        success: true,
        data: await EvaluationCoefficientService.getOptions(teacherId),
      });
    } catch (error) {
      next(error);
    }
  }
);

// Création d'un coefficient personnalisé
router.post(
  '/',
  authenticate,
  requireRole('ADMIN', 'TEACHER'),
  validate(createRouteSchema),
  async (req, res, next) => {
    try {
      const teacherId = await resolveTeacherId(req);
      if (!teacherId) {
        return res.status(404).json({
          success: false,
          error: 'Enseignant non trouvé pour cet utilisateur',
        });
      }

      const coefficient = await EvaluationCoefficientService.create(teacherId, {
        value: req.body.value,
        label: req.body.label,
      });

      res.status(201).json({
        success: true,
        data: coefficient,
      });
    } catch (error: any) {
      if (error.message.includes('non trouvé') || error.message.includes('déjà') || error.message.includes('doit être')) {
        return res.status(400).json({
          success: false,
          error: error.message,
        });
      }
      next(error);
    }
  }
);

// Suppression d'un coefficient personnalisé
router.delete(
  '/:id',
  authenticate,
  requireRole('ADMIN', 'TEACHER'),
  async (req, res, next) => {
    try {
      const teacherId = await resolveTeacherId(req);
      if (!teacherId) {
        return res.status(404).json({
          success: false,
          error: 'Enseignant non trouvé pour cet utilisateur',
        });
      }

      await EvaluationCoefficientService.delete(req.params.id, teacherId);

      res.json({
        success: true,
        message: 'Coefficient supprimé avec succès',
      });
    } catch (error: any) {
      if (error.message.includes('non autorisé')) {
        return res.status(403).json({ success: false, error: error.message });
      }
      if (error.message.includes('non trouvé') || error.message.includes('utilisé')) {
        return res.status(400).json({ success: false, error: error.message });
      }
      next(error);
    }
  }
);

export default router;
