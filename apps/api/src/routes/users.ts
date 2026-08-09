import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { z } from 'zod';

import config from '@school/config';
import { prisma } from '@school/database';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validate } from '../middleware/validate';

const router = Router();

// ============================================================================
// Validation Schemas
// ============================================================================

// Comptes « personnel » génériques (secrétaires, comptables, etc.) — les
// rôles TEACHER/STUDENT/PARENT ont leurs propres parcours de création
// (fiches enseignant/élève/parent) et ne sont pas gérés ici.
//
// Le niveau système (droits API) n'est plus saisi par l'utilisateur : il est
// déduit automatiquement du rôle personnalisé (Role) choisi — le rôle protégé
// « Administrateur » donne ADMIN, tout autre rôle donne ACCOUNTANT. Voir
// POST / et PATCH /:id.
const SYSTEM_ROLES = ['ADMIN', 'ACCOUNTANT'] as const;

const numericPassword = z
  .string()
  .regex(/^\d+$/, 'Le mot de passe doit être uniquement numérique')
  .min(6, 'Le mot de passe doit contenir au moins 6 chiffres');

const getUsersSchema = z.object({
  query: z.object({
    search: z.string().optional(),
    role: z.string().optional(),
  }),
});

const createUserSchema = z.object({
  body: z.object({
    email: z.string().email('Email invalide'),
    firstName: z.string().min(2, 'Le prénom doit contenir au moins 2 caractères'),
    lastName: z.string().min(2, 'Le nom doit contenir au moins 2 caractères'),
    phone: z.string().optional(),
    roleId: z.string().min(1, 'Rôle requis'),
    password: numericPassword,
    isActive: z.boolean().optional(),
  }),
});

const updateUserSchema = z.object({
  params: z.object({ id: z.string() }),
  body: z.object({
    email: z.string().email('Email invalide').optional(),
    firstName: z.string().min(2).optional(),
    lastName: z.string().min(2).optional(),
    phone: z.string().optional(),
    roleId: z.string().min(1, 'Rôle requis').optional(),
    isActive: z.boolean().optional(),
    password: numericPassword.optional(),
  }),
});

const idParamSchema = z.object({ params: z.object({ id: z.string() }) });

const userSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  role: true,
  roleId: true,
  isActive: true,
  isProtected: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  customRole: { select: { id: true, name: true, isProtected: true } },
} as const;

// ============================================================================
// Routes
// ============================================================================

/**
 * GET /api/users
 * Liste des comptes personnel (ADMIN/ACCOUNTANT), recherche + filtre par rôle système.
 */
router.get('/', authenticate, requireRole('ADMIN'), validate(getUsersSchema), async (req, res) => {
  try {
    const { search, role } = req.query as { search?: string; role?: string };

    const where: any = { role: { in: SYSTEM_ROLES } };

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (role) {
      where.role = role;
    }

    const users = await prisma.user.findMany({
      where,
      select: userSelect,
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: users });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch users' });
  }
});

/**
 * GET /api/users/:id
 */
router.get('/:id', authenticate, requireRole('ADMIN'), validate(idParamSchema), async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: userSelect,
    });
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    res.json({ success: true, data: user });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch user' });
  }
});

/**
 * POST /api/users
 * Crée un compte personnel (mot de passe numérique, 6 chiffres minimum).
 */
router.post('/', authenticate, requireRole('ADMIN'), validate(createUserSchema), async (req, res) => {
  try {
    const { email, firstName, lastName, phone, roleId, password, isActive } = req.body;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ success: false, error: 'Un utilisateur avec cet email existe déjà' });
    }

    const customRole = await prisma.role.findUnique({ where: { id: roleId } });
    if (!customRole) {
      return res.status(400).json({ success: false, error: 'Rôle introuvable' });
    }
    // Le niveau système (droits API) se déduit du rôle choisi : le rôle
    // protégé (« Administrateur ») donne ADMIN, tout autre rôle donne ACCOUNTANT.
    const role: (typeof SYSTEM_ROLES)[number] = customRole.isProtected ? 'ADMIN' : 'ACCOUNTANT';

    const passwordHash = await bcrypt.hash(password, config.bcrypt.saltRounds);

    const user = await prisma.user.create({
      data: {
        id: randomUUID(),
        email,
        passwordHash,
        firstName,
        lastName,
        phone,
        role,
        roleId,
        isActive: isActive ?? true,
      },
      select: userSelect,
    });

    res.status(201).json({ success: true, data: user, message: 'Utilisateur créé avec succès' });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ success: false, error: 'Failed to create user' });
  }
});

/**
 * PATCH /api/users/:id
 * Met à jour un compte personnel ; `password` optionnel réinitialise le mot de passe.
 */
router.patch('/:id', authenticate, requireRole('ADMIN'), validate(updateUserSchema), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { email, firstName, lastName, phone, roleId, isActive, password } = req.body;

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    if (email && email !== target.email) {
      const emailTaken = await prisma.user.findUnique({ where: { email } });
      if (emailTaken) {
        return res.status(409).json({ success: false, error: 'Un utilisateur avec cet email existe déjà' });
      }
    }

    // Le niveau système (droits API) se déduit du rôle choisi : le rôle
    // protégé (« Administrateur ») donne ADMIN, tout autre rôle donne ACCOUNTANT.
    let derivedRole: (typeof SYSTEM_ROLES)[number] | undefined;
    if (roleId !== undefined) {
      const customRole = await prisma.role.findUnique({ where: { id: roleId } });
      if (!customRole) {
        return res.status(400).json({ success: false, error: 'Rôle introuvable' });
      }
      derivedRole = customRole.isProtected ? 'ADMIN' : 'ACCOUNTANT';
    }

    // Empêche de retirer le dernier ADMIN actif en le rétrogradant ou en le désactivant.
    if ((derivedRole === 'ACCOUNTANT' && target.role === 'ADMIN') || (isActive === false && target.role === 'ADMIN')) {
      const activeAdmins = await prisma.user.count({ where: { role: 'ADMIN', isActive: true } });
      if (activeAdmins <= 1) {
        return res.status(409).json({ success: false, error: 'Impossible de modifier le dernier administrateur actif' });
      }
    }

    const data: any = {
      ...(email !== undefined && { email }),
      ...(firstName !== undefined && { firstName }),
      ...(lastName !== undefined && { lastName }),
      ...(phone !== undefined && { phone }),
      ...(derivedRole !== undefined && { role: derivedRole }),
      ...(roleId !== undefined && { roleId }),
      ...(isActive !== undefined && { isActive }),
    };
    if (password) {
      data.passwordHash = await bcrypt.hash(password, config.bcrypt.saltRounds);
    }

    const user = await prisma.user.update({ where: { id }, data, select: userSelect });

    res.json({ success: true, data: user, message: 'Utilisateur modifié avec succès' });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ success: false, error: 'Failed to update user' });
  }
});

/**
 * DELETE /api/users/:id
 */
router.delete('/:id', authenticate, requireRole('ADMIN'), validate(idParamSchema), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    if (req.user!.id === id) {
      return res.status(403).json({ success: false, error: 'Vous ne pouvez pas supprimer votre propre compte' });
    }

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    if (target.isProtected) {
      return res.status(403).json({ success: false, error: 'Ce compte administrateur est protégé et ne peut pas être supprimé.' });
    }

    if (target.role === 'ADMIN') {
      const activeAdmins = await prisma.user.count({ where: { role: 'ADMIN', isActive: true } });
      if (activeAdmins <= 1) {
        return res.status(409).json({ success: false, error: 'Impossible de supprimer le dernier administrateur actif' });
      }
    }

    await prisma.user.delete({ where: { id } });
    res.json({ success: true, message: 'Utilisateur supprimé avec succès' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ success: false, error: 'Failed to delete user' });
  }
});

export default router;
