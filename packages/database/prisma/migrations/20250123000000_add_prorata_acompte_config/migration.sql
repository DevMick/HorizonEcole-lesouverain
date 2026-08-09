-- Migration: Add comprehensive prorata and acompte configuration
-- Date: 2025-01-23

-- Add new enums
DO $$ BEGIN
  CREATE TYPE "ProrataBasis" AS ENUM ('CALENDAR_DAYS', 'WORKING_DAYS', 'HOURS');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "DaysInMonthMethod" AS ENUM ('ACTUAL', 'FIXED_30');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "RoundingRule" AS ENUM ('ROUND_NEAREST', 'ROUND_UP');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "RepaymentMethod" AS ENUM ('SINGLE_MONTH', 'INSTALLMENTS');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add prorata configuration fields to payroll_settings
ALTER TABLE "payroll_settings" 
ADD COLUMN IF NOT EXISTS "prorata_enabled" BOOLEAN DEFAULT true;

ALTER TABLE "payroll_settings" 
ADD COLUMN IF NOT EXISTS "prorata_basis" "ProrataBasis" DEFAULT 'CALENDAR_DAYS';

ALTER TABLE "payroll_settings" 
ADD COLUMN IF NOT EXISTS "prorata_days_in_month_method" "DaysInMonthMethod" DEFAULT 'ACTUAL';

ALTER TABLE "payroll_settings" 
ADD COLUMN IF NOT EXISTS "prorata_rounding" "RoundingRule" DEFAULT 'ROUND_NEAREST';

ALTER TABLE "payroll_settings" 
ADD COLUMN IF NOT EXISTS "prorata_include_primes" BOOLEAN DEFAULT true;

ALTER TABLE "payroll_settings" 
ADD COLUMN IF NOT EXISTS "prorata_apply_to" JSONB;

-- Add acompte configuration fields to payroll_settings
ALTER TABLE "payroll_settings" 
ADD COLUMN IF NOT EXISTS "acompte_enabled" BOOLEAN DEFAULT true;

ALTER TABLE "payroll_settings" 
ADD COLUMN IF NOT EXISTS "acompte_max_pct_per_month" DECIMAL(5, 2);

ALTER TABLE "payroll_settings" 
ADD COLUMN IF NOT EXISTS "acompte_max_amount_per_request" DECIMAL(10, 2);

ALTER TABLE "payroll_settings" 
ADD COLUMN IF NOT EXISTS "acompte_max_requests_per_month" INTEGER DEFAULT 2;

ALTER TABLE "payroll_settings" 
ADD COLUMN IF NOT EXISTS "acompte_requires_admin_approval" BOOLEAN DEFAULT true;

ALTER TABLE "payroll_settings" 
ADD COLUMN IF NOT EXISTS "acompte_auto_apply_to_payroll" BOOLEAN DEFAULT true;

ALTER TABLE "payroll_settings" 
ADD COLUMN IF NOT EXISTS "acompte_allow_multiple_types" BOOLEAN DEFAULT true;

ALTER TABLE "payroll_settings" 
ADD COLUMN IF NOT EXISTS "acompte_rounding" "RoundingRule" DEFAULT 'ROUND_NEAREST';

ALTER TABLE "payroll_settings" 
ADD COLUMN IF NOT EXISTS "acompte_repayment_method" "RepaymentMethod" DEFAULT 'SINGLE_MONTH';

-- Update assiette_imposable default value
ALTER TABLE "payroll_settings" 
ALTER COLUMN "assiette_imposable" SET DEFAULT 'BRUT_MOINS_COTISATIONS';

-- Add new fields to advance_payments
ALTER TABLE "advance_payments" 
ADD COLUMN IF NOT EXISTS "status" VARCHAR(50) DEFAULT 'PENDING';

ALTER TABLE "advance_payments" 
ADD COLUMN IF NOT EXISTS "approved_by" TEXT;

ALTER TABLE "advance_payments" 
ADD COLUMN IF NOT EXISTS "approved_at" TIMESTAMP(3);

ALTER TABLE "advance_payments" 
ADD COLUMN IF NOT EXISTS "repayment_method" "RepaymentMethod" DEFAULT 'SINGLE_MONTH';

ALTER TABLE "advance_payments" 
ADD COLUMN IF NOT EXISTS "installments_count" INTEGER DEFAULT 1;

-- Add index on status
CREATE INDEX IF NOT EXISTS "advance_payments_status_idx" ON "advance_payments"("status");

-- Add foreign key for approved_by
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'advance_payments_approved_by_fkey'
  ) THEN
    ALTER TABLE "advance_payments" 
    ADD CONSTRAINT "advance_payments_approved_by_fkey" 
    FOREIGN KEY ("approved_by") 
    REFERENCES "users"("id") 
    ON DELETE SET NULL 
    ON UPDATE CASCADE;
  END IF;
END $$;

-- Update existing records: set default values for new fields
UPDATE "payroll_settings" 
SET 
  "prorata_enabled" = true,
  "prorata_basis" = 'CALENDAR_DAYS',
  "prorata_days_in_month_method" = 'ACTUAL',
  "prorata_rounding" = 'ROUND_NEAREST',
  "prorata_include_primes" = true,
  "acompte_enabled" = true,
  "acompte_max_requests_per_month" = 2,
  "acompte_requires_admin_approval" = true,
  "acompte_auto_apply_to_payroll" = true,
  "acompte_allow_multiple_types" = true,
  "acompte_rounding" = 'ROUND_NEAREST',
  "acompte_repayment_method" = 'SINGLE_MONTH',
  "assiette_imposable" = COALESCE("assiette_imposable", 'BRUT_MOINS_COTISATIONS')
WHERE "prorata_enabled" IS NULL;

-- Update existing advance_payments: set status to APPROVED if already deducted
UPDATE "advance_payments" 
SET "status" = 'APPROVED'
WHERE "deducted" = true AND "status" = 'PENDING';

