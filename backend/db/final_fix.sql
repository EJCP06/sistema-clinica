-- Arreglar tabla Usuarios (añadir username)
ALTER TABLE "Usuarios" ADD COLUMN IF NOT EXISTS username CHARACTER VARYING;
UPDATE "Usuarios" SET username = cedula WHERE username IS NULL OR username = '';

-- Asegurar que la columna id_sede esté en Pacientes (por si el script anterior falló)
ALTER TABLE "Pacientes" ADD COLUMN IF NOT EXISTS id_sede INTEGER;
UPDATE "Pacientes" SET id_sede = 1 WHERE id_sede IS NULL;
