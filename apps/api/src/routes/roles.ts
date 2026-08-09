import { Router } from 'express';
import { randomUUID } from 'crypto';
import { z } from 'zod';

import { prisma } from '@school/database';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { syncProtectedRoleMenus } from '../services/role-sync.service';

const router = Router();

// ============================================================================
// Validation Schemas
// ============================================================================

const roleBodySchema = z.object({
  name: z.string().min(2, 'Le nom doit contenir au moins 2 caractères'),
  description: z.string().optional(),
  menuKeys: z.array(z.string()).default([]),
});

const createRoleSchema = z.object({ body: roleBodySchema });
const updateRoleSchema = z.object({
  params: z.object({ id: z.string() }),
  body: roleBodySchema.partial(),
});
const idParamSchema = z.object({ params: z.object({ id: z.string() }) });

// ============================================================================
// Helpers
// ============================================================================

function toRoleDto(role: any) {
  return {
    id: role.id,
    name: role.name,
    description: role.description,
    isActive: role.isActive,
    isProtected: role.isProtected,
    menuKeys: (role.menus || []).map((m: any) => m.menuKey),
    usersCount: role._count?.users ?? 0,
    createdAt: role.createdAt,
    updatedAt: role.updatedAt,
  };
}

const roleInclude = { menus: true, _count: { select: { users: true } } };

// ============================================================================
// Routes
// ============================================================================

router.get('/', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    let roles = await prisma.role.findMany({
      include: roleInclude,
      orderBy: { name: 'asc' },
    });

    const protectedRoles = roles.filter((r) => r.isProtected);
    if (protectedRoles.length > 0) {
      await Promise.all(protectedRoles.map((r) => syncProtectedRoleMenus(r.id)));
      roles = await prisma.role.findMany({ include: roleInclude, orderBy: { name: 'asc' } });
    }

    res.json({ success: true, data: roles.map(toRoleDto) });
  } catch (error) {
    console.error('Error fetching roles:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch roles' });
  }
});

router.get('/:id', authenticate, requireRole('ADMIN'), validate(idParamSchema), async (req, res) => {
  try {
    let role = await prisma.role.findUnique({
      where: { id: req.params.id },
      include: roleInclude,
    });
    if (!role) {
      return res.status(404).json({ success: false, error: 'Role not found' });
    }
    if (role.isProtected) {
      await syncProtectedRoleMenus(role.id);
      role = await prisma.role.findUnique({ where: { id: req.params.id }, include: roleInclude });
    }
    res.json({ success: true, data: toRoleDto(role) });
  } catch (error) {
    console.error('Error fetching role:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch role' });
  }
});

router.post('/', authenticate, requireRole('ADMIN'), validate(createRoleSchema), async (req, res) => {
  try {
    const { name, description, menuKeys } = req.body;

    const existing = await prisma.role.findUnique({ where: { name } });
    if (existing) {
      return res.status(409).json({ success: false, error: 'Un rôle avec ce nom existe déjà' });
    }

    const role = await prisma.role.create({
      data: {
        id: randomUUID(),
        name,
        description,
        menus: {
          create: menuKeys.map((menuKey: string) => ({ id: randomUUID(), menuKey })),
        },
      },
      include: roleInclude,
    });

    res.status(201).json({ success: true, data: toRoleDto(role), message: 'Rôle créé avec succès' });
  } catch (error) {
    console.error('Error creating role:', error);
    res.status(500).json({ success: false, error: 'Failed to create role' });
  }
});

router.patch('/:id', authenticate, requireRole('ADMIN'), validate(updateRoleSchema), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, menuKeys, isActive } = req.body;

    const existingRole = await prisma.role.findUnique({ where: { id } });
    if (!existingRole) {
      return res.status(404).json({ success: false, error: 'Role not found' });
    }

    if (existingRole.isProtected) {
      return res.status(403).json({
        success: false,
        error: 'Ce rôle est protégé et ne peut pas être modifié. Il reçoit automatiquement tous les menus.',
      });
    }

    if (name && name !== existingRole.name) {
      const nameTaken = await prisma.role.findUnique({ where: { name } });
      if (nameTaken) {
        return res.status(409).json({ success: false, error: 'Un rôle avec ce nom existe déjà' });
      }
    }

    const role = await prisma.$transaction(async (tx) => {
      if (menuKeys !== undefined) {
        await tx.roleMenu.deleteMany({ where: { roleId: id } });
      }
      return tx.role.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(description !== undefined && { description }),
          ...(isActive !== undefined && { isActive }),
          ...(menuKeys !== undefined && {
            menus: { create: menuKeys.map((menuKey: string) => ({ id: randomUUID(), menuKey })) },
          }),
        },
        include: roleInclude,
      });
    });

    res.json({ success: true, data: toRoleDto(role), message: 'Rôle modifié avec succès' });
  } catch (error) {
    console.error('Error updating role:', error);
    res.status(500).json({ success: false, error: 'Failed to update role' });
  }
});

router.delete('/:id', authenticate, requireRole('ADMIN'), validate(idParamSchema), async (req, res) => {
  try {
    const { id } = req.params;

    const role = await prisma.role.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    });
    if (!role) {
      return res.status(404).json({ success: false, error: 'Role not found' });
    }
    if (role.isProtected) {
      return res.status(403).json({ success: false, error: 'Ce rôle est protégé et ne peut pas être supprimé.' });
    }
    if (role._count.users > 0) {
      return res.status(409).json({
        success: false,
        error: `Ce rôle est affecté à ${role._count.users} utilisateur(s). Réaffectez-les avant de le supprimer.`,
      });
    }

    await prisma.role.delete({ where: { id } });
    res.json({ success: true, message: 'Rôle supprimé avec succès' });
  } catch (error) {
    console.error('Error deleting role:', error);
    res.status(500).json({ success: false, error: 'Failed to delete role' });
  }
});

export default router;
