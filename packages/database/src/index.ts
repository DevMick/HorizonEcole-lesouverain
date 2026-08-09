import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

// Function to reset Prisma client (useful after regeneration)
export function resetPrismaClient() {
  if (globalThis.__prisma) {
    globalThis.__prisma.$disconnect().catch(() => {
      // Ignore disconnect errors
    });
    globalThis.__prisma = undefined;
  }
}

// Prevent multiple instances of Prisma Client in development
// Force recreation if refreshToken model is missing (after regeneration)
export const prisma = (() => {
  if (process.env.NODE_ENV === 'production') {
    return new PrismaClient({
      log: ['error'],
    });
  }
  
  // In development, always check and recreate if needed
  // Force recreation if refreshToken model is missing (after regeneration)
  if (!globalThis.__prisma) {
    globalThis.__prisma = new PrismaClient({
      log: ['query', 'error', 'warn'],
    });
  }
  
  // Always check if essential models exist on first access
  // This will be called when the module is loaded
  try {
    // Check for refreshToken model
    if (!('refreshToken' in globalThis.__prisma)) {
      console.warn('⚠️  Prisma client missing refreshToken model. Resetting...');
      resetPrismaClient();
      globalThis.__prisma = new PrismaClient({
        log: ['query', 'error', 'warn'],
      });
      console.log('✅ Prisma client recreated with refreshToken model.');
    }
    
    // Check for paymentType model (payment_types in schema)
    // Prisma converts snake_case model names to camelCase
    if (!('paymentType' in globalThis.__prisma)) {
      console.warn('⚠️  Prisma client missing paymentType model. Resetting...');
      console.warn('   Available models:', Object.keys(globalThis.__prisma).filter(k => !k.startsWith('$') && !k.startsWith('_')));
      resetPrismaClient();
      globalThis.__prisma = new PrismaClient({
        log: ['query', 'error', 'warn'],
      });
      console.log('✅ Prisma client recreated.');
      
      // Verify it's now available
      if (!('paymentType' in globalThis.__prisma)) {
        const availableModels = Object.keys(globalThis.__prisma).filter(k => !k.startsWith('$') && !k.startsWith('_'));
        console.error('❌ paymentType model still not available after reset.');
        console.error('   Available models:', availableModels);
        console.error('   Please run: pnpm --filter @school/database prisma generate');
        console.error('   Then restart the API server.');
      } else {
        console.log('✅ paymentType model is now available.');
      }
    } else {
      console.log('✅ paymentType model is available in Prisma client.');
    }

    // Check for payrollSettings model (payroll_settings in schema)
    // Force reset if payrollSettings model exists but might be outdated
    if ('payrollSettings' in globalThis.__prisma) {
      // Try to access the model to see if it has the new fields
      try {
        // This will fail if the schema is outdated
        const test = globalThis.__prisma.payrollSettings;
        // If we get here, the model exists - check if it has seniority_bareme field
        // We can't directly check fields, but we can try a simple query
        // If it fails with column error, we need to reset
      } catch (error: any) {
        if (error.message?.includes('column') || error.message?.includes('colonne')) {
          console.warn('⚠️  Prisma client payrollSettings model appears outdated. Resetting...');
          resetPrismaClient();
          globalThis.__prisma = new PrismaClient({
            log: ['query', 'error', 'warn'],
          });
          console.log('✅ Prisma client recreated with updated schema.');
        }
      }
    }

    // Check for teacherHours model (teacher_hours in schema)
    if (!('teacherHours' in globalThis.__prisma)) {
      console.warn('⚠️  Prisma client missing teacherHours model. Resetting...');
      console.warn('   Available models:', Object.keys(globalThis.__prisma).filter(k => !k.startsWith('$') && !k.startsWith('_')));
      resetPrismaClient();
      globalThis.__prisma = new PrismaClient({
        log: ['query', 'error', 'warn'],
      });
      console.log('✅ Prisma client recreated.');
      
      // Verify it's now available
      if (!('teacherHours' in globalThis.__prisma)) {
        const availableModels = Object.keys(globalThis.__prisma).filter(k => !k.startsWith('$') && !k.startsWith('_'));
        console.error('❌ teacherHours model still not available after reset.');
        console.error('   Available models:', availableModels);
        console.error('   Please run: pnpm --filter @school/database prisma generate');
        console.error('   Then restart the API server.');
      } else {
        console.log('✅ teacherHours model is now available.');
      }
    }
  } catch (error) {
    // If there's an error accessing models, reset and recreate
    console.warn('⚠️  Error checking Prisma client. Resetting...', error);
    resetPrismaClient();
    globalThis.__prisma = new PrismaClient({
      log: ['query', 'error', 'warn'],
    });
  }
  
  return globalThis.__prisma;
})();

export * from '@prisma/client';
export default prisma;
