-- Note de conduite : base 20/20 au lieu de 16/20.
-- Idempotent : peut être ré-exécuté sans erreur (base gérée hors migrations Prisma).

-- 1. Nouvelles valeurs par défaut des colonnes.
ALTER TABLE conduct_settings ALTER COLUMN base_note SET DEFAULT 20;
ALTER TABLE conduct_grades   ALTER COLUMN base_note SET DEFAULT 20;
ALTER TABLE conduct_grades   ALTER COLUMN computed_note SET DEFAULT 20;
ALTER TABLE conduct_grades   ALTER COLUMN final_note SET DEFAULT 20;

-- 2. Paramétrages existants restés sur l'ancienne base (16) : on les passe à 20.
--    Une base volontairement différente (ex. 18) n'est pas touchée.
UPDATE conduct_settings SET base_note = 20 WHERE base_note = 16;
