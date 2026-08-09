import { randomUUID } from 'crypto';
import { ALL_MENU_KEYS } from '@school/types';
import { prisma } from '@school/database';

/**
 * Un rôle protégé (ex. « Administrateur ») reçoit automatiquement tous les
 * menus déclarés dans ALL_MENU_KEYS — il ne peut pas être édité manuellement,
 * donc c'est le seul moyen pour lui d'obtenir les nouveaux menus créés dans
 * l'application. Appelé à la lecture (liste/détail des rôles, login, refresh,
 * /me) pour rester toujours synchronisé sans migration à chaque nouveau menu.
 */
export async function syncProtectedRoleMenus(roleId: string): Promise<void> {
  const current = await prisma.roleMenu.findMany({ where: { roleId }, select: { menuKey: true } });
  const currentKeys = new Set(current.map((m) => m.menuKey));
  const targetKeys = new Set(ALL_MENU_KEYS);

  const toAdd = ALL_MENU_KEYS.filter((k) => !currentKeys.has(k));
  const toRemove = [...currentKeys].filter((k) => !targetKeys.has(k));

  if (toAdd.length === 0 && toRemove.length === 0) return;

  await prisma.$transaction([
    ...(toRemove.length
      ? [prisma.roleMenu.deleteMany({ where: { roleId, menuKey: { in: toRemove } } })]
      : []),
    ...(toAdd.length
      ? [prisma.roleMenu.createMany({ data: toAdd.map((menuKey) => ({ id: randomUUID(), roleId, menuKey })) })]
      : []),
  ]);
}
