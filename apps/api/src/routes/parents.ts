import { Router } from 'express';
import { z } from 'zod';

import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { ParentService } from '../services/parent.service';
import { avatarUpload, handleUploadError, getFileUrl } from '../middleware/upload';

const router = Router();

// Validation schemas
const createParentSchema = z.object({
  body: z.object({
    firstName: z.string().min(2, 'First name must be at least 2 characters'),
    lastName: z.string().min(2, 'Last name must be at least 2 characters'),
    relation: z.enum(['PERE', 'MERE', 'TUTEUR', 'AUTRE']),
    phone: z.string().min(8, 'Phone number must be at least 8 characters'),
    email: z.string().email().optional().or(z.literal('')),
    address: z.string().optional(),
    profession: z.string().optional(),
    workplace: z.string().optional(),
    isPrimaryContact: z.boolean().optional(),
    isFinancialResponsible: z.boolean().optional(),
  }),
});

const updateParentSchema = z.object({
  params: z.object({
    id: z.string(),
  }),
  body: z.object({
    firstName: z.string().min(2).optional(),
    lastName: z.string().min(2).optional(),
    relation: z.enum(['PERE', 'MERE', 'TUTEUR', 'AUTRE']).optional(),
    phone: z.string().min(8).optional(),
    email: z.string().email().optional().or(z.literal('')),
    address: z.string().optional(),
    profession: z.string().optional(),
    workplace: z.string().optional(),
    isPrimaryContact: z.boolean().optional(),
    isFinancialResponsible: z.boolean().optional(),
  }),
});

const getParentsSchema = z.object({
  query: z.object({
    page: z.string().transform(Number).optional(),
    limit: z.string().transform(Number).optional(),
    search: z.string().optional(),
    relation: z.string().optional(),
    isPrimaryContact: z.string().transform(val => val === 'true').optional(),
    isFinancialResponsible: z.string().transform(val => val === 'true').optional(),
  }),
});

// Get all parents with pagination and filters
router.get('/', authenticate, validate(getParentsSchema), async (req, res) => {
  try {
    const page = typeof req.query.page === 'string' ? parseInt(req.query.page) : (typeof req.query.page === 'number' ? req.query.page : 1);
    const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit) : (typeof req.query.limit === 'number' ? req.query.limit : 10);
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const isPrimaryContact = typeof req.query.isPrimaryContact === 'string' ? req.query.isPrimaryContact === 'true' : (typeof req.query.isPrimaryContact === 'boolean' ? req.query.isPrimaryContact : undefined);
    const isFinancialResponsible = typeof req.query.isFinancialResponsible === 'string' ? req.query.isFinancialResponsible === 'true' : (typeof req.query.isFinancialResponsible === 'boolean' ? req.query.isFinancialResponsible : undefined);
    
    const result = await ParentService.getParents({
      page,
      limit,
      search,
      relation: req.query.relation as any,
      isPrimaryContact,
      isFinancialResponsible,
    });

    res.json({
      success: true,
      data: result.parents,
      pagination: result.pagination,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch parents',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get parent by ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const parent = await ParentService.getParentById(req.params.id);

    if (!parent) {
      return res.status(404).json({
        success: false,
        error: 'Parent not found'
      });
    }

    res.json({
      success: true,
      data: parent,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch parent',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Create new parent
router.post('/', authenticate, authorize('ADMIN', 'SECRETARY'), validate(createParentSchema), async (req, res) => {
  try {
    const parent = await ParentService.createParent(req.body);

    res.status(201).json({
      success: true,
      data: parent,
      message: 'Parent created successfully',
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: 'Failed to create parent',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Update parent
router.put('/:id', authenticate, authorize('ADMIN', 'SECRETARY'), validate(updateParentSchema), async (req, res) => {
  try {
    const parent = await ParentService.updateParent(req.params.id, req.body);

    res.json({
      success: true,
      data: parent,
      message: 'Parent updated successfully',
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Parent not found') {
      return res.status(404).json({
        success: false,
        error: 'Parent not found'
      });
    }
    res.status(400).json({
      success: false,
      error: 'Failed to update parent',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Delete parent
router.delete('/:id', authenticate, authorize('ADMIN'), async (req, res) => {
  try {
    await ParentService.deleteParent(req.params.id);

    res.json({
      success: true,
      message: 'Parent deleted successfully',
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Parent not found') {
      return res.status(404).json({
        success: false,
        error: 'Parent not found'
      });
    }
    res.status(400).json({
      success: false,
      error: 'Failed to delete parent',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Create a login account for a parent (ADMIN only).
// Le mot de passe est généré automatiquement si aucun n'est fourni. Le compte
// reste inactif tant que le parent n'a pas d'adresse email réelle.
router.post('/:id/create-account', authenticate, authorize('ADMIN'), async (req, res) => {
  try {
    const { password } = req.body || {};
    const result = await ParentService.createUserAccount(req.params.id, password);

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
    res.status(400).json({ success: false, error: 'Failed to create parent account', message });
  }
});

// Reset (regenerate) a parent's account password (ADMIN only).
router.post('/:id/reset-password', authenticate, authorize('ADMIN'), async (req, res) => {
  try {
    const { password } = req.body || {};
    const result = await ParentService.resetUserPassword(req.params.id, password);

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
    res.status(400).json({ success: false, error: 'Failed to reset parent password', message });
  }
});

// Upload parent avatar
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
    const parent = await ParentService.updateAvatar(req.params.id, avatarUrl);

    res.json({
      success: true,
      data: parent,
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

// Search parents (for linking to students)
router.get('/search/:query', authenticate, async (req, res) => {
  try {
    const parents = await ParentService.searchParents(req.params.query);

    res.json({
      success: true,
      data: parents,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to search parents',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get parent statistics
router.get('/stats/overview', authenticate, async (req, res) => {
  try {
    const stats = await ParentService.getParentStats();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch parent statistics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
