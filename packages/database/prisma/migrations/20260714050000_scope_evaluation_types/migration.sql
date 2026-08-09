-- Rattachement des types d'évaluation à (année scolaire, classe, matière).
-- Colonnes nullables pour ne pas casser les lignes existantes (backfillées séparément).
ALTER TABLE "evaluation_types" ADD COLUMN IF NOT EXISTS "academic_year_id" TEXT;
ALTER TABLE "evaluation_types" ADD COLUMN IF NOT EXISTS "class_id" TEXT;
ALTER TABLE "evaluation_types" ADD COLUMN IF NOT EXISTS "subject_id" TEXT;

CREATE INDEX IF NOT EXISTS "evaluation_types_academic_year_id_idx" ON "evaluation_types"("academic_year_id");
CREATE INDEX IF NOT EXISTS "evaluation_types_class_id_idx" ON "evaluation_types"("class_id");
CREATE INDEX IF NOT EXISTS "evaluation_types_subject_id_idx" ON "evaluation_types"("subject_id");

DO $$ BEGIN
  ALTER TABLE "evaluation_types" ADD CONSTRAINT "evaluation_types_academic_year_id_fkey"
    FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "evaluation_types" ADD CONSTRAINT "evaluation_types_class_id_fkey"
    FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "evaluation_types" ADD CONSTRAINT "evaluation_types_subject_id_fkey"
    FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
