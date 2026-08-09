-- AlterTable
-- Add name column to grades table
ALTER TABLE "grades" ADD COLUMN IF NOT EXISTS "name" VARCHAR(200);

-- Set a default name for existing grades if they don't have one
-- This ensures no data is lost
UPDATE "grades" 
SET "name" = 'Note'
WHERE "name" IS NULL OR "name" = '';

-- Make name NOT NULL after setting defaults
-- This ensures we don't break existing data
DO $$
BEGIN
  ALTER TABLE "grades" ALTER COLUMN "name" SET NOT NULL;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not set name to NOT NULL: %', SQLERRM;
END $$;

