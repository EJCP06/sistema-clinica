/**
 * Integración con el sistema externo de cola MQ (registro de pacientes).
 *
 * Cuando se da de alta un paciente en este sistema se envía su ficha al
 * endpoint externo:
 *
 *   POST {INTEGRACION_COLA_URL}
 *   Content-Type: application/json
 *   X-Api-Key: <keyId>:<secret>        (INTEGRACION_COLA_API_KEY)
 *
 *   { nroCedula, nombre, nacionalidad, fechaNacimiento, sexo, estadoCivil,
 *     direccion, telefono, correo, parentezco, nroCedulaRepresentante,
 *     nombreRepresentante }
 *
 * El externo hace upsert por cédula: responde 201 + created:true si creó el
 * registro y 200 + created:false si actualizó uno existente.
 *
 * Contrato de fallo: NUNCA rompe el alta del paciente. Si el sistema externo
 * no está disponible, responde error o falta configuración, solo se loguea
 * (ver recepcion.controller.crearPaciente, patrón de fallo silencioso).
 *
 * Uso:
 *   const { notificarPacienteCreado } = require('../services/integracionCola.service');
 *   notificarPacienteCreado(paciente); // sin await: no bloquea la respuesta
 */
const path = require('path');
const dotenv = require('dotenv');
const logger = require('../config/logger');

// Carga backend/.env también cuando el servicio se usa desde scripts sueltos
// (mismo patrón redundante que config/db.js).
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const URL_COLA = process.env.INTEGRACION_COLA_URL;
const API_KEY = process.env.INTEGRACION_COLA_API_KEY;
const TIMEOUT_MS = parseInt(process.env.INTEGRACION_COLA_TIMEOUT_MS, 10) || 5000;
const HABILITADA = (process.env.INTEGRACION_COLA_HABILITADA || 'true').toLowerCase() !== 'false';

// Campos obligatorios en el contrato del sistema externo (CreatePatientDto).
const OBLIGATORIOS = [
  'nroCedula',
  'nombre',
  'nacionalidad',
  'fechaNacimiento',
  'sexo',
  'estadoCivil',
  'direccion',
  'telefono',
];

/**
 * Normaliza un valor a string sin espacios sobrantes.
 *
 * @param {*} valor - Valor recibido de la BD o del request
 * @returns {string} Texto limpio ('' si es null/undefined)
 */
const limpiar = (valor) => {
  if (valor === null || valor === undefined) return '';
  return String(valor).trim();
};

/**
 * Convierte fecha a 'YYYY-MM-DD'.
 *
 * Acepta string ISO de PostgreSQL ('2026-09-30' o '2026-09-30T00:00:00.000Z')
 * y objetos Date. Se usan los métodos locales del Date para no correr un día
 * por el desfase de zona horaria.
 *
 * @param {*} valor - fecha_nacimiento
 * @returns {string|null} Fecha formateada o null si no es interpretable
 */
const formatearFecha = (valor) => {
  if (!valor) return null;
  if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
    const anio = valor.getFullYear();
    const mes = String(valor.getMonth() + 1).padStart(2, '0');
    const dia = String(valor.getDate()).padStart(2, '0');
    return `${anio}-${mes}-${dia}`;
  }
  const coincidencia = limpiar(valor).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return coincidencia ? `${coincidencia[1]}-${coincidencia[2]}-${coincidencia[3]}` : null;
};

/**
 * Arma el nombre único del contrato: 'APELLIDO1 APELLIDO2, NOMBRE1 NOMBRE2'
 * (ej. 'PEREZ GOMEZ, JUAN CARLOS'). Los nombres llegan divididos en la BD.
 *
 * @param {object} paciente - Registro de la tabla "Pacientes"
 * @returns {string} Nombre formateado
 */
const armarNombre = (paciente) => {
  const apellidos = [paciente.primer_apellido, paciente.segundo_apellido].map(limpiar).filter(Boolean).join(' ');
  const nombres = [paciente.primer_nombre, paciente.segundo_nombre].map(limpiar).filter(Boolean).join(' ');
  return `${apellidos}, ${nombres}`.replace(/\s+/g, ' ').trim();
};

/**
 * Nacionalidad del contrato a partir de "tipo_documento" (v/e/p).
 * La BD local no almacena nacionalidad: se deriva del tipo de documento
 * (V = venezolano, E = extranjero). Pasaporte (p) queda como 'V' mientras el
 * tutor confirme qué valor espera el sistema externo.
 *
 * @param {*} tipoDocumento - tipo_documento del paciente
 * @returns {string} 'V' | 'E'
 */
const armarNacionalidad = (tipoDocumento) => (limpiar(tipoDocumento).toUpperCase() === 'E' ? 'E' : 'V');

/**
 * Traduce un registro de "Pacientes" al CreatePatientDto del contrato externo.
 * Los campos vacíos se omiten (son opcionales allá); si falta un obligatorio
 * se informa en "faltantes" y el envío se cancela.
 *
 * @param {object} paciente - Registro devuelto por paciente.repository
 * @returns {{payload: object, faltantes: string[]}}
 */
const armarPayload = (paciente) => {
  const payload = {
    nroCedula: limpiar(paciente.cedula),
    nombre: armarNombre(paciente),
    nacionalidad: armarNacionalidad(paciente.tipo_documento),
    fechaNacimiento: formatearFecha(paciente.fecha_nacimiento),
    sexo: limpiar(paciente.sexo).toUpperCase(),
    estadoCivil: limpiar(paciente.estado_civil).toUpperCase(),
    direccion: limpiar(paciente.direccion),
    telefono: limpiar(paciente.telefono),
  };

  const correo = limpiar(paciente.email);
  if (correo) payload.correo = correo;

  const parentezco = limpiar(paciente.parentesco_representante);
  if (parentezco) payload.parentezco = parentezco;

  const cedulaRepresentante = limpiar(paciente.cedula_representante);
  if (cedulaRepresentante) payload.nroCedulaRepresentante = cedulaRepresentante;

  const nombreRepresentante = limpiar(paciente.nombre_representante);
  if (nombreRepresentante) payload.nombreRepresentante = nombreRepresentante;

  const faltantes = OBLIGATORIOS.filter((campo) => !limpiar(payload[campo]));
  return { payload, faltantes };
};

/**
 * Ejecuta la petición POST contra el sistema externo.
 *
 * @param {object} payload - CreatePatientDto armado
 * @returns {Promise<{ok: boolean, status: number|null, created: boolean|null, detalle: string}>}
 */
const enviarPaciente = async (payload) => {
  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), TIMEOUT_MS);

  try {
    const respuesta = await fetch(URL_COLA, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Api-Key': API_KEY,
      },
      body: JSON.stringify(payload),
      signal: controlador.signal,
    });

    const texto = await respuesta.text();
    let cuerpo = null;
    try {
      cuerpo = texto ? JSON.parse(texto) : null;
    } catch {
      cuerpo = texto;
    }

    return {
      ok: respuesta.ok,
      status: respuesta.status,
      created: cuerpo && typeof cuerpo === 'object' ? cuerpo.created : null,
      detalle: typeof cuerpo === 'string' ? cuerpo.slice(0, 300) : JSON.stringify(cuerpo || {}).slice(0, 300),
    };
  } finally {
    clearTimeout(temporizador);
  }
};

/**
 * Notifica el alta de un paciente al sistema externo.
 *
 * Nunca lanza excepciones: devuelve siempre un resultado y loguea el
 * desenlace, de modo que el alta local nunca dependa de esta llamada.
 *
 * @param {object} paciente - Registro devuelto tras el INSERT en "Pacientes"
 * @returns {Promise<{enviado: boolean, motivo: string, status: number|null}>}
 */
const notificarPacienteCreado = async (paciente) => {
  try {
    if (!HABILITADA) return { enviado: false, motivo: 'integracion deshabilitada', status: null };
    if (!paciente) return { enviado: false, motivo: 'sin paciente', status: null };

    if (!URL_COLA || !API_KEY) {
      logger.warn('Integración cola MQ: faltan INTEGRACION_COLA_URL / INTEGRACION_COLA_API_KEY');
      return { enviado: false, motivo: 'sin configuracion', status: null };
    }

    const { payload, faltantes } = armarPayload(paciente);
    if (faltantes.length > 0) {
      logger.warn('Integración cola MQ: ficha incompleta, no se envía', {
        cedula: payload.nroCedula,
        faltantes: faltantes.join(', '),
      });
      return { enviado: false, motivo: `campos obligatorios: ${faltantes.join(', ')}`, status: null };
    }

    const resultado = await enviarPaciente(payload);

    if (resultado.ok) {
      logger.info('Integración cola MQ: paciente enviado', {
        cedula: payload.nroCedula,
        status: resultado.status,
        created: resultado.created,
      });
      return { enviado: true, motivo: 'ok', status: resultado.status };
    }

    // 401/403: credencial inválida (configuración); resto: error del externo.
    const registro = resultado.status === 401 || resultado.status === 403 ? 'error' : 'warn';
    logger[registro]('Integración cola MQ: el sistema externo rechazó la ficha', {
      cedula: payload.nroCedula,
      status: resultado.status,
      detalle: resultado.detalle,
    });
    return { enviado: false, motivo: `status ${resultado.status}`, status: resultado.status };
  } catch (error) {
    // Timeout, DNS, TLS, etc.: se registra y el alta local sigue intacta.
    logger.error('Integración cola MQ: falló la petición', {
      cedula: paciente && paciente.cedula,
      error: error.message,
    });
    return { enviado: false, motivo: error.message, status: null };
  }
};

module.exports = {
  armarPayload,
  armarNombre,
  armarNacionalidad,
  formatearFecha,
  enviarPaciente,
  notificarPacienteCreado,
};
