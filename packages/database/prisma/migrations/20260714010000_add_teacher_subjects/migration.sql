-- Matières qu'un enseignant est habilité à enseigner (fiche enseignant)
CREATE TABLE IF NOT EXISTS "teacher_subjects" (
  "id" TEXT NOT NULL,
  "teacher_id" TEXT NOT NULL,
  "subject_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "teacher_subjects_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "teacher_subjects_teacher_id_subject_id_key" ON "teacher_subjects"("teacher_id", "subject_id");
CREATE INDEX IF NOT EXISTS "teacher_subjects_teacher_id_idx" ON "teacher_subjects"("teacher_id");
CREATE INDEX IF NOT EXISTS "teacher_subjects_subject_id_idx" ON "teacher_subjects"("subject_id");

DO $$ BEGIN
  ALTER TABLE "teacher_subjects" ADD CONSTRAINT "teacher_subjects_teacher_id_fkey"
    FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "teacher_subjects" ADD CONSTRAINT "teacher_subjects_subject_id_fkey"
    FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
