-- AlterTable
-- Add class_id column to student_absences table (nullable first)
ALTER TABLE "student_absences" ADD COLUMN IF NOT EXISTS "class_id" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "student_absences_class_id_idx" ON "student_absences"("class_id");

-- Update existing absences with class_id from student's class
-- This ensures no data is lost
UPDATE "student_absences" sa
SET "class_id" = (
  SELECT s."classId"
  FROM "students" s
  WHERE s."id" = sa."student_id"
)
WHERE "class_id" IS NULL AND EXISTS (
  SELECT 1 FROM "students" s WHERE s."id" = sa."student_id" AND s."classId" IS NOT NULL
);

-- AddForeignKey constraint
-- Only add if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'student_absences_class_id_fkey'
  ) THEN
    ALTER TABLE "student_absences" 
    ADD CONSTRAINT "student_absences_class_id_fkey" 
    FOREIGN KEY ("class_id") 
    REFERENCES "classes"("id") 
    ON DELETE CASCADE 
    ON UPDATE CASCADE;
  END IF;
END $$;

-- Make class_id NOT NULL only if all existing rows have been updated
-- This ensures we don't break existing data
DO $$
DECLARE
  null_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO null_count FROM "student_absences" WHERE "class_id" IS NULL;
  
  IF null_count = 0 THEN
    ALTER TABLE "student_absences" ALTER COLUMN "class_id" SET NOT NULL;
  ELSE
    RAISE NOTICE 'Warning: % absences have NULL class_id. Column remains nullable.', null_count;
  END IF;
END $$;

