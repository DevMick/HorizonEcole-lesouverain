-- Conduite : note de comportement par (année, trimestre, classe, élève).
--
-- La note part d'une base (16/20) et perd 1 point par tranche de N heures
-- d'absence non justifiée (N = hours_per_point, 2h par défaut). Les heures sont
-- cumulées à partir des séances d'appel (attendance_sessions/attendance_records,
-- durée réelle du créneau) et du journal legacy student_absences.
-- L'admin peut corriger les heures (justifications) et/ou forcer la note ;
-- la note forcée l'emporte toujours sur le calcul système.

-- Paramètres du calcul, par année scolaire.
CREATE TABLE IF NOT EXISTS "conduct_settings" (
    "id" TEXT NOT NULL,
    "academic_year_id" TEXT NOT NULL,
    "base_note" DECIMAL(5,2) NOT NULL DEFAULT 16,
    "hours_per_point" DECIMAL(4,1) NOT NULL DEFAULT 2,
    "default_session_hours" DECIMAL(4,1) NOT NULL DEFAULT 1,
    "coefficient" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "conduct_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "conduct_settings_academic_year_id_key"
    ON "conduct_settings"("academic_year_id");

-- Note de conduite d'un élève pour un trimestre.
CREATE TABLE IF NOT EXISTS "conduct_grades" (
    "id" TEXT NOT NULL,
    "academic_year_id" TEXT NOT NULL,
    "semester_id" TEXT NOT NULL,
    "class_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "base_note" DECIMAL(5,2) NOT NULL DEFAULT 16,
    "absence_hours" DECIMAL(6,1) NOT NULL DEFAULT 0,
    "penalty" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "computed_note" DECIMAL(5,2) NOT NULL DEFAULT 16,
    "manual_note" DECIMAL(5,2),
    "final_note" DECIMAL(5,2) NOT NULL DEFAULT 16,
    "comment" TEXT,
    "is_validated" BOOLEAN NOT NULL DEFAULT false,
    "computed_at" TIMESTAMP(3),
    "validated_at" TIMESTAMP(3),
    "validated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "conduct_grades_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "conduct_grades_year_semester_class_student_key"
    ON "conduct_grades"("academic_year_id", "semester_id", "class_id", "student_id");
CREATE INDEX IF NOT EXISTS "conduct_grades_academic_year_id_idx" ON "conduct_grades"("academic_year_id");
CREATE INDEX IF NOT EXISTS "conduct_grades_semester_id_idx" ON "conduct_grades"("semester_id");
CREATE INDEX IF NOT EXISTS "conduct_grades_class_id_idx" ON "conduct_grades"("class_id");
CREATE INDEX IF NOT EXISTS "conduct_grades_student_id_idx" ON "conduct_grades"("student_id");

-- Correction manuelle des heures d'absence retenues pour une matière
-- (cas de justification a posteriori). Remplace le total calculé.
CREATE TABLE IF NOT EXISTS "conduct_absence_overrides" (
    "id" TEXT NOT NULL,
    "academic_year_id" TEXT NOT NULL,
    "semester_id" TEXT NOT NULL,
    "class_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,
    "hours" DECIMAL(5,1) NOT NULL DEFAULT 0,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "conduct_absence_overrides_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "conduct_absence_overrides_year_semester_student_subject_key"
    ON "conduct_absence_overrides"("academic_year_id", "semester_id", "student_id", "subject_id");
CREATE INDEX IF NOT EXISTS "conduct_absence_overrides_class_id_idx" ON "conduct_absence_overrides"("class_id");
CREATE INDEX IF NOT EXISTS "conduct_absence_overrides_student_id_idx" ON "conduct_absence_overrides"("student_id");

-- Clés étrangères (idempotent).
DO $$ BEGIN
    ALTER TABLE "conduct_settings" ADD CONSTRAINT "conduct_settings_academic_year_id_fkey"
        FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "conduct_grades" ADD CONSTRAINT "conduct_grades_academic_year_id_fkey"
        FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "conduct_grades" ADD CONSTRAINT "conduct_grades_semester_id_fkey"
        FOREIGN KEY ("semester_id") REFERENCES "semesters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "conduct_grades" ADD CONSTRAINT "conduct_grades_class_id_fkey"
        FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "conduct_grades" ADD CONSTRAINT "conduct_grades_student_id_fkey"
        FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "conduct_grades" ADD CONSTRAINT "conduct_grades_validated_by_fkey"
        FOREIGN KEY ("validated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "conduct_absence_overrides" ADD CONSTRAINT "conduct_absence_overrides_academic_year_id_fkey"
        FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "conduct_absence_overrides" ADD CONSTRAINT "conduct_absence_overrides_semester_id_fkey"
        FOREIGN KEY ("semester_id") REFERENCES "semesters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "conduct_absence_overrides" ADD CONSTRAINT "conduct_absence_overrides_class_id_fkey"
        FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "conduct_absence_overrides" ADD CONSTRAINT "conduct_absence_overrides_student_id_fkey"
        FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "conduct_absence_overrides" ADD CONSTRAINT "conduct_absence_overrides_subject_id_fkey"
        FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
