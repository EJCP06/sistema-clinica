-- Migration 005: backup and remove email columns from Usuarios and Pacientes
BEGIN;

-- remove email columns if they exist (no backups created)
ALTER TABLE "Usuarios" DROP COLUMN IF EXISTS email;
ALTER TABLE "Pacientes" DROP COLUMN IF EXISTS email;

COMMIT;

-- end migration
