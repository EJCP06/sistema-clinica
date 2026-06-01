-- Migration: remove notificaciones_sms from Pacientes
ALTER TABLE "Pacientes" DROP COLUMN IF EXISTS notificaciones_sms;
-- Note: ejecutar este script en la base de datos (pgAdmin o psql) para eliminar la columna existente.
