import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '@school/database';
import { UserRole } from '@school/types';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { AcademicYearService } from '../services/academicYear.service';

const router = Router();

// ============================================================================
// Validation Schemas (Zod)
// ============================================================================

// Le nom ("2025-2026") n'est plus saisi à la main : il est dérivé de l'année de
// début et de l'année de fin fournies par le formulaire (cf. §POST ci-dessous).
const createAcademicYearSchema = z.object({
  body: z.object({
    startYear: z.number().int().min(2020).max(2100),
    endYear: z.number().int().min(2020).max(2100),
    isCurrent: z.boolean().optional(),
  }).refine((data) => data.endYear === data.startYear + 1, {
    message: 'L\'année de fin doit être l\'année suivante',
    path: ['endYear'],
  }),
});

const updateAcademicYearSchema = z.object({
  body: z.object({
    startYear: z.number().int().min(2020).max(2100).optional(),
    endYear: z.number().int().min(2020).max(2100).optional(),
    isCurrent: z.boolean().optional(),
  }),
});

// ============================================================================
// Routes
// ============================================================================

/**
 * GET /api/academic-years
 * Get all academic years (with optional filters)
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const years = await AcademicYearService.getAll();

    console.log('Academic years fetched:', years.length);
    console.log('Sample year:', years[0]);

    res.json({
      success: true,
      data: years,
    });
  } catch (error: any) {
    console.error('Error fetching academic years:', {
      message: error?.message,
      stack: error?.stack,
      name: error?.name,
    });
    res.status(500).json({
      success: false,
      error: error?.message || 'Failed to fetch academic years',
      ...(process.env.NODE_ENV === 'development' && {
        details: error?.stack,
      }),
    });
  }
});

/**
 * GET /api/academic-years/current
 * Get current academic year
 */
router.get('/current', authenticate, async (req, res) => {
  try {
    const year = await AcademicYearService.getCurrent();

    if (!year) {
      return res.status(404).json({
        success: false,
        error: 'No current academic year found',
      });
    }

    res.json({
      success: true,
      data: year,
    });
  } catch (error) {
    console.error('Error fetching current academic year:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch current academic year',
    });
  }
});

/**
 * GET /api/academic-years/:id
 * Get academic year by ID
 */
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const year = await AcademicYearService.getById(id);

    if (!year) {
      return res.status(404).json({
        success: false,
        error: 'Academic year not found',
      });
    }

    res.json({
      success: true,
      data: year,
    });
  } catch (error) {
    console.error('Error fetching academic year:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch academic year',
    });
  }
});

/**
 * POST /api/academic-years
 * Create new academic year (ADMIN only)
 */
router.post(
  '/',
  authenticate,
  requireRole(UserRole.ADMIN),
  validate(createAcademicYearSchema),
  async (req, res) => {
    try {
      const { startYear, endYear, isCurrent } = req.body;

      // Le tiret de « 2025-2026 » est généré ici, à partir des deux années
      // saisies — l'utilisateur ne le tape jamais lui-même.
      const name = `${startYear}-${endYear}`;

      // Check if year with same name already exists
      const existing = await prisma.academicYear.findUnique({
        where: { name },
      });

      if (existing) {
        return res.status(409).json({
          success: false,
          error: 'Une année scolaire avec ce nom existe déjà',
        });
      }

      const year = await AcademicYearService.create({
        name,
        startYear,
        endYear,
        isCurrent,
      });

      res.status(201).json({
        success: true,
        data: year,
        message: 'Année scolaire créée avec succès et définie comme année active',
      });
    } catch (error: any) {
      console.error('Error creating academic year:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to create academic year',
      });
    }
  }
);

/**
 * PATCH /api/academic-years/:id
 * Update academic year (ADMIN only)
 */
router.patch(
  '/:id',
  authenticate,
  requireRole(UserRole.ADMIN),
  validate(updateAcademicYearSchema),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { startYear, endYear, isCurrent } = req.body;
      const data: Record<string, any> = {};

      if (isCurrent !== undefined) data.isCurrent = isCurrent;

      // Si les deux années sont fournies, on régénère le nom ("2025-2026") pour
      // qu'il reste cohérent avec les nouvelles bornes.
      if (startYear !== undefined && endYear !== undefined) {
        if (endYear !== startYear + 1) {
          return res.status(400).json({
            success: false,
            error: 'L\'année de fin doit être l\'année suivante',
          });
        }
        data.startYear = startYear;
        data.endYear = endYear;
        data.name = `${startYear}-${endYear}`;
      }

      const year = await AcademicYearService.update(id, data);

      res.json({
        success: true,
        data: year,
        message: 'Année scolaire mise à jour avec succès',
      });
    } catch (error: any) {
      console.error('Error updating academic year:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to update academic year',
      });
    }
  }
);

/**
 * POST /api/academic-years/:id/set-current
 * Set academic year as current (ADMIN only)
 */
router.post(
  '/:id/set-current',
  authenticate,
  requireRole(UserRole.ADMIN),
  async (req, res) => {
    try {
      const { id } = req.params;
      const year = await AcademicYearService.setCurrent(id);

      res.json({
        success: true,
        data: year,
        message: 'Année scolaire définie comme actuelle',
      });
    } catch (error: any) {
      console.error('Error setting current academic year:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to set current academic year',
      });
    }
  }
);

/**
 * DELETE /api/academic-years/:id
 * Delete academic year (ADMIN only)
 */
router.delete(
  '/:id',
  authenticate,
  requireRole(UserRole.ADMIN),
  async (req, res) => {
    try {
      const { id } = req.params;
      await AcademicYearService.delete(id);

      res.json({
        success: true,
        message: 'Année scolaire supprimée avec succès',
      });
    } catch (error: any) {
      console.error('Error deleting academic year:', error);
      
      if (error.message.includes('dependencies')) {
        return res.status(400).json({
          success: false,
          error: error.message,
        });
      }

      res.status(500).json({
        success: false,
        error: error.message || 'Failed to delete academic year',
      });
    }
  }
);

export default router;
