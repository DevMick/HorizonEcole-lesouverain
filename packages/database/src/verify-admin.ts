import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Verifying admin user...');

  const user = await prisma.user.findUnique({
    where: { email: 'admin@souverainlarabia.edu.ci' },
  });

  if (!user) {
    console.log('❌ User not found');
    return;
  }

  console.log('✅ User exists');
  console.log('   - ID:', user.id);
  console.log('   - Email:', user.email);
  console.log('   - Role:', user.role);
  console.log('   - Active:', user.isActive);
  console.log('   - Password hash length:', user.passwordHash.length);

  // Test password
  const valid = await bcrypt.compare('admin123', user.passwordHash);
  console.log('   - Password "admin123" is valid:', valid);
  
  if (!valid) {
    console.log('⚠️  Password mismatch! Re-hashing...');
    const hashedPassword = await bcrypt.hash('admin123', 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: hashedPassword },
    });
    console.log('✅ Password updated');
    
    // Verify again
    const newHash = (await prisma.user.findUnique({
      where: { id: user.id },
    }))!.passwordHash;
    const nowValid = await bcrypt.compare('admin123', newHash);
    console.log('   - Password "admin123" is now valid:', nowValid);
  }
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

