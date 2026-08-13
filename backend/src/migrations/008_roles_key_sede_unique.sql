-- ======================================================
-- MIGRACIÓN 008: Roles key única por sede
-- ======================================================
-- Cambiar la restricción UNIQUE de "key" a una restricción compuesta (key, id_sede)
-- Esto permite tener roles con la misma clave en diferentes sedes

-- 1. Eliminar la restricción UNIQUE actual en la columna "key"
ALTER TABLE "Roles" DROP CONSTRAINT IF EXISTS "Roles_key_key";

-- 2. Agregar restricción UNIQUE compuesta en (key, id_sede)
-- Nota: en PostgreSQL, NULL = NULL no es true para UNIQUE, así que dos roles con id_sede NULL y misma key no se permitirán
-- Pero un role con id_sede=NULL y otro con id_sede=1 con la misma key SÍ se permitirán
ALTER TABLE "Roles" ADD CONSTRAINT "Roles_key_id_sede_key" UNIQUE ("key", "id_sede");