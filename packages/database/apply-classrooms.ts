import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function applyClassroomsMigration() {
  try {
    console.log('Applying classrooms migration...');

    // Create table if not exists
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "classrooms" (
        "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
        "name" VARCHAR(100) NOT NULL,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "classrooms_pkey" PRIMARY KEY ("id")
      );
    `);

    // Create unique index if not exists
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "classrooms_name_key" ON "classrooms"("name");
    `);

    // Create index if not exists
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "classrooms_name_idx" ON "classrooms"("name");
    `);

    console.log('✅ Classrooms table created successfully!');
  } catch (error: any) {
    if (error.message?.includes('already exists')) {
      console.log('✅ Classrooms table already exists!');
    } else {
      console.error('❌ Error applying migration:', error.message);
      throw error;
    }
  } finally {
    await prisma.$disconnect();
  }
}

applyClassroomsMigration();

