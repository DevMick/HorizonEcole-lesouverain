-- Coefficients d'évaluation personnalisés, propres à chaque enseignant.
-- Le select « Coefficient » du formulaire de type d'évaluation propose TOUJOURS
-- les deux coefficients par défaut (1 et 2) — ils ne sont volontairement PAS
-- stockés ici, ils restent codés côté applicatif et donc indélébiles. Cette
-- table ne contient que les coefficients supplémentaires créés par l'enseignant
-- via le bouton « + ».
-- Idempotent : peut être ré-exécuté sans erreur (base gérée hors migrations Prisma).

CREATE TABLE IF NOT EXISTS "teacher_evaluation_coefficients" (
  "id"         TEXT NOT NULL,
  "teacher_id" TEXT NOT NULL,
  "value"      INTEGER NOT NULL,
  "label"      VARCHAR(60),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "teacher_evaluation_coefficients_pkey" PRIMARY KEY ("id")
);

-- Un même enseignant ne peut pas créer deux fois la même valeur.
CREATE UNIQUE INDEX IF NOT EXISTS "teacher_evaluation_coefficients_teacher_id_value_key"
  ON "teacher_evaluation_coefficients" ("teacher_id", "value");

CREATE INDEX IF NOT EXISTS "teacher_evaluation_coefficients_teacher_id_idx"
  ON "teacher_evaluation_coefficients" ("teacher_id");

-- FK vers teachers (ajoutée seulement si absente : ADD CONSTRAINT n'a pas de IF NOT EXISTS).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'teacher_evaluation_coefficients_teacher_id_fkey'
  ) THEN
    ALTER TABLE "teacher_evaluation_coefficients"
      ADD CONSTRAINT "teacher_evaluation_coefficients_teacher_id_fkey"
      FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
