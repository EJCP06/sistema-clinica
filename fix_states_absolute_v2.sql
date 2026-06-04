BEGIN;
SET session_replication_role = 'replica';

-- 1. Renombrar para evitar conflictos
UPDATE "Estado" SET "nombre_estado" = 'TEMP_' || "nombre_estado";

-- 2. Insertar estados definitivos
INSERT INTO "Estado" ("id_estado", "nombre_estado") VALUES 
(1, 'Registrado'),
(2, 'En presupuesto'),
(3, 'En Caja'),
(4, 'Sala de Espera'),
(5, 'Atendido'),
(6, 'Ausente'),
(7, 'Espera de clave');

-- 3. Mapear antiguos IDs (TEMP) a nuevos
UPDATE "Atencion" SET "id_estado_actual" = 1 WHERE "id_estado_actual" IN (SELECT "id_estado" FROM "Estado" WHERE "nombre_estado" = 'TEMP_Registrado');
UPDATE "Atencion" SET "id_estado_actual" = 2 WHERE "id_estado_actual" IN (SELECT "id_estado" FROM "Estado" WHERE "nombre_estado" = 'TEMP_En presupuesto');
UPDATE "Atencion" SET "id_estado_actual" = 3 WHERE "id_estado_actual" IN (SELECT "id_estado" FROM "Estado" WHERE "nombre_estado" = 'TEMP_En Caja');
UPDATE "Atencion" SET "id_estado_actual" = 4 WHERE "id_estado_actual" IN (SELECT "id_estado" FROM "Estado" WHERE "nombre_estado" = 'TEMP_Sala de Espera');
UPDATE "Atencion" SET "id_estado_actual" = 5 WHERE "id_estado_actual" IN (SELECT "id_estado" FROM "Estado" WHERE "nombre_estado" IN ('TEMP_Atendido', 'TEMP_ATENDIDO'));
UPDATE "Atencion" SET "id_estado_actual" = 6 WHERE "id_estado_actual" IN (SELECT "id_estado" FROM "Estado" WHERE "nombre_estado" = 'TEMP_Ausente');
UPDATE "Atencion" SET "id_estado_actual" = 7 WHERE "id_estado_actual" IN (SELECT "id_estado" FROM "Estado" WHERE "nombre_estado" = 'TEMP_Espera de clave');

-- Repetir para Historial
UPDATE "Historial_Atencion" SET "id_estado" = 1 WHERE "id_estado" IN (SELECT "id_estado" FROM "Estado" WHERE "nombre_estado" = 'TEMP_Registrado');
UPDATE "Historial_Atencion" SET "id_estado" = 2 WHERE "id_estado" IN (SELECT "id_estado" FROM "Estado" WHERE "nombre_estado" = 'TEMP_En presupuesto');
UPDATE "Historial_Atencion" SET "id_estado" = 3 WHERE "id_estado" IN (SELECT "id_estado" FROM "Estado" WHERE "nombre_estado" = 'TEMP_En Caja');
UPDATE "Historial_Atencion" SET "id_estado" = 4 WHERE "id_estado" IN (SELECT "id_estado" FROM "Estado" WHERE "nombre_estado" = 'TEMP_Sala de Espera');
UPDATE "Historial_Atencion" SET "id_estado" = 5 WHERE "id_estado" IN (SELECT "id_estado" FROM "Estado" WHERE "nombre_estado" IN ('TEMP_Atendido', 'TEMP_ATENDIDO'));
UPDATE "Historial_Atencion" SET "id_estado" = 6 WHERE "id_estado" IN (SELECT "id_estado" FROM "Estado" WHERE "nombre_estado" = 'TEMP_Ausente');
UPDATE "Historial_Atencion" SET "id_estado" = 7 WHERE "id_estado" IN (SELECT "id_estado" FROM "Estado" WHERE "nombre_estado" = 'TEMP_Espera de clave');

-- 4. Eliminar estados temporales
DELETE FROM "Estado" WHERE "nombre_estado" LIKE 'TEMP_%';

SET session_replication_role = 'origin';
COMMIT;
