-- Adds a configurable Role/RoleMenu system for staff accounts (Gestion des
-- Personnes > Rôles/Utilisateurs). Purely additive: existing `users.role`
-- enum keeps gating API access unchanged; `users.role_id` is an optional
-- link to a custom Role used only to filter which sidebar menus a staff
-- account sees.
CREATE TABLE IF NOT EXISTS "roles" (
  "id" TEXT NOT NULL,
  "name" VARCHAR(100) NOT NULL,
  "description" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "roles_name_key" ON "roles"("name");

CREATE TABLE IF NOT EXISTS "role_menus" (
  "id" TEXT NOT NULL,
  "role_id" TEXT NOT NULL,
  "menu_key" VARCHAR(100) NOT NULL,
  CONSTRAINT "role_menus_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "role_menus_role_id_menu_key_key" ON "role_menus"("role_id", "menu_key");

DO $$ BEGIN
  ALTER TABLE "role_menus" ADD CONSTRAINT "role_menus_role_id_fkey"
    FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role_id" TEXT;

DO $$ BEGIN
  ALTER TABLE "users" ADD CONSTRAINT "users_role_id_fkey"
    FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
