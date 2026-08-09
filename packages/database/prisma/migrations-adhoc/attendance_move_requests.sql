-- Demandes de déplacement de cours (§9.6bis) : un enseignant propose de
-- déplacer un cours à venir, l'administration valide (éventuellement avec une
-- autre date) ou refuse. Idempotent : peut être ré-exécuté sans erreur (base
-- gérée hors migrations Prisma).

CREATE TABLE IF NOT EXISTS attendance_move_requests (
  id                    TEXT PRIMARY KEY,
  timetable_id          TEXT NOT NULL REFERENCES class_timetables(id) ON DELETE CASCADE,
  original_date         DATE NOT NULL,
  requested_date        DATE NOT NULL,
  requested_start_time  VARCHAR(10) NOT NULL,
  requested_end_time    VARCHAR(10) NOT NULL,
  reason                TEXT,
  status                VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  decided_date          DATE,
  decided_start_time    VARCHAR(10),
  decided_end_time      VARCHAR(10),
  admin_note            TEXT,
  created_by            TEXT REFERENCES users(id) ON DELETE SET NULL,
  decided_by            TEXT REFERENCES users(id) ON DELETE SET NULL,
  decided_at            TIMESTAMP(3),
  created_at            TIMESTAMP(3) NOT NULL DEFAULT now(),
  updated_at            TIMESTAMP(3) NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS attendance_move_requests_timetable_id_original_date_key
  ON attendance_move_requests (timetable_id, original_date);

CREATE INDEX IF NOT EXISTS attendance_move_requests_status_idx
  ON attendance_move_requests (status);
