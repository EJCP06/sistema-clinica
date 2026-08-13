-- ======================================================
-- MIGRACIÓN 010: Usuarios Cédula por Sede
-- (La misma cédula puede existir en distintas sedes.)
-- Permite que la misma cédula exista en diferentes sedes
-- ======================================================

-- 1. Eliminar la restricción de unicidad global en la cédula
ALTER TABLE "Usuarios" DROP CONSTRAINT IF EXISTS "Usuarios_cedula_key";

-- 2. Agregar una restricción de unicidad compuesta (cédula, id_sede)
-- Esto permite que la misma cédula se repita, siempre que sea en sedes distintas
ALTER TABLE "Usuarios" ADD CONSTRAINT "Usuarios_cedula_sede_key" UNIQUE ("cedula", "id_sede");
