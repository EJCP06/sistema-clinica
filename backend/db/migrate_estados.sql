-- ======================================================
-- MIGRACIÓN: Reorganización de estados (Junio 2026)
-- Nuevos IDs y nombres:
--   1 = Registrado
--   2 = En presupuesto
--   3 = En Caja (nuevo)
--   4 = Sala de Espera (antes id=3)
--   5 = Llamado (antes id=7)
--   6 = Atendido (antes id=4 y 5)
--   7 = Ausente (antes id=6)
--   8 = Espera de clave (nuevo)
-- ======================================================

BEGIN;

-- 1. Insertar estados temporales para evitar violación de FK
INSERT INTO "Estado" ("id_estado", "nombre_estado") VALUES (90, 'TEMP_ATENDIDO');
INSERT INTO "Estado" ("id_estado", "nombre_estado") VALUES (91, 'TEMP_AUSENTE');

-- 2. Cadena: old 5→6, old 6→7, old 7→5 (usando temps para evitar ciclo)
UPDATE "Atencion" SET "id_estado_actual" = 90 WHERE "id_estado_actual" = 5;  -- Atendido → temp
UPDATE "Atencion" SET "id_estado_actual" = 91 WHERE "id_estado_actual" = 6;  -- Ausente → temp
UPDATE "Atencion" SET "id_estado_actual" = 5 WHERE "id_estado_actual" = 7;   -- Llamado → 5
UPDATE "Atencion" SET "id_estado_actual" = 6 WHERE "id_estado_actual" = 90;  -- Atendido → 6
UPDATE "Atencion" SET "id_estado_actual" = 7 WHERE "id_estado_actual" = 91;  -- Ausente → 7

-- Mismos cambios en Historial_Atencion
UPDATE "Historial_Atencion" SET "id_estado" = 90 WHERE "id_estado" = 5;
UPDATE "Historial_Atencion" SET "id_estado" = 91 WHERE "id_estado" = 6;
UPDATE "Historial_Atencion" SET "id_estado" = 5 WHERE "id_estado" = 7;
UPDATE "Historial_Atencion" SET "id_estado" = 6 WHERE "id_estado" = 90;
UPDATE "Historial_Atencion" SET "id_estado" = 7 WHERE "id_estado" = 91;

-- 3. Mover old 3 (SalaEspera) → 4, old 4 (EnAtención) → 6
UPDATE "Atencion" SET "id_estado_actual" = 4 WHERE "id_estado_actual" = 3;
UPDATE "Atencion" SET "id_estado_actual" = 6 WHERE "id_estado_actual" = 4;

UPDATE "Historial_Atencion" SET "id_estado" = 4 WHERE "id_estado" = 3;
UPDATE "Historial_Atencion" SET "id_estado" = 6 WHERE "id_estado" = 4;

-- 4. Actualizar nombres en tabla Estado
UPDATE "Estado" SET "nombre_estado" = 'En Caja' WHERE "id_estado" = 3;
UPDATE "Estado" SET "nombre_estado" = 'Sala de Espera' WHERE "id_estado" = 4;
UPDATE "Estado" SET "nombre_estado" = 'Llamado' WHERE "id_estado" = 5;
UPDATE "Estado" SET "nombre_estado" = 'Atendido' WHERE "id_estado" = 6;
UPDATE "Estado" SET "nombre_estado" = 'Ausente' WHERE "id_estado" = 7;

-- 5. Insertar nuevo estado 8
INSERT INTO "Estado" ("id_estado", "nombre_estado") VALUES (8, 'Espera de clave');

-- 6. Limpiar estados temporales
DELETE FROM "Estado" WHERE "id_estado" IN (90, 91);

-- 7. Actualizar secuencia
SELECT pg_catalog.setval('public."Estado_id_estado_seq"', 8, true);

COMMIT;
