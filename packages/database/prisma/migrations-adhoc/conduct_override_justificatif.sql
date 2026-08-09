-- Ajoute les colonnes justificatif au tableau des corrections d'heures de conduite.
-- Idempotent : peut être ré-exécuté sans erreur (base gérée hors migrations Prisma).
ALTER TABLE conduct_absence_overrides
  ADD COLUMN IF NOT EXISTS justificatif_url TEXT,
  ADD COLUMN IF NOT EXISTS justificatif_filename TEXT;
