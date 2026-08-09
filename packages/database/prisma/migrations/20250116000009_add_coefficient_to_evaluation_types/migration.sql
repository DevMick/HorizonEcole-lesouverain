-- AlterTable
-- Add coefficient column to evaluation_types table (nullable, default 2)
ALTER TABLE "evaluation_types" ADD COLUMN IF NOT EXISTS "coefficient" INTEGER DEFAULT 2;

