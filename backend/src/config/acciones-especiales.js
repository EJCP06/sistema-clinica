const ACCIONES_ESPECIALES_POR_VISTA = {
  admision: ['asignar_turno'],
  aps: ['enviar_presupuesto', 'solicitar_clave', 'enviar_sala_espera', 'aprobar_clave', 'reincorporar'],
  laboratorio: ['registrar_caja', 'pasar_sala_espera', 'marcar_ausente', 'reincorporar'],
  imagenes: ['registrar_caja', 'pasar_sala_espera', 'marcar_ausente', 'reincorporar'],
  atencion_medica: ['llamar_siguiente', 'liberar_consultorio', 'iniciar', 'marcar_ausente', 'finalizar'],
  aseguradoras: ['importar_excel'],
  personal: [],
  roles: [],
  especialidades: [],
  permisologia: [],
};

const ACCIONES_ESPECIALES_GLOBALES = ['marcar_ausente', 'reincorporar'];

function getAccionesEspeciales(recursoKey) {
  return ACCIONES_ESPECIALES_POR_VISTA[recursoKey] || [];
}

function getTodasLasAccionesEspeciales(recursoKey) {
  const especificas = getAccionesEspeciales(recursoKey);
  return [...new Set([...especificas, ...ACCIONES_ESPECIALES_GLOBALES])];
}

const VISTAS_CON_ACCIONES_ESPECIALES = Object.keys(ACCIONES_ESPECIALES_POR_VISTA).filter(
  k => ACCIONES_ESPECIALES_POR_VISTA[k].length > 0
);

module.exports = {
  ACCIONES_ESPECIALES_POR_VISTA,
  ACCIONES_ESPECIALES_GLOBALES,
  getAccionesEspeciales,
  getTodasLasAccionesEspeciales,
  VISTAS_CON_ACCIONES_ESPECIALES,
};
