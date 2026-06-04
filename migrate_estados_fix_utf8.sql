BEGIN;

-- 1. Crear estado temporal para Atendido (mover de 6 a 9)
INSERT INTO ""Estado"" (""id_estado"", ""nombre_estado"") VALUES (9, 'TEMP_ATENDIDO');
UPDATE ""Atencion"" SET ""id_estado_actual"" = 9 WHERE ""id_estado_actual"" = 6;
UPDATE ""Historial_Atencion"" SET ""id_estado"" = 9 WHERE ""id_estado"" = 6;

-- 2. Mover Ausente (7 -> 6)
UPDATE ""Atencion"" SET ""id_estado_actual"" = 6 WHERE ""id_estado_actual"" = 7;
UPDATE ""Historial_Atencion"" SET ""id_estado"" = 6 WHERE ""id_estado"" = 7;

-- 3. Mover Espera de clave (8 -> 7)
UPDATE ""Atencion"" SET ""id_estado_actual"" = 7 WHERE ""id_estado_actual"" = 8;
UPDATE ""Historial_Atencion"" SET ""id_estado"" = 7 WHERE ""id_estado"" = 8;

-- 4. Mover Atendido (9 -> 8)
UPDATE ""Atencion"" SET ""id_estado_actual"" = 8 WHERE ""id_estado_actual"" = 9;
UPDATE ""Historial_Atencion"" SET ""id_estado"" = 8 WHERE ""id_estado"" = 9;

-- 5. Actualizar nombres en tabla Estado
UPDATE ""Estado"" SET ""nombre_estado"" = 'Ausente' WHERE ""id_estado"" = 6;
UPDATE ""Estado"" SET ""nombre_estado"" = 'Espera de clave' WHERE ""id_estado"" = 7;
UPDATE ""Estado"" SET ""nombre_estado"" = 'Atendido' WHERE ""id_estado"" = 8;

-- 6. Limpiar estado temporal y eliminar registro sobrante (ID 9)
DELETE FROM ""Estado"" WHERE ""id_estado"" = 9;

-- 7. Actualizar secuencia
SELECT pg_catalog.setval('public.""Estado_id_estado_seq""', 8, true);

COMMIT;