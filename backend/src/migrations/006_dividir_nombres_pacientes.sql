-- ======================================================
-- MIGRACIÓN 006: Dividir nombres de pacientes
-- Convierte nombre/apellido en 4 campos (primer/segundo nombre y
-- primer/segundo apellido) y agrega fecha_nacimiento. Migra los datos
-- existentes partiendo por espacios.
-- ======================================================

ALTER TABLE "Pacientes"
  ADD COLUMN IF NOT EXISTS "primer_nombre" varchar,
  ADD COLUMN IF NOT EXISTS "segundo_nombre" varchar,
  ADD COLUMN IF NOT EXISTS "primer_apellido" varchar,
  ADD COLUMN IF NOT EXISTS "segundo_apellido" varchar,
  ADD COLUMN IF NOT EXISTS "fecha_nacimiento" date;

-- Migrar datos existentes: dividir nombre en primer_nombre y segundo_nombre
UPDATE "Pacientes" SET
  "primer_nombre" = CASE
    WHEN POSITION(' ' IN TRIM("nombre")) > 0
      THEN SPLIT_PART(TRIM("nombre"), ' ', 1)
    ELSE TRIM("nombre")
  END,
  "segundo_nombre" = CASE
    WHEN POSITION(' ' IN TRIM("nombre")) > 0
      THEN SUBSTRING(TRIM("nombre") FROM POSITION(' ' IN TRIM("nombre")) + 1)
    ELSE NULL
  END,
  "primer_apellido" = CASE
    WHEN POSITION(' ' IN TRIM("apellido")) > 0
      THEN SPLIT_PART(TRIM("apellido"), ' ', 1)
    ELSE TRIM("apellido")
  END,
  "segundo_apellido" = CASE
    WHEN POSITION(' ' IN TRIM("apellido")) > 0
      THEN SUBSTRING(TRIM("apellido") FROM POSITION(' ' IN TRIM("apellido")) + 1)
    ELSE NULL
  END;

-- Agregar restricciones NOT NULL después de migrar datos
ALTER TABLE "Pacientes"
  ALTER COLUMN "primer_nombre" SET NOT NULL,
  ALTER COLUMN "primer_apellido" SET NOT NULL;
