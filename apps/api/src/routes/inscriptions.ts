import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { InscriptionService } from '../services/inscription.service';

const router = Router();

// ============================================================================
// Validation Schemas
// ============================================================================

const createInscriptionSchema = z.object({
  academicYearId: z.string().uuid('ID année scolaire invalide'),
  classId: z.string().uuid('ID classe invalide'),
  studentId: z.string().uuid('ID élève invalide'),
});

const updateInscriptionSchema = z.object({
  academicYearId: z.string().uuid().optional(),
  classId: z.string().uuid().optional(),
  studentId: z.string().uuid().optional(),
});

// ============================================================================
// Routes
// ============================================================================

/**
 * GET /api/inscriptions
 * Get all inscriptions
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const { academicYearId, classId } = req.query;

    const inscriptions = await InscriptionService.getAll({
      academicYearId: academicYearId as string,
      classId: classId as string,
    });

    res.json({
      success: true,
      data: inscriptions,
    });
  } catch (error) {
    console.error('Error fetching inscriptions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch inscriptions',
    });
  }
});

/**
 * GET /api/inscriptions/statistics
 * Get inscriptions statistics
 */
router.get('/statistics', authenticate, async (req, res) => {
  try {
    const { academicYearId } = req.query;

    const statistics = await InscriptionService.getStatistics(academicYearId as string);

    res.json({
      success: true,
      data: statistics,
    });
  } catch (error) {
    console.error('Error fetching statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics',
    });
  }
});

/**
 * GET /api/inscriptions/:id
 * Get inscription by ID
 */
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const inscription = await InscriptionService.getById(id);

    if (!inscription) {
      return res.status(404).json({
        success: false,
        error: 'Inscription not found',
      });
    }

    res.json({
      success: true,
      data: inscription,
    });
  } catch (error) {
    console.error('Error fetching inscription:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch inscription',
    });
  }
});

/**
 * POST /api/inscriptions
 * Create new inscription (link an existing student to a class/year)
 */
router.post('/', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const validatedData = createInscriptionSchema.parse(req.body);

    const inscription = await InscriptionService.create({
      academicYearId: validatedData.academicYearId!,
      classId: validatedData.classId!,
      studentId: validatedData.studentId!,
    });

    res.status(201).json({
      success: true,
      data: inscription,
      message: 'Inscription créée avec succès',
    });
  } catch (error: any) {
    console.error('Error creating inscription:', error);

    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        error: 'Données invalides',
        details: error.errors,
      });
    }

    res.status(400).json({
      success: false,
      error: error.message || 'Failed to create inscription',
    });
  }
});

/**
 * PATCH /api/inscriptions/:id
 * Update inscription
 */
router.patch('/:id', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;

    const validatedData = updateInscriptionSchema.parse(req.body);

    const inscription = await InscriptionService.update(id, validatedData);

    res.json({
      success: true,
      data: inscription,
      message: 'Inscription mise à jour',
    });
  } catch (error: any) {
    console.error('Error updating inscription:', error);

    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        error: 'Données invalides',
        details: error.errors,
      });
    }

    res.status(400).json({
      success: false,
      error: error.message || 'Failed to update inscription',
    });
  }
});

/**
 * DELETE /api/inscriptions/:id
 * Delete inscription
 */
router.delete('/:id', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;

    await InscriptionService.delete(id);

    res.json({
      success: true,
      message: 'Inscription supprimée',
    });
  } catch (error: any) {
    console.error('Error deleting inscription:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to delete inscription',
    });
  }
});

export default router;
