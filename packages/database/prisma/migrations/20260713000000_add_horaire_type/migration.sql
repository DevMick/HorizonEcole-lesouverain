-- Ajoute un type au créneau horaire : COURS (défaut), RECREATION ou PAUSE.
-- Permet d'afficher récréation / après-midi comme bandes dans la grille et le PDF.
ALTER TABLE "horaires" ADD COLUMN IF NOT EXISTS "type" VARCHAR(20) NOT NULL DEFAULT 'COURS';
