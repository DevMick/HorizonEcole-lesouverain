-- Migration: Add end_date for CDD contracts and teacher_hours table for vacataires
-- Date: 2025-01-22

-- Add end_date column to teachers table (for CDD contracts)
ALTER TABLE "teachers" 
ADD COLUMN IF NOT EXISTS "end_date" DATE;

-- CreateTable: teacher_hours (for tracking hours worked by vacataires)
CREATE TABLE IF NOT EXISTS "teacher_hours" (
    "id" TEXT NOT NULL,
    "teacher_id" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "hours_worked" DECIMAL(5, 2) NOT NULL,
    "subject" VARCHAR(200),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teacher_hours_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: teacher_hours teacher_id
CREATE INDEX IF NOT EXISTS "teacher_hours_teacher_id_idx" ON "teacher_hours"("teacher_id");

-- CreateIndex: teacher_hours month, year
CREATE INDEX IF NOT EXISTS "teacher_hours_month_year_idx" ON "teacher_hours"("month", "year");

-- CreateUniqueIndex: teacher_hours teacher_id, month, year
CREATE UNIQUE INDEX IF NOT EXISTS "teacher_hours_teacher_id_month_year_key" ON "teacher_hours"("teacher_id", "month", "year");

-- AddForeignKey: teacher_hours -> teachers
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'teacher_hours_teacher_id_fkey'
    ) THEN
        ALTER TABLE "teacher_hours" 
        ADD CONSTRAINT "teacher_hours_teacher_id_fkey" 
        FOREIGN KEY ("teacher_id") 
        REFERENCES "teachers"("id") 
        ON DELETE CASCADE 
        ON UPDATE CASCADE;
    END IF;
END $$;

-- Add prorata fields to monthly_payrolls
ALTER TABLE "monthly_payrolls" 
ADD COLUMN IF NOT EXISTS "prorata_amount" DECIMAL(10, 2);

ALTER TABLE "monthly_payrolls" 
ADD COLUMN IF NOT EXISTS "prorata_days" INTEGER;

ALTER TABLE "monthly_payrolls" 
ADD COLUMN IF NOT EXISTS "prorata_total_days" INTEGER;

