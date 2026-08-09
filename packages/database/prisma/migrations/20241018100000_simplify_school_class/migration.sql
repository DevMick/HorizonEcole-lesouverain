-- DropForeignKey
ALTER TABLE "classes" DROP CONSTRAINT IF EXISTS "classes_academic_year_id_fkey";
ALTER TABLE "classes" DROP CONSTRAINT IF EXISTS "classes_main_teacher_id_fkey";

-- DropIndex
DROP INDEX IF EXISTS "classes_academic_year_id_name_key";

-- AlterTable: Simplify classes table to only have name
ALTER TABLE "classes" DROP COLUMN IF EXISTS "academic_year_id";
ALTER TABLE "classes" DROP COLUMN IF EXISTS "level";
ALTER TABLE "classes" DROP COLUMN IF EXISTS "max_students";
ALTER TABLE "classes" DROP COLUMN IF EXISTS "main_teacher_id";

-- CreateIndex: Make name unique
CREATE UNIQUE INDEX "classes_name_key" ON "classes"("name");

