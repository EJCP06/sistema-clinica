-- Migración: Dividir nombre/apellido del personal en 4 campos

ALTER TABLE "Usuarios"
  ADD COLUMN IF NOT EXISTS "primer_nombre" varchar,
  ADD COLUMN IF NOT EXISTS "segundo_nombre" varchar,
  ADD COLUMN IF NOT EXISTS "primer_apellido" varchar,
  ADD COLUMN IF NOT EXISTS "segundo_apellido" varchar;

-- Migrar datos existentes
UPDATE "Usuarios" SET
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

-- Agregar restricciones NOT NULL
ALTER TABLE "Usuarios"
  ALTER COLUMN "primer_nombre" SET NOT NULL,
  ALTER COLUMN "primer_apellido" SET NOT NULL;

-- Eliminar columnas viejas
ALTER TABLE "Usuarios" DROP COLUMN IF EXISTS "nombre", DROP COLUMN IF EXISTS "apellido";
