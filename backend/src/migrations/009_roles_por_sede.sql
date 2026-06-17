-- ======================================================
-- MIGRACIÓN 009: Roles por Sede
-- Convierte roles globales (id_sede=NULL) a roles por sede
-- ======================================================

-- 1. Respaldar la relación usuario → rol actual
CREATE TEMP TABLE user_role_backup AS
SELECT u.id_usuario, COALESCE(u.id_sede, 1) as id_sede, r.key as rol_key
FROM "Usuarios" u
LEFT JOIN "Roles" r ON u.id_rol = r.id_rol;

-- 2. Desconectar usuarios de roles (para evitar conflictos FK)
UPDATE "Usuarios" SET id_rol = NULL;

-- 3. Limpiar permisos y roles existentes
DELETE FROM "Roles_Recursos_Acciones";
DELETE FROM "Roles";

-- 4. Crear roles para cada sede
INSERT INTO "Roles" ("nombre", "key", "id_sede", "activo") VALUES
  -- Plaza Sucre (id_sede = 1)
  ('ADMINISTRADOR', 'administrador', 1, true),
  ('RECEPCIONISTA', 'recepcionista', 1, true),
  ('MEDICO', 'medico', 1, true),
  ('COORDINADOR', 'coordinador', 1, true),
  ('ANALISTA', 'analista', 1, true),
  ('LABORATORIO', 'laboratorio', 1, true),
  ('IMAGENES', 'imagenes', 1, true),
  ('ENFERMERO', 'enfermero', 1, true),
  -- Santa Mónica (id_sede = 2)
  ('ADMINISTRADOR', 'administrador', 2, true),
  ('RECEPCIONISTA', 'recepcionista', 2, true),
  ('MEDICO', 'medico', 2, true),
  ('COORDINADOR', 'coordinador', 2, true),
  ('ANALISTA', 'analista', 2, true),
  ('LABORATORIO', 'laboratorio', 2, true),
  ('IMAGENES', 'imagenes', 2, true),
  ('ENFERMERO', 'enfermero', 2, true);

-- 5. Función helper para asignar permisos por sede
CREATE OR REPLACE FUNCTION asignar_permiso_por_sede(
  p_key_rol TEXT, p_id_sede INT, p_key_recurso TEXT, p_key_accion TEXT
) RETURNS VOID AS $$
DECLARE
  v_id_rol INT;
  v_id_rec INT;
  v_id_acc INT;
BEGIN
  SELECT id_rol INTO v_id_rol FROM "Roles" WHERE key = p_key_rol AND id_sede = p_id_sede;
  SELECT id_recurso INTO v_id_rec FROM "Recursos" WHERE key = p_key_recurso;
  SELECT id_accion INTO v_id_acc FROM "Acciones" WHERE key = p_key_accion;
  IF v_id_rol IS NOT NULL AND v_id_rec IS NOT NULL AND v_id_acc IS NOT NULL THEN
    INSERT INTO "Roles_Recursos_Acciones" (id_rol, id_recurso, id_accion)
    VALUES (v_id_rol, v_id_rec, v_id_acc) ON CONFLICT DO NOTHING;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 6. Asignar permisos base a cada sede
DO $$
DECLARE
  sede RECORD;
BEGIN
  FOR sede IN SELECT id_sede FROM "Sedes" LOOP
    -- Administrador: todo
    PERFORM asignar_permiso_por_sede('administrador', sede.id_sede, 'personal', '*');
    PERFORM asignar_permiso_por_sede('administrador', sede.id_sede, 'roles', '*');
    PERFORM asignar_permiso_por_sede('administrador', sede.id_sede, 'especialidades', '*');
    PERFORM asignar_permiso_por_sede('administrador', sede.id_sede, 'admision', '*');
    PERFORM asignar_permiso_por_sede('administrador', sede.id_sede, 'aps', '*');
    PERFORM asignar_permiso_por_sede('administrador', sede.id_sede, 'aseguradoras', '*');
    PERFORM asignar_permiso_por_sede('administrador', sede.id_sede, 'laboratorio', '*');
    PERFORM asignar_permiso_por_sede('administrador', sede.id_sede, 'imagenes', '*');
    PERFORM asignar_permiso_por_sede('administrador', sede.id_sede, 'atencion_medica', '*');
    PERFORM asignar_permiso_por_sede('administrador', sede.id_sede, 'llamado', '*');
    PERFORM asignar_permiso_por_sede('administrador', sede.id_sede, 'admin', '*');
    PERFORM asignar_permiso_por_sede('administrador', sede.id_sede, 'reportes', '*');
    PERFORM asignar_permiso_por_sede('administrador', sede.id_sede, 'permisologia', '*');

    -- Recepcionista: admision
    PERFORM asignar_permiso_por_sede('recepcionista', sede.id_sede, 'admision', '*');

    -- Médico: atencion_medica
    PERFORM asignar_permiso_por_sede('medico', sede.id_sede, 'atencion_medica', '*');

    -- Coordinador: mismas acciones que analista + marcar_ausente
    PERFORM asignar_permiso_por_sede('coordinador', sede.id_sede, 'aps', 'enviar_presupuesto');
    PERFORM asignar_permiso_por_sede('coordinador', sede.id_sede, 'aps', 'solicitar_clave');
    PERFORM asignar_permiso_por_sede('coordinador', sede.id_sede, 'aps', 'enviar_sala_espera');
    PERFORM asignar_permiso_por_sede('coordinador', sede.id_sede, 'aps', 'aprobar_clave');
    PERFORM asignar_permiso_por_sede('coordinador', sede.id_sede, 'aps', 'reincorporar');
    PERFORM asignar_permiso_por_sede('coordinador', sede.id_sede, 'admision', 'marcar_ausente');

    -- Analista: mismas acciones que coordinador (excepto marcar_ausente)
    PERFORM asignar_permiso_por_sede('analista', sede.id_sede, 'aps', 'enviar_presupuesto');
    PERFORM asignar_permiso_por_sede('analista', sede.id_sede, 'aps', 'solicitar_clave');
    PERFORM asignar_permiso_por_sede('analista', sede.id_sede, 'aps', 'enviar_sala_espera');
    PERFORM asignar_permiso_por_sede('analista', sede.id_sede, 'aps', 'aprobar_clave');
    PERFORM asignar_permiso_por_sede('analista', sede.id_sede, 'aps', 'reincorporar');

    -- Laboratorio: laboratorio
    PERFORM asignar_permiso_por_sede('laboratorio', sede.id_sede, 'laboratorio', '*');

    -- Imagenes: imagenes
    PERFORM asignar_permiso_por_sede('imagenes', sede.id_sede, 'imagenes', '*');

    -- Enfermero: admision
    PERFORM asignar_permiso_por_sede('enfermero', sede.id_sede, 'admision', '*');
  END LOOP;
END $$;

-- 7. Limpiar función helper
DROP FUNCTION IF EXISTS asignar_permiso_por_sede;

-- 8. Reasignar usuarios a los roles correctos según su sede
UPDATE "Usuarios" u
SET id_rol = r.id_rol
FROM "Roles" r, user_role_backup b
WHERE u.id_usuario = b.id_usuario
  AND r.key = b.rol_key
  AND r.id_sede = b.id_sede;

-- 9. Usuarios sin rol (backup tenía key NULL): asignar recepcionista de su sede o Plaza Sucre
UPDATE "Usuarios" u
SET id_rol = r.id_rol
FROM "Roles" r
WHERE u.id_rol IS NULL
  AND r.key = 'recepcionista'
  AND r.id_sede = COALESCE(u.id_sede, 1);

-- 10. Limpiar tabla temporal
DROP TABLE IF EXISTS user_role_backup;
