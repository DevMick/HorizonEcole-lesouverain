-- AlterTable
-- Add number column to evaluation_types table (nullable integer)
-- Represents the "numéro" of the evaluation type (ex: DEVOIR N°1, N°2…)
ALTER TABLE "evaluation_types" ADD COLUMN IF NOT EXISTS "number" INTEGER;
