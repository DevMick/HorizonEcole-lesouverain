-- Conduite : les heures d'absence se comptent en HEURES DE COURS (créneaux de
-- l'emploi du temps), pas en minutes réelles. Un créneau dure typiquement 50 min
-- (07:45–08:35) et vaut 1 heure de cours ; une séance couvrant deux créneaux
-- consécutifs (08:35–10:15) vaut 2 heures de cours.
--
-- period_minutes = durée d'un créneau, servant de diviseur :
--   heures = arrondi(durée de la séance / period_minutes), minimum 1.
ALTER TABLE "conduct_settings"
    ADD COLUMN IF NOT EXISTS "period_minutes" INTEGER NOT NULL DEFAULT 50;
