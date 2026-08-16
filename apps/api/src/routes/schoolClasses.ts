import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '@school/database';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { randomUUID } from 'crypto';
import { syncClassToOdoo } from '../services/odoo.service';
import {
  generateCurriculumSafe,
  generateCurriculumForClass,
  generateCurriculumForAllClasses,
} from '../services/curriculum.service';

/**
 * Synchronise (best-effort) une classe vers Odoo (Facturation > Classes &
 * Produits). N'importe quelle erreur (Odoo éteint, non configuré...) est
 * avalée : ça ne doit jamais faire échouer la création/mise à jour de la classe.
 */
async function syncClassToOdooSafe(id: string, name: string) {
  try {
    await syncClassToOdoo({ id, name });
  } catch (err) {
    console.warn(`Synchronisation Odoo de la classe ${id} échouée :`, (err as Error).message);
  }
}

const router = Router();

// ============================================================================
// Validation Schemas
// ============================================================================

const createClassSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Le nom doit contenir au moins 2 caractères'),
  }),
});

const updateClassSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Le nom doit contenir au moins 2 caractères').optional(),
  }),
});

// ============================================================================
// Routes
// ============================================================================

/**
 * GET /api/school-classes
 * Get all classes with optional filters
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const classes = await prisma.schoolClass.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: {
            students: true,
            classSubjects: true,
          },
        },
      },
    });

    res.json({
      success: true,
      data: classes,
    });
  } catch (error) {
    console.error('Error fetching classes:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch classes',
    });
  }
});

/**
 * GET /api/school-classes/:id
 * Get class by ID with full details
 */
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const schoolClass = await prisma.schoolClass.findUnique({
      where: { id },
      include: {
        classSubjects: {
          include: {
            subjects: true,
          },
        },
        students: {
          select: {
            id: true,
            studentNumber: true,
            firstName: true,
            lastName: true,
            status: true,
          },
          orderBy: { lastName: 'asc' },
        },
        _count: {
          select: {
            students: true,
            classSubjects: true,
            schedules: true,
            attendances: true,
            inscriptions: true,
            schoolFeeRates: true,
          },
        },
      },
    });

    if (!schoolClass) {
      return res.status(404).json({
        success: false,
        error: 'Classe non trouvée',
      });
    }

    res.json({
      success: true,
      data: schoolClass,
    });
  } catch (error) {
    console.error('Error fetching class:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch class',
    });
  }
});

/**
 * POST /api/school-classes
 * Create new class (ADMIN only)
 */
router.post(
  '/',
  authenticate,
  requireRole('ADMIN'),
  validate(createClassSchema),
  async (req, res) => {
    try {
      const { name } = req.body;

      // Check if class with same name exists
      const existing = await prisma.schoolClass.findUnique({
        where: { name },
      });

      if (existing) {
        return res.status(409).json({
          success: false,
          error: 'Une classe avec ce nom existe déjà',
        });
      }

      const schoolClass = await prisma.schoolClass.create({
        data: {
          id: randomUUID(),
          name,
        },
      });

      void syncClassToOdooSafe(schoolClass.id, schoolClass.name);

      // Génère le programme du niveau (matières + rattachements) dans la foulée.
      // Attendu — et non « fire-and-forget » comme la synchro Odoo — pour que
      // l'appelant qui recharge les matières juste après voie déjà le résultat.
      await generateCurriculumSafe(schoolClass.id, schoolClass.name);

      res.status(201).json({
        success: true,
        data: schoolClass,
        message: 'Classe créée avec succès',
      });
    } catch (error: any) {
      console.error('Error creating class:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        meta: error.meta,
        stack: error.stack,
      });
      res.status(500).json({
        success: false,
        error: 'Failed to create class',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }
);

/**
 * PATCH /api/school-classes/:id
 * Update class (ADMIN only)
 */
router.patch(
  '/:id',
  authenticate,
  requireRole('ADMIN'),
  validate(updateClassSchema),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { name } = req.body;

      const schoolClass = await prisma.schoolClass.update({
        where: { id },
        data: { name },
      });

      void syncClassToOdooSafe(schoolClass.id, schoolClass.name);

      res.json({
        success: true,
        data: schoolClass,
        message: 'Classe mise à jour avec succès',
      });
    } catch (error) {
      console.error('Error updating class:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update class',
      });
    }
  }
);

/**
 * DELETE /api/school-classes/:id
 * Delete class (ADMIN only)
 */
router.delete(
  '/:id',
  authenticate,
  requireRole('ADMIN'),
  async (req, res) => {
    try {
      const { id } = req.params;

      // Check dependencies
      const schoolClass = await prisma.schoolClass.findUnique({
        where: { id },
        include: {
          _count: {
            select: {
              students: true,
              classSubjects: true,
              schedules: true,
              attendances: true,
              inscriptions: true,
              schoolFeeRates: true,
            },
          },
        },
      });

      if (!schoolClass) {
        return res.status(404).json({
          success: false,
          error: 'Classe non trouvée',
        });
      }

      const totalDeps = 
        schoolClass._count.students +
        schoolClass._count.classSubjects +
        schoolClass._count.schedules +
        schoolClass._count.attendances +
        schoolClass._count.inscriptions +
        schoolClass._count.schoolFeeRates;

      if (totalDeps > 0) {
        const depsDetails = [];
        if (schoolClass._count.students > 0) depsDetails.push(`${schoolClass._count.students} élève(s)`);
        if (schoolClass._count.classSubjects > 0) depsDetails.push(`${schoolClass._count.classSubjects} matière(s) affectée(s)`);
        if (schoolClass._count.schedules > 0) depsDetails.push(`${schoolClass._count.schedules} emploi(s) du temps`);
        if (schoolClass._count.attendances > 0) depsDetails.push(`${schoolClass._count.attendances} présence(s)`);
        if (schoolClass._count.inscriptions > 0) depsDetails.push(`${schoolClass._count.inscriptions} inscription(s)`);
        if (schoolClass._count.schoolFeeRates > 0) depsDetails.push(`${schoolClass._count.schoolFeeRates} tarif(s)`);

        return res.status(400).json({
          success: false,
          error: `Impossible de supprimer la classe : ${depsDetails.join(', ')}`,
        });
      }

      await prisma.schoolClass.delete({
        where: { id },
      });

      res.json({
        success: true,
        message: 'Classe supprimée avec succès',
      });
    } catch (error: any) {
      console.error('Error deleting class:', error);
      
      // Handle Prisma foreign key constraint errors
      if (error.code === 'P2003') {
        return res.status(400).json({
          success: false,
          error: 'Impossible de supprimer la classe : elle est utilisée dans d\'autres enregistrements',
        });
      }
      
      // Handle record not found
      if (error.code === 'P2025') {
        return res.status(404).json({
          success: false,
          error: 'Classe non trouvée',
        });
      }

      res.status(500).json({
        success: false,
        error: 'Failed to delete class',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }
);

/**
 * POST /api/school-classes/curriculum/generate
 * Rattrapage : applique le programme MENA à toutes les classes existantes.
 * Idempotent — relançable sans créer de doublon ni écraser un coefficient
 * ajusté manuellement.
 */
router.post(
  '/curriculum/generate',
  authenticate,
  requireRole('ADMIN'),
  async (_req, res) => {
    try {
      const results = await generateCurriculumForAllClasses();
      const traitees = results.filter((r) => !r.skipped);
      res.json({
        success: true,
        data: {
          classesTraitees: traitees.length,
          classesIgnorees: results.filter((r) => r.skipped).map((r) => r.className),
          matieresCreees: results.reduce((n, r) => n + r.subjectsCreated, 0),
          rattachementsCrees: results.reduce((n, r) => n + r.linksCreated, 0),
          details: results,
        },
        message: `Programme généré pour ${traitees.length} classe(s).`,
      });
    } catch (error: any) {
      console.error('Error generating curriculum:', error);
      res.status(500).json({ success: false, error: 'Failed to generate curriculum' });
    }
  }
);

/**
 * POST /api/school-classes/:id/curriculum
 * Applique (ou complète) le programme pour une seule classe.
 */
router.post(
  '/:id/curriculum',
  authenticate,
  requireRole('ADMIN'),
  async (req, res) => {
    try {
      const schoolClass = await prisma.schoolClass.findUnique({ where: { id: req.params.id } });
      if (!schoolClass) {
        return res.status(404).json({ success: false, error: 'Classe introuvable' });
      }
      const result = await generateCurriculumForClass(schoolClass.id, schoolClass.name);
      res.json({
        success: true,
        data: result,
        message: result.skipped
          ? `Programme non généré : ${result.skipped}.`
          : `${result.subjectsCreated} matière(s) créée(s), ${result.linksCreated} rattachement(s).`,
      });
    } catch (error: any) {
      console.error('Error generating curriculum for class:', error);
      res.status(500).json({ success: false, error: 'Failed to generate curriculum' });
    }
  }
);

export default router;
