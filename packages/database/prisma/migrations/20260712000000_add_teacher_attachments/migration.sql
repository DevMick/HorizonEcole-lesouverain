-- Add attachments column to teachers, mirroring students.attachments
ALTER TABLE "teachers" ADD COLUMN IF NOT EXISTS "attachments" TEXT[] NOT NULL DEFAULT '{}';
