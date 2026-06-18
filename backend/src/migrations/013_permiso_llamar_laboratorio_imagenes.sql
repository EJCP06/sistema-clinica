-- ======================================================
-- MIGRACIÓN 013: Permiso llamado para Laboratorio e Imágenes
-- Crea el recurso 'llamado' y asigna llamado:laboratorio
-- al rol laboratorio y llamado:imagenes al rol imagenes
-- ======================================================

-- 1. Crear recurso 'llamado' si no existe
INSERT INTO "Recursos" (key, nombre) SELECT 'llamado', 'Llamado'
WHERE NOT EXISTS (SELECT 1 FROM "Recursos" WHERE key = 'llamado');

-- 2. Recrear función helper (se eliminó en 009)
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

-- 3. Asignar permisos a ambas sedes
DO $$
DECLARE
  sede RECORD;
BEGIN
  FOR sede IN SELECT id_sede FROM "Sedes" LOOP
    -- Laboratorio: llamado:laboratorio
    PERFORM asignar_permiso_por_sede('laboratorio', sede.id_sede, 'llamado', 'laboratorio');
    -- Imagenes: llamado:imagenes
    PERFORM asignar_permiso_por_sede('imagenes', sede.id_sede, 'llamado', 'imagenes');
  END LOOP;
END $$;

-- 4. Limpiar función helper
DROP FUNCTION IF EXISTS asignar_permiso_por_sede;
