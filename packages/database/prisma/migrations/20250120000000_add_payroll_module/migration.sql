-- CreateEnum: RemunerationMode
CREATE TYPE "RemunerationMode" AS ENUM ('HORAIRE', 'FORFAIT_MENSUEL');

-- CreateEnum: AllowanceType
CREATE TYPE "AllowanceType" AS ENUM ('MONTANT_FIXE', 'POURCENTAGE_DU_BRUT');

-- CreateEnum: AllowanceCategory
CREATE TYPE "AllowanceCategory" AS ENUM ('INDEMNITE', 'PRIME', 'AVANTAGE', 'AVANTAGE_EN_NATURE');

-- CreateEnum: PayrollStatus
CREATE TYPE "PayrollStatus" AS ENUM ('DRAFT', 'VALIDATED', 'PAID', 'CANCELLED');

-- CreateEnum: SeniorityRuleType
CREATE TYPE "SeniorityRuleType" AS ENUM ('POURCENTAGE_PAR_ANNEE', 'MONTANT_PAR_PALIER');

-- CreateEnum: ProrataRule
CREATE TYPE "ProrataRule" AS ENUM ('JOURS_CIVILS', 'JOURS_OUVRES');

-- CreateTable: teacher_remuneration
CREATE TABLE IF NOT EXISTS "teacher_remuneration" (
    "id" TEXT NOT NULL,
    "teacher_id" TEXT NOT NULL,
    "mode_remuneration" "RemunerationMode" NOT NULL,
    "taux_horaire" DECIMAL(10, 2),
    "heures_hebdo" INTEGER,
    "forfait_mensuel" DECIMAL(10, 2),
    "periode_facturation" VARCHAR(50) NOT NULL DEFAULT 'MENSUELLE',
    "cnps_applicable" BOOLEAN NOT NULL DEFAULT true,
    "compte_bancaire" VARCHAR(255),
    "mode_paiement" VARCHAR(50),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teacher_remuneration_pkey" PRIMARY KEY ("id")
);

-- CreateTable: teacher_allowances
CREATE TABLE IF NOT EXISTS "teacher_allowances" (
    "id" TEXT NOT NULL,
    "teacher_id" TEXT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "amount" DECIMAL(10, 2) NOT NULL,
    "type_montant" "AllowanceType" NOT NULL,
    "is_recurring" BOOLEAN NOT NULL DEFAULT false,
    "is_taxable" BOOLEAN NOT NULL DEFAULT true,
    "category" "AllowanceCategory" NOT NULL,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "notes" TEXT,
    "condition" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teacher_allowances_pkey" PRIMARY KEY ("id")
);

-- CreateTable: payroll_settings
CREATE TABLE IF NOT EXISTS "payroll_settings" (
    "id" TEXT NOT NULL,
    "date_calcul_mensuel" INTEGER NOT NULL DEFAULT 25,
    "nombre_semaines_par_mois" DECIMAL(4, 2) NOT NULL DEFAULT 4.33,
    "seniority_rule_type" "SeniorityRuleType" NOT NULL DEFAULT 'POURCENTAGE_PAR_ANNEE',
    "seniority_rule_value" DECIMAL(5, 2) NOT NULL DEFAULT 0.5,
    "seniority_rule_max" DECIMAL(5, 2),
    "prorata_rule" "ProrataRule" NOT NULL DEFAULT 'JOURS_CIVILS',
    "acompte_plafond_percent" DECIMAL(5, 2),
    "assiette_imposable" VARCHAR(100) NOT NULL DEFAULT 'BRUT',
    "calcul_igr_actif" BOOLEAN NOT NULL DEFAULT false,
    "calcul_cnps_actif" BOOLEAN NOT NULL DEFAULT true,
    "taux_cnps_salarie" DECIMAL(5, 2),
    "taux_cnps_employeur" DECIMAL(5, 2),
    "bareme_imposition" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable: monthly_payrolls
CREATE TABLE IF NOT EXISTS "monthly_payrolls" (
    "id" TEXT NOT NULL,
    "teacher_id" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "status" "PayrollStatus" NOT NULL DEFAULT 'DRAFT',
    "base_salary" DECIMAL(10, 2) NOT NULL,
    "total_allowances" DECIMAL(10, 2) NOT NULL DEFAULT 0,
    "seniority_bonus" DECIMAL(10, 2) NOT NULL DEFAULT 0,
    "total_brut" DECIMAL(10, 2) NOT NULL,
    "deductions" DECIMAL(10, 2) NOT NULL DEFAULT 0,
    "net_payable" DECIMAL(10, 2) NOT NULL,
    "hours_worked" DECIMAL(5, 2),
    "absences_deduction" DECIMAL(10, 2) NOT NULL DEFAULT 0,
    "advances_deduction" DECIMAL(10, 2) NOT NULL DEFAULT 0,
    "cnps_salarie" DECIMAL(10, 2),
    "cnps_employeur" DECIMAL(10, 2),
    "igr" DECIMAL(10, 2),
    "validated_by" TEXT,
    "validated_at" TIMESTAMP(3),
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monthly_payrolls_pkey" PRIMARY KEY ("id")
);

-- CreateTable: payroll_items
CREATE TABLE IF NOT EXISTS "payroll_items" (
    "id" TEXT NOT NULL,
    "payroll_id" TEXT NOT NULL,
    "item_type" VARCHAR(50) NOT NULL,
    "item_label" VARCHAR(200) NOT NULL,
    "amount" DECIMAL(10, 2) NOT NULL,
    "allowance_id" TEXT,
    "is_taxable" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable: payroll_payments
CREATE TABLE IF NOT EXISTS "payroll_payments" (
    "id" TEXT NOT NULL,
    "payroll_id" TEXT NOT NULL,
    "amount" DECIMAL(10, 2) NOT NULL,
    "payment_date" DATE NOT NULL,
    "payment_method" "PaymentMethod" NOT NULL,
    "reference" VARCHAR(100),
    "notes" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable: advance_payments
CREATE TABLE IF NOT EXISTS "advance_payments" (
    "id" TEXT NOT NULL,
    "teacher_id" TEXT NOT NULL,
    "amount" DECIMAL(10, 2) NOT NULL,
    "payment_date" DATE NOT NULL,
    "payment_method" "PaymentMethod" NOT NULL,
    "reference" VARCHAR(100),
    "notes" TEXT,
    "deducted" BOOLEAN NOT NULL DEFAULT false,
    "deducted_in_payroll_id" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "advance_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable: payroll_correction_requests
CREATE TABLE IF NOT EXISTS "payroll_correction_requests" (
    "id" TEXT NOT NULL,
    "payroll_id" TEXT NOT NULL,
    "teacher_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    "response" TEXT,
    "responded_by" TEXT,
    "responded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_correction_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: teacher_remuneration
CREATE UNIQUE INDEX IF NOT EXISTS "teacher_remuneration_teacher_id_key" ON "teacher_remuneration"("teacher_id");

-- CreateIndex: teacher_allowances
CREATE INDEX IF NOT EXISTS "teacher_allowances_teacher_id_idx" ON "teacher_allowances"("teacher_id");
CREATE INDEX IF NOT EXISTS "teacher_allowances_is_recurring_idx" ON "teacher_allowances"("is_recurring");
CREATE INDEX IF NOT EXISTS "teacher_allowances_effective_from_effective_to_idx" ON "teacher_allowances"("effective_from", "effective_to");

-- CreateIndex: monthly_payrolls
CREATE UNIQUE INDEX IF NOT EXISTS "monthly_payrolls_teacher_id_month_year_key" ON "monthly_payrolls"("teacher_id", "month", "year");
CREATE INDEX IF NOT EXISTS "monthly_payrolls_teacher_id_idx" ON "monthly_payrolls"("teacher_id");
CREATE INDEX IF NOT EXISTS "monthly_payrolls_month_year_idx" ON "monthly_payrolls"("month", "year");
CREATE INDEX IF NOT EXISTS "monthly_payrolls_status_idx" ON "monthly_payrolls"("status");

-- CreateIndex: payroll_items
CREATE INDEX IF NOT EXISTS "payroll_items_payroll_id_idx" ON "payroll_items"("payroll_id");
CREATE INDEX IF NOT EXISTS "payroll_items_item_type_idx" ON "payroll_items"("item_type");

-- CreateIndex: payroll_payments
CREATE INDEX IF NOT EXISTS "payroll_payments_payroll_id_idx" ON "payroll_payments"("payroll_id");
CREATE INDEX IF NOT EXISTS "payroll_payments_payment_date_idx" ON "payroll_payments"("payment_date");

-- CreateIndex: advance_payments
CREATE INDEX IF NOT EXISTS "advance_payments_teacher_id_idx" ON "advance_payments"("teacher_id");
CREATE INDEX IF NOT EXISTS "advance_payments_payment_date_idx" ON "advance_payments"("payment_date");
CREATE INDEX IF NOT EXISTS "advance_payments_deducted_idx" ON "advance_payments"("deducted");

-- CreateIndex: payroll_correction_requests
CREATE INDEX IF NOT EXISTS "payroll_correction_requests_payroll_id_idx" ON "payroll_correction_requests"("payroll_id");
CREATE INDEX IF NOT EXISTS "payroll_correction_requests_teacher_id_idx" ON "payroll_correction_requests"("teacher_id");
CREATE INDEX IF NOT EXISTS "payroll_correction_requests_status_idx" ON "payroll_correction_requests"("status");

-- AddForeignKey: teacher_remuneration -> teachers
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'teacher_remuneration_teacher_id_fkey'
    ) THEN
        ALTER TABLE "teacher_remuneration" 
        ADD CONSTRAINT "teacher_remuneration_teacher_id_fkey" 
        FOREIGN KEY ("teacher_id") 
        REFERENCES "teachers"("id") 
        ON DELETE CASCADE 
        ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey: teacher_allowances -> teachers
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'teacher_allowances_teacher_id_fkey'
    ) THEN
        ALTER TABLE "teacher_allowances" 
        ADD CONSTRAINT "teacher_allowances_teacher_id_fkey" 
        FOREIGN KEY ("teacher_id") 
        REFERENCES "teachers"("id") 
        ON DELETE CASCADE 
        ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey: monthly_payrolls -> teachers
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'monthly_payrolls_teacher_id_fkey'
    ) THEN
        ALTER TABLE "monthly_payrolls" 
        ADD CONSTRAINT "monthly_payrolls_teacher_id_fkey" 
        FOREIGN KEY ("teacher_id") 
        REFERENCES "teachers"("id") 
        ON DELETE CASCADE 
        ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey: monthly_payrolls -> users (validated_by)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'monthly_payrolls_validated_by_fkey'
    ) THEN
        ALTER TABLE "monthly_payrolls" 
        ADD CONSTRAINT "monthly_payrolls_validated_by_fkey" 
        FOREIGN KEY ("validated_by") 
        REFERENCES "users"("id") 
        ON DELETE SET NULL 
        ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey: monthly_payrolls -> users (created_by)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'monthly_payrolls_created_by_fkey'
    ) THEN
        ALTER TABLE "monthly_payrolls" 
        ADD CONSTRAINT "monthly_payrolls_created_by_fkey" 
        FOREIGN KEY ("created_by") 
        REFERENCES "users"("id") 
        ON DELETE SET NULL 
        ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey: payroll_items -> monthly_payrolls
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'payroll_items_payroll_id_fkey'
    ) THEN
        ALTER TABLE "payroll_items" 
        ADD CONSTRAINT "payroll_items_payroll_id_fkey" 
        FOREIGN KEY ("payroll_id") 
        REFERENCES "monthly_payrolls"("id") 
        ON DELETE CASCADE 
        ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey: payroll_payments -> monthly_payrolls
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'payroll_payments_payroll_id_fkey'
    ) THEN
        ALTER TABLE "payroll_payments" 
        ADD CONSTRAINT "payroll_payments_payroll_id_fkey" 
        FOREIGN KEY ("payroll_id") 
        REFERENCES "monthly_payrolls"("id") 
        ON DELETE CASCADE 
        ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey: payroll_payments -> users (created_by)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'payroll_payments_created_by_fkey'
    ) THEN
        ALTER TABLE "payroll_payments" 
        ADD CONSTRAINT "payroll_payments_created_by_fkey" 
        FOREIGN KEY ("created_by") 
        REFERENCES "users"("id") 
        ON DELETE SET NULL 
        ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey: advance_payments -> teachers
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'advance_payments_teacher_id_fkey'
    ) THEN
        ALTER TABLE "advance_payments" 
        ADD CONSTRAINT "advance_payments_teacher_id_fkey" 
        FOREIGN KEY ("teacher_id") 
        REFERENCES "teachers"("id") 
        ON DELETE CASCADE 
        ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey: advance_payments -> users (created_by)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'advance_payments_created_by_fkey'
    ) THEN
        ALTER TABLE "advance_payments" 
        ADD CONSTRAINT "advance_payments_created_by_fkey" 
        FOREIGN KEY ("created_by") 
        REFERENCES "users"("id") 
        ON DELETE SET NULL 
        ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey: payroll_correction_requests -> monthly_payrolls
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'payroll_correction_requests_payroll_id_fkey'
    ) THEN
        ALTER TABLE "payroll_correction_requests" 
        ADD CONSTRAINT "payroll_correction_requests_payroll_id_fkey" 
        FOREIGN KEY ("payroll_id") 
        REFERENCES "monthly_payrolls"("id") 
        ON DELETE CASCADE 
        ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey: payroll_correction_requests -> users (responded_by)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'payroll_correction_requests_responded_by_fkey'
    ) THEN
        ALTER TABLE "payroll_correction_requests" 
        ADD CONSTRAINT "payroll_correction_requests_responded_by_fkey" 
        FOREIGN KEY ("responded_by") 
        REFERENCES "users"("id") 
        ON DELETE SET NULL 
        ON UPDATE CASCADE;
    END IF;
END $$;

-- Insert default payroll settings
INSERT INTO "payroll_settings" ("id", "date_calcul_mensuel", "nombre_semaines_par_mois", "seniority_rule_type", "seniority_rule_value", "seniority_rule_max", "prorata_rule", "assiette_imposable", "calcul_igr_actif", "calcul_cnps_actif", "created_at", "updated_at")
VALUES (
    gen_random_uuid()::text,
    25,
    4.33,
    'POURCENTAGE_PAR_ANNEE',
    0.5,
    10.0,
    'JOURS_CIVILS',
    'BRUT',
    false,
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT DO NOTHING;

