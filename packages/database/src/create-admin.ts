import { PrismaClient, UserRole } from '@prisma/client';
import { ALL_MENU_KEYS, PROTECTED_ADMIN_ROLE_NAME } from '@school/types';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

async function ensureProtectedAdminRole() {
  const role = await prisma.role.upsert({
    where: { name: PROTECTED_ADMIN_ROLE_NAME },
    update: { isProtected: true },
    create: {
      id: randomUUID(),
      name: PROTECTED_ADMIN_ROLE_NAME,
      description: 'Rôle système protégé : accès à tous les menus, ne peut être ni modifié ni supprimé.',
      isProtected: true,
    },
  });

  const existing = await prisma.roleMenu.findMany({ where: { roleId: role.id }, select: { menuKey: true } });
  const existingKeys = new Set(existing.map((m) => m.menuKey));
  const toAdd = ALL_MENU_KEYS.filter((k) => !existingKeys.has(k));
  if (toAdd.length > 0) {
    await prisma.roleMenu.createMany({ data: toAdd.map((menuKey) => ({ id: randomUUID(), roleId: role.id, menuKey })) });
  }

  console.log(`✅ Rôle protégé « ${role.name} » synchronisé avec ${ALL_MENU_KEYS.length} menu(s)`);
  return role;
}

async function main() {
  console.log('🔐 Creating/updating admin user...');

  const adminRole = await ensureProtectedAdminRole();

  // Hash the password
  const hashedPassword = await bcrypt.hash('Admin123', 12);

  // Create or update admin user
  const admin = await prisma.user.upsert({
    where: { email: 'admin@souverainlarabia.edu.ci' },
    update: {
      passwordHash: hashedPassword,
      firstName: 'Admin',
      lastName: 'Souverain',
      role: UserRole.ADMIN,
      roleId: adminRole.id,
      isActive: true,
      isProtected: true,
    },
    create: {
      id: randomUUID(),
      email: 'admin@souverainlarabia.edu.ci',
      passwordHash: hashedPassword,
      firstName: 'Admin',
      lastName: 'Souverain',
      role: UserRole.ADMIN,
      roleId: adminRole.id,
      isActive: true,
      isProtected: true,
    },
  });

  console.log('✅ Admin user created/updated:', admin.email);
  console.log('   - ID:', admin.id);
  console.log('   - Role:', admin.role);
  console.log('   - Rôle personnalisé:', adminRole.name);
  console.log('   - Active:', admin.isActive);
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

