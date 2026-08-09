-- Publication des bulletins d'une classe pour un trimestre.
-- Une ligne = « l'administration a généré les bulletins de cette classe pour ce
-- trimestre le <generated_at> ». Tant qu'elle n'existe pas, les espaces Parent
-- et Élève ne voient pas le bulletin ; et c'est generated_at, pas la date du
-- jour, qui est imprimée sur le PDF.

CREATE TABLE IF NOT EXISTS "bulletin_releases" (
  "id"               TEXT NOT NULL,
  "academic_year_id" TEXT NOT NULL,
  "semester_id"      TEXT NOT NULL,
  "class_id"         TEXT NOT NULL,
  "generated_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "generated_by"     TEXT,
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "bulletin_releases_pkey" PRIMARY KEY ("id")
);

-- Un seul bulletin publié par (année, trimestre, classe) : regénérer met à jour
-- la ligne existante (et donc generated_at) plutôt que d'en créer une seconde.
CREATE UNIQUE INDEX IF NOT EXISTS "bulletin_releases_year_semester_class_key"
  ON "bulletin_releases" ("academic_year_id", "semester_id", "class_id");

CREATE INDEX IF NOT EXISTS "bulletin_releases_class_id_idx" ON "bulletin_releases" ("class_id");
CREATE INDEX IF NOT EXISTS "bulletin_releases_semester_id_idx" ON "bulletin_releases" ("semester_id");

DO $$ BEGIN
  ALTER TABLE "bulletin_releases" ADD CONSTRAINT "bulletin_releases_academic_year_id_fkey"
    FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "bulletin_releases" ADD CONSTRAINT "bulletin_releases_semester_id_fkey"
    FOREIGN KEY ("semester_id") REFERENCES "semesters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "bulletin_releases" ADD CONSTRAINT "bulletin_releases_class_id_fkey"
    FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "bulletin_releases" ADD CONSTRAINT "bulletin_releases_generated_by_fkey"
    FOREIGN KEY ("generated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
