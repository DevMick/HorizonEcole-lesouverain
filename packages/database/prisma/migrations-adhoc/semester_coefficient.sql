-- Coefficient des trimestres, pour la moyenne générale annuelle.
-- Convention : le 1er trimestre compte 1, les suivants comptent 2
-- ⇒ MGA = (T1 + 2×T2 + 2×T3) / 5.
-- Idempotent : peut être ré-exécuté sans erreur (base gérée hors migrations Prisma).

ALTER TABLE semesters ADD COLUMN IF NOT EXISTS coefficient INTEGER NOT NULL DEFAULT 1;

-- Passe à 2 tous les trimestres sauf le premier de chaque année scolaire.
-- Le garde-fou `coefficient = 1` évite d'écraser un réglage volontaire au ré-exécution.
WITH ordonnes AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY academic_year_id ORDER BY start_date) AS position
  FROM semesters
)
UPDATE semesters s
SET coefficient = 2
FROM ordonnes o
WHERE s.id = o.id
  AND o.position >= 2
  AND s.coefficient = 1;
