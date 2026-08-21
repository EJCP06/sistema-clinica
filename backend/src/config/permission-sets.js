/**
 * Conjuntos de permisos predefinidos ("sets") usados por el sistema de roles.
 *
 * Cada rol creado por el administrador puede combinar una o varias de estas
 * listas, otorgando de una sola vez todas las acciones de un módulo. Los
 * nombres siguen el patrón <recurso>:<accion> y algunos usan el comodín
 * '<recurso>:*' para indicar "todas las acciones del recurso".
 *
 * Relacionado:
 *   - backend/src/config/acciones-especiales.js (acciones por vista)
 *   - backend/src/middleware/permission.js (validación en tiempo real)
 *   - backend/src/repositories/permiso.repository.js (persistencia)
 */
module.exports = {
  // Admisión (APS): alta de pacientes, edición, eliminación y asignación de turnos.
  ADMISION_TOTAL: [
    'admision:crear', 'admision:editar', 'admision:eliminar', 'admision:asignar_turno',
    'admision:*', '*:marcar_ausente', '*:reincorporar'
  ],
  LABORATORIO_TOTAL: [
    'laboratorio:registrar_caja', 'laboratorio:pasar_sala_espera',
    'laboratorio:marcar_ausente', 'laboratorio:reincorporar',
    'laboratorio:*'
  ],
  IMAGENES_TOTAL: [
    'imagenes:registrar_caja', 'imagenes:pasar_sala_espera',
    'imagenes:marcar_ausente', 'imagenes:reincorporar',
    'imagenes:*'
  ],
  ATENCION_MEDICA_TOTAL: [
    'atencion_medica:llamar_siguiente', 'atencion_medica:liberar_consultorio',
    'atencion_medica:iniciar', 'atencion_medica:marcar_ausente', 'atencion_medica:finalizar',
    'atencion_medica:*'
  ],
  RECURSOS_ADMIN: [
    'admision', 'aps', 'laboratorio', 'imagenes', 'aseguradoras',
    'personal', 'roles', 'especialidades', 'permisologia', 'llamado', 'reportes'
  ]
};
