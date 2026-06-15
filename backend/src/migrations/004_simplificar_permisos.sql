-- ======================================================
-- MIGRACIÓN 004: Simplificar a 10 vistast con CRUD
-- Acciones especiales se asignan automáticamente por código
-- ======================================================

-- 1. Limpiar asignaciones actuales
DELETE FROM "Roles_Recursos_Acciones";

-- 2. Limpiar Acciones: solo CRUD básico + wildcard
DELETE FROM "Acciones" WHERE key NOT IN ('ver', 'crear', 'editar', 'eliminar', '*');

-- 3. Reemplazar Recursos con solo las 10 vistast reales
DELETE FROM "Recursos";

INSERT INTO "Recursos" (key, nombre, descripcion) VALUES
  ('admision', 'Admisión', 'Registro de pacientes y generación de turnos'),
  ('aps', 'APS', 'Atención Primaria en Salud'),
  ('laboratorio', 'Laboratorio', 'Atención de laboratorio clínico'),
  ('imagenes', 'Imágenes', 'Atención de estudios de imágenes'),
  ('atencion_medica', 'Atención Médica', 'Consulta y atención médica'),
  ('aseguradoras', 'Aseguradoras', 'Catálogo de aseguradoras'),
  ('personal', 'Personal', 'Gestión de personal de la clínica'),
  ('roles', 'Roles', 'Gestión de roles del sistema'),
  ('especialidades', 'Especialidades', 'Gestión de especialidades médicas'),
  ('permisologia', 'Permisología', 'Gestión de permisos del sistema');

-- 4. Seed: asignar CRUD al administrador para todas las vistast
DO $$
DECLARE
  v_id_rol INT;
  v_id_rec INT;
  v_id_ver INT;
  v_id_crear INT;
  v_id_editar INT;
  v_id_eliminar INT;
  v_wildcard INT;
  v_rec_record RECORD;
BEGIN
  SELECT id_rol INTO v_id_rol FROM "Roles" WHERE key = 'administrador';
  SELECT id_accion INTO v_id_ver FROM "Acciones" WHERE key = 'ver';
  SELECT id_accion INTO v_id_crear FROM "Acciones" WHERE key = 'crear';
  SELECT id_accion INTO v_id_editar FROM "Acciones" WHERE key = 'editar';
  SELECT id_accion INTO v_id_eliminar FROM "Acciones" WHERE key = 'eliminar';
  SELECT id_accion INTO v_wildcard FROM "Acciones" WHERE key = '*';

  FOR v_rec_record IN SELECT id_recurso, key FROM "Recursos" LOOP
    INSERT INTO "Roles_Recursos_Acciones" (id_rol, id_recurso, id_accion)
    VALUES (v_id_rol, v_rec_record.id_recurso, v_wildcard)
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

-- 5. Seed: asignar permisos básicos a roles existentes
-- Recepcionista: admision:ver,crear,editar,eliminar + wildcard
DO $$
DECLARE
  v_id_rol INT;
  v_id_rec INT;
  v_id_ver INT;
  v_id_crear INT;
  v_id_editar INT;
  v_id_eliminar INT;
  v_wildcard INT;
BEGIN
  SELECT id_rol INTO v_id_rol FROM "Roles" WHERE key = 'recepcionista';
  SELECT id_accion INTO v_id_ver FROM "Acciones" WHERE key = 'ver';
  SELECT id_accion INTO v_id_crear FROM "Acciones" WHERE key = 'crear';
  SELECT id_accion INTO v_id_editar FROM "Acciones" WHERE key = 'editar';
  SELECT id_accion INTO v_id_eliminar FROM "Acciones" WHERE key = 'eliminar';
  SELECT id_accion INTO v_wildcard FROM "Acciones" WHERE key = '*';
  SELECT id_recurso INTO v_id_rec FROM "Recursos" WHERE key = 'admision';
  
  INSERT INTO "Roles_Recursos_Acciones" (id_rol, id_recurso, id_accion)
  VALUES (v_id_rol, v_id_rec, v_wildcard) ON CONFLICT DO NOTHING;
END $$;

-- Médico: atencion_medica:*
DO $$
DECLARE
  v_id_rol INT;
  v_id_rec INT;
  v_wildcard INT;
BEGIN
  SELECT id_rol INTO v_id_rol FROM "Roles" WHERE key = 'medico';
  SELECT id_accion INTO v_wildcard FROM "Acciones" WHERE key = '*';
  SELECT id_recurso INTO v_id_rec FROM "Recursos" WHERE key = 'atencion_medica';
  INSERT INTO "Roles_Recursos_Acciones" (id_rol, id_recurso, id_accion)
  VALUES (v_id_rol, v_id_rec, v_wildcard) ON CONFLICT DO NOTHING;
END $$;

-- Laboratorio: laboratorio:*
DO $$
DECLARE
  v_id_rol INT;
  v_id_rec INT;
  v_wildcard INT;
BEGIN
  SELECT id_rol INTO v_id_rol FROM "Roles" WHERE key = 'laboratorio';
  SELECT id_accion INTO v_wildcard FROM "Acciones" WHERE key = '*';
  SELECT id_recurso INTO v_id_rec FROM "Recursos" WHERE key = 'laboratorio';
  INSERT INTO "Roles_Recursos_Acciones" (id_rol, id_recurso, id_accion)
  VALUES (v_id_rol, v_id_rec, v_wildcard) ON CONFLICT DO NOTHING;
END $$;

-- Imagenes: imagenes:*
DO $$
DECLARE
  v_id_rol INT;
  v_id_rec INT;
  v_wildcard INT;
BEGIN
  SELECT id_rol INTO v_id_rol FROM "Roles" WHERE key = 'imagenes';
  SELECT id_accion INTO v_wildcard FROM "Acciones" WHERE key = '*';
  SELECT id_recurso INTO v_id_rec FROM "Recursos" WHERE key = 'imagenes';
  INSERT INTO "Roles_Recursos_Acciones" (id_rol, id_recurso, id_accion)
  VALUES (v_id_rol, v_id_rec, v_wildcard) ON CONFLICT DO NOTHING;
END $$;

-- Enfermero: admision:*
DO $$
DECLARE
  v_id_rol INT;
  v_id_rec INT;
  v_wildcard INT;
BEGIN
  SELECT id_rol INTO v_id_rol FROM "Roles" WHERE key = 'enfermero';
  SELECT id_accion INTO v_wildcard FROM "Acciones" WHERE key = '*';
  SELECT id_recurso INTO v_id_rec FROM "Recursos" WHERE key = 'admision';
  INSERT INTO "Roles_Recursos_Acciones" (id_rol, id_recurso, id_accion)
  VALUES (v_id_rol, v_id_rec, v_wildcard) ON CONFLICT DO NOTHING;
END $$;

-- Coordinador/Analista: aps:ver
DO $$
DECLARE
  v_id_rol INT;
  v_id_rec INT;
  v_id_ver INT;
BEGIN
  SELECT id_accion INTO v_id_ver FROM "Acciones" WHERE key = 'ver';
  
  SELECT id_recurso INTO v_id_rec FROM "Recursos" WHERE key = 'aps';
  SELECT id_rol INTO v_id_rol FROM "Roles" WHERE key = 'coordinador';
  INSERT INTO "Roles_Recursos_Acciones" (id_rol, id_recurso, id_accion)
  VALUES (v_id_rol, v_id_rec, v_id_ver) ON CONFLICT DO NOTHING;
  
  SELECT id_recurso INTO v_id_rec FROM "Recursos" WHERE key = 'aseguradoras';
  INSERT INTO "Roles_Recursos_Acciones" (id_rol, id_recurso, id_accion)
  VALUES (v_id_rol, v_id_rec, v_id_ver) ON CONFLICT DO NOTHING;

  SELECT id_rol INTO v_id_rol FROM "Roles" WHERE key = 'analista';
  SELECT id_recurso INTO v_id_rec FROM "Recursos" WHERE key = 'aps';
  INSERT INTO "Roles_Recursos_Acciones" (id_rol, id_recurso, id_accion)
  VALUES (v_id_rol, v_id_rec, v_id_ver) ON CONFLICT DO NOTHING;
  
  SELECT id_recurso INTO v_id_rec FROM "Recursos" WHERE key = 'aseguradoras';
  INSERT INTO "Roles_Recursos_Acciones" (id_rol, id_recurso, id_accion)
  VALUES (v_id_rol, v_id_rec, v_id_ver) ON CONFLICT DO NOTHING;
END $$;

-- Verificar resultado
SELECT 'Migración 004 completada' as mensaje;
SELECT r.key as rol, rec.key as recurso, STRING_AGG(a.key, ', ' ORDER BY a.key) as acciones
FROM "Roles_Recursos_Acciones" rra
JOIN "Roles" r ON rra.id_rol = r.id_rol
JOIN "Recursos" rec ON rra.id_recurso = rec.id_recurso
JOIN "Acciones" a ON rra.id_accion = a.id_accion
GROUP BY r.key, rec.key
ORDER BY r.key, rec.key;