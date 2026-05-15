-- Arreglar tabla Pacientes
ALTER TABLE "Pacientes" ADD COLUMN IF NOT EXISTS id_sede INTEGER;
UPDATE "Pacientes" SET id_sede = 1 WHERE id_sede IS NULL;

-- Asegurar que Servicios tengan sede
ALTER TABLE "Servicio" ADD COLUMN IF NOT EXISTS id_sede INTEGER;
UPDATE "Servicio" SET id_sede = 1 WHERE id_sede IS NULL;

-- Asegurar que Usuarios tengan sede
UPDATE "Usuarios" SET id_sede = 1 WHERE id_sede IS NULL;
