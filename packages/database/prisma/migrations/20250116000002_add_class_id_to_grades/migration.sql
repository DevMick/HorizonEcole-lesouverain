-- AlterTable
-- Add class_id column to grades table (nullable first)
ALTER TABLE "grades" ADD COLUMN IF NOT EXISTS "class_id" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "grades_class_id_idx" ON "grades"("class_id");

-- Update existing grades with class_id from student's class
-- This ensures no data is lost
UPDATE "grades" g
SET "class_id" = (
  SELECT s."class_id"
  FROM "students" s
  WHERE s."id" = g."student_id"
)
WHERE "class_id" IS NULL AND EXISTS (
  SELECT 1 FROM "students" s WHERE s."id" = g."student_id" AND s."class_id" IS NOT NULL
);

-- AddForeignKey constraint
-- Only add if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'grades_class_id_fkey'
  ) THEN
    ALTER TABLE "grades" 
    ADD CONSTRAINT "grades_class_id_fkey" 
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
  SELECT COUNT(*) INTO null_count FROM "grades" WHERE "class_id" IS NULL;
  
  IF null_count = 0 THEN
    ALTER TABLE "grades" ALTER COLUMN "class_id" SET NOT NULL;
  ELSE
    RAISE NOTICE 'Warning: % grades have NULL class_id. Column remains nullable.', null_count;
  END IF;
END $$;

