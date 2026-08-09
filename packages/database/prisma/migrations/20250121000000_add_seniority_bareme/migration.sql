-- Migration: Add seniority_bareme field to payroll_settings
-- This field stores the seniority bonus scale (barème) as JSON

-- Add column seniority_bareme to payroll_settings
ALTER TABLE "payroll_settings" 
ADD COLUMN IF NOT EXISTS "seniority_bareme" JSONB;

-- Make seniority_rule_value nullable (since it's not needed when using bareme)
ALTER TABLE "payroll_settings" 
ALTER COLUMN "seniority_rule_value" DROP NOT NULL;

