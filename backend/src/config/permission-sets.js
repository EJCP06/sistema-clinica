module.exports = {
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
  COORDINADOR_AYUDA: [
    'admision:marcar_ausente'
  ],
  RECURSOS_ADMIN: [
    'admision', 'aps', 'laboratorio', 'imagenes', 'aseguradoras',
    'personal', 'roles', 'especialidades', 'permisologia', 'llamado', 'reportes'
  ]
};
