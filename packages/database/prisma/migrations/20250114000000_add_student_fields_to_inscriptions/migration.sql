-- Add student fields to inscriptions table
-- Step 1: Add columns as nullable first
ALTER TABLE "inscriptions" ADD COLUMN IF NOT EXISTS "student_gender" VARCHAR(1);
ALTER TABLE "inscriptions" ADD COLUMN IF NOT EXISTS "student_date_of_birth" TIMESTAMP(3);
ALTER TABLE "inscriptions" ADD COLUMN IF NOT EXISTS "student_birth_place" VARCHAR(255);

-- Step 2: Fill default values for existing records (if any)
-- Set default gender to 'M' for existing records
UPDATE "inscriptions" 
SET "student_gender" = 'M' 
WHERE "student_gender" IS NULL;

-- Set default date of birth to 10 years ago for existing records
UPDATE "inscriptions" 
SET "student_date_of_birth" = (CURRENT_TIMESTAMP - INTERVAL '10 years')
WHERE "student_date_of_birth" IS NULL;

-- Set default birth place for existing records
UPDATE "inscriptions" 
SET "student_birth_place" = 'Non spécifié'
WHERE "student_birth_place" IS NULL;

-- Step 3: Make columns NOT NULL (required)
ALTER TABLE "inscriptions" 
  ALTER COLUMN "student_gender" SET NOT NULL,
  ALTER COLUMN "student_date_of_birth" SET NOT NULL,
  ALTER COLUMN "student_birth_place" SET NOT NULL;

