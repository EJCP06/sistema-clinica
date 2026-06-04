BEGIN;
SET session_replication_role = 'replica';

-- Insertar nuevos estados con IDs temporales (100-106)
INSERT INTO "Estado" ("id_estado", "nombre_estado") VALUES 
(100, 'Registrado'),
(101, 'En presupuesto'),
(102, 'En Caja'),
(103, 'Sala de Espera'),
(104, 'Atendido'),
(105, 'Ausente'),
(106, 'Espera de clave');

-- Mapear Atencion a nuevos IDs
UPDATE "Atencion" SET "id_estado_actual" = 100 WHERE "id_estado_actual" IN (SELECT "id_estado" FROM "Estado" WHERE "nombre_estado" = 'Registrado');
UPDATE "Atencion" SET "id_estado_actual" = 101 WHERE "id_estado_actual" IN (SELECT "id_estado" FROM "Estado" WHERE "nombre_estado" = 'En presupuesto');
UPDATE "Atencion" SET "id_estado_actual" = 102 WHERE "id_estado_actual" IN (SELECT "id_estado" FROM "Estado" WHERE "nombre_estado" = 'En Caja');
UPDATE "Atencion" SET "id_estado_actual" = 103 WHERE "id_estado_actual" IN (SELECT "id_estado" FROM "Estado" WHERE "nombre_estado" = 'Sala de Espera');
UPDATE "Atencion" SET "id_estado_actual" = 104 WHERE "id_estado_actual" IN (SELECT "id_estado" FROM "Estado" WHERE "nombre_estado" IN ('Atendido', 'ATENDIDO'));
UPDATE "Atencion" SET "id_estado_actual" = 105 WHERE "id_estado_actual" IN (SELECT "id_estado" FROM "Estado" WHERE "nombre_estado" = 'Ausente');
UPDATE "Atencion" SET "id_estado_actual" = 106 WHERE "id_estado_actual" IN (SELECT "id_estado" FROM "Estado" WHERE "nombre_estado" = 'Espera de clave');

-- Igual para Historial
UPDATE "Historial_Atencion" SET "id_estado" = 100 WHERE "id_estado" IN (SELECT "id_estado" FROM "Estado" WHERE "nombre_estado" = 'Registrado');
UPDATE "Historial_Atencion" SET "id_estado" = 101 WHERE "id_estado" IN (SELECT "id_estado" FROM "Estado" WHERE "nombre_estado" = 'En presupuesto');
UPDATE "Historial_Atencion" SET "id_estado" = 102 WHERE "id_estado" IN (SELECT "id_estado" FROM "Estado" WHERE "nombre_estado" = 'En Caja');
UPDATE "Historial_Atencion" SET "id_estado" = 103 WHERE "id_estado" IN (SELECT "id_estado" FROM "Estado" WHERE "nombre_estado" = 'Sala de Espera');
UPDATE "Historial_Atencion" SET "id_estado" = 104 WHERE "id_estado" IN (SELECT "id_estado" FROM "Estado" WHERE "nombre_estado" IN ('Atendido', 'ATENDIDO'));
UPDATE "Historial_Atencion" SET "id_estado" = 105 WHERE "id_estado" IN (SELECT "id_estado" FROM "Estado" WHERE "nombre_estado" = 'Ausente');
UPDATE "Historial_Atencion" SET "id_estado" = 106 WHERE "id_estado" IN (SELECT "id_estado" FROM "Estado" WHERE "nombre_estado" = 'Espera de clave');

-- Borrar viejos
DELETE FROM "Estado" WHERE "id_estado" < 100;

-- Reinsertar con IDs correctos (1-7)
INSERT INTO "Estado" ("id_estado", "nombre_estado") VALUES 
(1, 'Registrado'),
(2, 'En presupuesto'),
(3, 'En Caja'),
(4, 'Sala de Espera'),
(5, 'Atendido'),
(6, 'Ausente'),
(7, 'Espera de clave');

-- Mapear a IDs definitivos (1-7)
UPDATE "Atencion" SET "id_estado_actual" = 1 WHERE "id_estado_actual" = 100;
UPDATE "Atencion" SET "id_estado_actual" = 2 WHERE "id_estado_actual" = 101;
UPDATE "Atencion" SET "id_estado_actual" = 3 WHERE "id_estado_actual" = 102;
UPDATE "Atencion" SET "id_estado_actual" = 4 WHERE "id_estado_actual" = 103;
UPDATE "Atencion" SET "id_estado_actual" = 5 WHERE "id_estado_actual" = 104;
UPDATE "Atencion" SET "id_estado_actual" = 6 WHERE "id_estado_actual" = 105;
UPDATE "Atencion" SET "id_estado_actual" = 7 WHERE "id_estado_actual" = 106;

UPDATE "Historial_Atencion" SET "id_estado" = 1 WHERE "id_estado" = 100;
UPDATE "Historial_Atencion" SET "id_estado" = 2 WHERE "id_estado" = 101;
UPDATE "Historial_Atencion" SET "id_estado" = 3 WHERE "id_estado" = 102;
UPDATE "Historial_Atencion" SET "id_estado" = 4 WHERE "id_estado" = 103;
UPDATE "Historial_Atencion" SET "id_estado" = 5 WHERE "id_estado" = 104;
UPDATE "Historial_Atencion" SET "id_estado" = 6 WHERE "id_estado" = 105;
UPDATE "Historial_Atencion" SET "id_estado" = 7 WHERE "id_estado" = 106;

-- Borrar temporales
DELETE FROM "Estado" WHERE "id_estado" >= 100;

-- Resetear secuencia
SELECT pg_catalog.setval('public."Estado_id_estado_seq"', 7, true);

SET session_replication_role = 'origin';
COMMIT;
