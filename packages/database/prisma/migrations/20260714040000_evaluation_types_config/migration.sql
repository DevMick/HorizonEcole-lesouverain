-- Barème "Note sur" porté par le type d'évaluation (10 ou 20, ramené sur /20 au calcul)
ALTER TABLE "evaluation_types" ADD COLUMN IF NOT EXISTS "max_note" INTEGER NOT NULL DEFAULT 20;

-- Coefficient : nouveau défaut = 1 (était 2) pour les NOUVEAUX types. Valeurs métier attendues : 1 ou 2.
-- (Les lignes existantes ne sont pas modifiées ici — voir note dans le récap.)
ALTER TABLE "evaluation_types" ALTER COLUMN "coefficient" SET DEFAULT 1;
