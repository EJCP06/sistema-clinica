-- Limpiar recursos viejos de la BD
-- Ejecutar este script en la base de datos

-- Eliminar asignaciones de roles que usan recursos viejos
DELETE FROM "Roles_Recursos_Acciones" 
WHERE id_recurso IN (
  SELECT id_recurso FROM "Recursos" 
  WHERE key NOT IN ('admision', 'aps', 'laboratorio', 'imagenes', 'atencion_medica', 'aseguradoras', 'personal', 'roles', 'especialidades', 'permisologia')
);

-- Eliminar los recursos viejos
DELETE FROM "Recursos" 
WHERE key NOT IN ('admision', 'aps', 'laboratorio', 'imagenes', 'atencion_medica', 'aseguradoras', 'personal', 'roles', 'especialidades', 'permisologia');

-- Verificar recursos restantes
SELECT id_recurso, key, nombre FROM "Recursos" ORDER BY id_recurso;

-- Asignar CRUD al administrador para todos los recursos
DO $$
DECLARE
  v_id_rol INT;
  v_wildcard INT;
  v_rec_record RECORD;
BEGIN
  SELECT id_rol INTO v_id_rol FROM "Roles" WHERE key = 'administrador';
  SELECT id_accion INTO v_wildcard FROM "Acciones" WHERE key = '*';
  
  FOR v_rec_record IN SELECT id_recurso FROM "Recursos" LOOP
    INSERT INTO "Roles_Recursos_Acciones" (id_rol, id_recurso, id_accion)
    VALUES (v_id_rol, v_rec_record.id_recurso, v_wildcard)
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

-- Verificar permisos del admin
SELECT r.key as rol, rec.key as recurso, STRING_AGG(a.key, ', ' ORDER BY a.key) as acciones
FROM "Roles_Recursos_Acciones" rra
JOIN "Roles" r ON rra.id_rol = r.id_rol
JOIN "Recursos" rec ON rra.id_recurso = rec.id_recurso
JOIN "Acciones" a ON rra.id_accion = a.id_accion
WHERE r.key = 'administrador'
GROUP BY r.key, rec.key
ORDER BY r.key, rec.key;