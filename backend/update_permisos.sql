-- Script para actualizar permisos con la nueva estructura de acciones por módulo
-- Ejecutar en la base de datos

-- Primero, eliminar permisos antiguos que ya no se usan
DELETE FROM "Roles_Permisos" WHERE id_permiso IN (
  SELECT id_permiso FROM "Permisos" 
  WHERE key IN (
    'personal_ver', 'roles_ver', 'especialidades_ver', 
    'admision', 'ver_aps', 'laboratorio', 'imagenes', 
    'atencion_medica', 'ver_aseguradoras', 'admin_panel',
    'llamar_siguiente', 'liberar_consultorio', 'marcar_ausente', 'reincorporar'
  )
);

DELETE FROM "Permisos" WHERE key IN (
  'personal_ver', 'roles_ver', 'especialidades_ver', 
  'admision', 'ver_aps', 'laboratorio', 'imagenes', 
  'atencion_medica', 'ver_aseguradoras', 'admin_panel',
  'llamar_siguiente', 'liberar_consultorio', 'marcar_ausente', 'reincorporar'
);

-- Insertar nuevos permisos por módulo y acción

-- ADMISIÓN
INSERT INTO "Permisos" (key, nombre, descripcion) VALUES 
  ('admision_crear', 'Crear', 'Crear pacientes en admisión'),
  ('admision_editar', 'Editar', 'Editar pacientes en admisión'),
  ('admision_eliminar', 'Eliminar', 'Eliminar pacientes en admisión'),
  ('admision_asignar_turno', 'Asignar Turno', 'Asignar turnos en admisión')
ON CONFLICT (key) DO NOTHING;

-- APS
INSERT INTO "Permisos" (key, nombre, descripcion) VALUES 
  ('aps_enviar_presupuesto', 'Enviar Presupuesto', 'Enviar a presupuesto en APS'),
  ('aps_solicitar_clave', 'Solicitar Clave', 'Solicitar clave de aseguradora'),
  ('aps_enviar_sala_espera', 'Enviar Sala Espera', 'Enviar a sala de espera desde APS'),
  ('aps_aprobar_clave', 'Aprobar Clave', 'Aprobar clave de aseguradora'),
  ('aps_reincorporar', 'Reincorporar', 'Reincorporar paciente en APS')
ON CONFLICT (key) DO NOTHING;

-- LABORATORIO
INSERT INTO "Permisos" (key, nombre, descripcion) VALUES 
  ('laboratorio_registrar_caja', 'Registrar Caja', 'Registrar en caja en laboratorio'),
  ('laboratorio_pasar_sala_espera', 'Pasar Sala Espera', 'Pasar a sala de espera en laboratorio'),
  ('laboratorio_marcar_ausente', 'Marcar Ausente', 'Marcar ausente en laboratorio'),
  ('laboratorio_reincorporar', 'Reincorporar', 'Reincorporar en laboratorio')
ON CONFLICT (key) DO NOTHING;

-- IMÁGENES
INSERT INTO "Permisos" (key, nombre, descripcion) VALUES 
  ('imagenes_registrar_caja', 'Registrar Caja', 'Registrar en caja en imágenes'),
  ('imagenes_pasar_sala_espera', 'Pasar Sala Espera', 'Pasar a sala de espera en imágenes'),
  ('imagenes_marcar_ausente', 'Marcar Ausente', 'Marcar ausente en imágenes'),
  ('imagenes_reincorporar', 'Reincorporar', 'Reincorporar en imágenes')
ON CONFLICT (key) DO NOTHING;

-- LLAMADO
INSERT INTO "Permisos" (key, nombre, descripcion) VALUES 
  ('llamado_laboratorio', 'Llamar Laboratorio', 'Llamar paciente de laboratorio'),
  ('llamado_imagenes', 'Llamar Imágenes', 'Llamar paciente de imágenes')
ON CONFLICT (key) DO NOTHING;

-- ASEGURADORAS
INSERT INTO "Permisos" (key, nombre, descripcion) VALUES 
  ('aseguradoras_crear', 'Crear', 'Crear aseguradora'),
  ('aseguradoras_editar', 'Editar', 'Editar aseguradora'),
  ('aseguradoras_eliminar', 'Eliminar', 'Eliminar aseguradora'),
  ('aseguradoras_importar_excel', 'Importar Excel', 'Importar aseguradoras desde Excel')
ON CONFLICT (key) DO NOTHING;

-- ATENCIÓN MÉDICA
INSERT INTO "Permisos" (key, nombre, descripcion) VALUES 
  ('atencion_medica_llamar_siguiente', 'Llamar Siguiente', 'Llamar siguiente paciente'),
  ('atencion_medica_liberar_consultorio', 'Liberar Consultorio', 'Liberar consultorio')
ON CONFLICT (key) DO NOTHING;

-- ESPECIALIDADES
INSERT INTO "Permisos" (key, nombre, descripcion) VALUES 
  ('especialidades_crear', 'Crear', 'Crear especialidad'),
  ('especialidades_editar', 'Editar', 'Editar especialidad'),
  ('especialidades_eliminar', 'Eliminar', 'Eliminar especialidad')
ON CONFLICT (key) DO NOTHING;

-- PERSONAL
INSERT INTO "Permisos" (key, nombre, descripcion) VALUES 
  ('personal_crear', 'Crear', 'Crear personal'),
  ('personal_editar', 'Editar', 'Editar personal'),
  ('personal_eliminar', 'Eliminar', 'Eliminar personal')
ON CONFLICT (key) DO NOTHING;

-- ROLES
INSERT INTO "Permisos" (key, nombre, descripcion) VALUES 
  ('roles_crear', 'Crear', 'Crear rol'),
  ('roles_editar', 'Editar', 'Editar rol'),
  ('roles_eliminar', 'Eliminar', 'Eliminar rol')
ON CONFLICT (key) DO NOTHING;

-- PERMISOLOGÍA
INSERT INTO "Permisos" (key, nombre, descripcion) VALUES 
  ('gestionar_permisos', 'Gestionar Permisos', 'Gestionar permisos de roles')
ON CONFLICT (key) DO NOTHING;

-- OTROS
INSERT INTO "Permisos" (key, nombre, descripcion) VALUES 
  ('admin_panel', 'Panel Admin', 'Acceder al panel de administración'),
  ('ver_reportes', 'Ver Reportes', 'Ver reportes del sistema'),
  ('gestionar_sedes', 'Gestionar Sedes', 'Gestionar sedes'),
  ('gestionar_servicios', 'Gestionar Servicios', 'Gestionar servicios')
ON CONFLICT (key) DO NOTHING;

-- Verificar permisos insertados
SELECT key, nombre FROM "Permisos" ORDER BY key;
