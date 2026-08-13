-- ======================================================
-- MIGRACIÓN 003: Tabla intermedia Especialidad <-> Consultorio
-- Crea la tabla pivote y migra las relaciones existentes que antes se
-- guardaban en la columna id_consultorio de "Especialidades".
-- ======================================================
CREATE TABLE IF NOT EXISTS "Especialidad_Consultorio" (
    id_especialidad INTEGER NOT NULL REFERENCES "Especialidades"(id_especialidad) ON DELETE CASCADE,
    id_consultorio INTEGER NOT NULL REFERENCES "Consultorios"(id_consultorio) ON DELETE CASCADE,
    PRIMARY KEY (id_especialidad, id_consultorio)
);

INSERT INTO "Especialidad_Consultorio" (id_especialidad, id_consultorio)
SELECT id_especialidad, id_consultorio FROM "Especialidades"
WHERE id_consultorio IS NOT NULL
ON CONFLICT DO NOTHING;
