BEGIN;
SET session_replication_role = 'replica';

-- 1. Insertar nuevos estados temporales para mapear (usar IDs fuera del rango 1-8)
INSERT INTO "Estado" ("id_estado", "nombre_estado") VALUES 
(100, 'TEMP_Registrado'),
(101, 'TEMP_En Caja'),
(102, 'TEMP_Sala de Espera'),
(103, 'TEMP_Llamado'),
(104, 'TEMP_En Atenci?n'),
(105, 'TEMP_Atendido'),
(106, 'TEMP_Ausente'),
(107, 'TEMP_Espera de clave');

-- 2. Mapear Atencion a nuevos IDs temporales
-- Mapeo basado en l?gica anterior o nombres actuales.
UPDATE "Atencion" SET "id_estado_actual" = 100 WHERE "id_estado_actual" = 1; -- Registrado
UPDATE "Atencion" SET "id_estado_actual" = 101 WHERE "id_estado_actual" = 3; -- En Caja
UPDATE "Atencion" SET "id_estado_actual" = 102 WHERE "id_estado_actual" = 4; -- Sala Espera
UPDATE "Atencion" SET "id_estado_actual" = 103 WHERE "id_estado_actual" = 5; -- Llamado
UPDATE "Atencion" SET "id_estado_actual" = 104 WHERE "id_estado_actual" = 99; -- (Si existe estado de "En Atenci?n")
UPDATE "Atencion" SET "id_estado_actual" = 105 WHERE "id_estado_actual" = 5; -- Atendido (era 5, ahora 6)
UPDATE "Atencion" SET "id_estado_actual" = 106 WHERE "id_estado_actual" = 6; -- Ausente (era 6, ahora 7)
UPDATE "Atencion" SET "id_estado_actual" = 107 WHERE "id_estado_actual" = 7; -- Espera clave (era 7, ahora 8)

-- Igual para Historial
UPDATE "Historial_Atencion" SET "id_estado" = 100 WHERE "id_estado" = 1;
UPDATE "Historial_Atencion" SET "id_estado" = 101 WHERE "id_estado" = 3;
UPDATE "Historial_Atencion" SET "id_estado" = 102 WHERE "id_estado" = 4;
UPDATE "Historial_Atencion" SET "id_estado" = 103 WHERE "id_estado" = 5;
UPDATE "Historial_Atencion" SET "id_estado" = 104 WHERE "id_estado" = 99; 
UPDATE "Historial_Atencion" SET "id_estado" = 105 WHERE "id_estado" = 5;
UPDATE "Historial_Atencion" SET "id_estado" = 106 WHERE "id_estado" = 6;
UPDATE "Historial_Atencion" SET "id_estado" = 107 WHERE "id_estado" = 7;

-- 3. Borrar viejos
DELETE FROM "Estado";

-- 4. Reinsertar con IDs definitivos (1-8)
INSERT INTO "Estado" ("id_estado", "nombre_estado") VALUES 
(1, 'Registrado'),
(2, 'En Caja'),
(3, 'Sala de Espera'),
(4, 'Llamado'),
(5, 'En Atenci?n'),
(6, 'Atendido'),
(7, 'Ausente'),
(8, 'Espera de clave');

-- 5. Mapear a definitivos
UPDATE "Atencion" SET "id_estado_actual" = 1 WHERE "id_estado_actual" = 100;
UPDATE "Atencion" SET "id_estado_actual" = 2 WHERE "id_estado_actual" = 101;
UPDATE "Atencion" SET "id_estado_actual" = 3 WHERE "id_estado_actual" = 102;
UPDATE "Atencion" SET "id_estado_actual" = 4 WHERE "id_estado_actual" = 103;
UPDATE "Atencion" SET "id_estado_actual" = 5 WHERE "id_estado_actual" = 104;
UPDATE "Atencion" SET "id_estado_actual" = 6 WHERE "id_estado_actual" = 105;
UPDATE "Atencion" SET "id_estado_actual" = 7 WHERE "id_estado_actual" = 106;
UPDATE "Atencion" SET "id_estado_actual" = 8 WHERE "id_estado_actual" = 107;

UPDATE "Historial_Atencion" SET "id_estado" = 1 WHERE "id_estado" = 100;
UPDATE "Historial_Atencion" SET "id_estado" = 2 WHERE "id_estado" = 101;
UPDATE "Historial_Atencion" SET "id_estado" = 3 WHERE "id_estado" = 102;
UPDATE "Historial_Atencion" SET "id_estado" = 4 WHERE "id_estado" = 103;
UPDATE "Historial_Atencion" SET "id_estado" = 5 WHERE "id_estado" = 104;
UPDATE "Historial_Atencion" SET "id_estado" = 6 WHERE "id_estado" = 105;
UPDATE "Historial_Atencion" SET "id_estado" = 7 WHERE "id_estado" = 106;
UPDATE "Historial_Atencion" SET "id_estado" = 8 WHERE "id_estado" = 107;

-- 6. Borrar temporales
DELETE FROM "Estado" WHERE "id_estado" >= 100;

-- 7. Resetear secuencia
SELECT pg_catalog.setval('public."Estado_id_estado_seq"', 8, true);

SET session_replication_role = 'origin';
COMMIT;
