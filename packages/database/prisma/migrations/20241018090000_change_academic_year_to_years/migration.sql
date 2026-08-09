-- AlterTable: Change academic_years date columns to year integers
-- First, add new columns
ALTER TABLE "academic_years" ADD COLUMN "start_year" INTEGER;
ALTER TABLE "academic_years" ADD COLUMN "end_year" INTEGER;

-- Migrate existing data: extract year from dates
UPDATE "academic_years" 
SET "start_year" = EXTRACT(YEAR FROM "start_date")::INTEGER,
    "end_year" = EXTRACT(YEAR FROM "end_date")::INTEGER;

-- Make new columns NOT NULL
ALTER TABLE "academic_years" ALTER COLUMN "start_year" SET NOT NULL;
ALTER TABLE "academic_years" ALTER COLUMN "end_year" SET NOT NULL;

-- Drop old columns
ALTER TABLE "academic_years" DROP COLUMN "start_date";
ALTER TABLE "academic_years" DROP COLUMN "end_date";

