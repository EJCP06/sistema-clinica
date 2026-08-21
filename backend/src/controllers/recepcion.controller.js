const logger = require('../config/logger');
const pacienteRepo = require('../repositories/paciente.repository');
const atencionRepo = require('../repositories/atencion.repository');
const sharedRepo = require('../repositories/shared.repository');
const historialRepo = require('../repositories/historial.repository');
const espRepo = require('../repositories/especialidad.repository');
const pool = require('../config/db');
const ttsService = require('../services/tts.service');

const getSede = (req) => {
  const sede = req.usuario?.id_sede;
  return sede !== undefined && sede !== null ? Number(sede) : null;
};

/**
 * Obtiene la lista de responsables de pago disponibles.
 *
 * @param {import('express').Request} req - Petición HTTP
 * @param {import('express').Response} res - Respuesta HTTP
 * @returns {Promise<void>}
 */
const getResponsablesPago = async (req, res) => {
  try {
    const rows = await sharedRepo.getResponsablesPago();
    res.json(rows);
  } catch (error) {
    logger.error(error);
    res.status(500).json({ mensaje: 'Error al obtener responsables de pago' });
  }
};

/**
 * Marca un paciente como ausente. Solo permite cambiar estados
 * válidos (Registrado, Sala de Espera, Llamado, Reincorporado).
 *
 * @param {import('express').Request} req - Petición HTTP
 * @param {import('express').Response} res - Respuesta HTTP
 * @returns {Promise<void>}
 */
const marcarAusente = async (req, res) => {
  const sede = getSede(req);
  if (!sede) return res.status(401).json({ mensaje: 'Sin sede' });

  try {
    const { id } = req.params;

    const atencion = await atencionRepo.getAtencionEstado(id, sede);
    if (!atencion) {
      return res.status(404).json({ mensaje: 'Atención no encontrada' });
    }

    const idEstadoActual = atencion.id_estado_actual;

    // Estado 1 (Registrado) también es retirable: APS, Laboratorio e Imágenes
    // muestran el botón de retiro en la fila recién registrada.
    if (![1, 2, 3, 7, 8].includes(idEstadoActual)) {
      return res.status(400).json({ mensaje: 'Solo se pueden retirar pacientes en estados válidos' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      const result = await atencionRepo.marcarAusente(client, id, 9);
      
      await client.query('COMMIT');
      
      // Solo se emite e inserta historial si el estado realmente cambió
      // (idempotente ante dobles envíos o reintentos).
      if (result && req.io) {
        const admision = await atencionRepo.getAdmisionById(id, sede);
        req.io.emit('estado-actualizado', { tipo: 'retirado', id_atencion: Number(id), admision, id_sede: sede });
      }
      
      if (result) {
        await historialRepo.insertSinTransaccion(id, 9);
      }
      
      res.json({ mensaje: 'Paciente retirado correctamente' });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error(error);
    if (error.code === '23505') {
      return res.status(400).json({ mensaje: 'Ya existe una atención con ese estado' });
    }    res.status(500).json({ mensaje: 'Error al marcar paciente como ausente' });
  }
};

/**
 * Marca un paciente como AUSENTE (estado 7). Diferente de marcarAusente
 * que retira (estado 9). El ausente puede reincorporarse después.
 */
const marcarAusente7 = async (req, res) => {
  const sede = getSede(req);
  if (!sede) return res.status(401).json({ mensaje: 'Sin sede' });

  try {
    const { id } = req.params;
    const atencion = await atencionRepo.getAtencionEstado(id, sede);
    if (!atencion) {
      return res.status(404).json({ mensaje: 'Atención no encontrada' });
    }

    const idEstadoActual = atencion.id_estado_actual;
    if (![1, 2, 3, 4].includes(idEstadoActual)) {
      return res.status(400).json({ mensaje: 'Solo se pueden marcar ausente pacientes en estados Registrado, Presupuesto, Sala de Espera o Llamado' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await atencionRepo.marcarAusente(client, id, 7);
      await client.query('COMMIT');

      if (result && req.io) {
        const admision = await atencionRepo.getAdmisionById(id, sede);
        req.io.emit('estado-actualizado', { tipo: 'ausente', id_atencion: Number(id), admision, id_sede: sede });
      }

      if (result) {
        await historialRepo.insertSinTransaccion(id, 7);
      }

      res.json({ mensaje: 'Paciente marcado como ausente' });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error(error);
    res.status(500).json({ mensaje: 'Error al marcar paciente como ausente' });
  }
};



/**
 * Obtiene las últimas admisiones (turnos) registradas en la sede.
 *
 * @param {import('express').Request} req - Petición HTTP
 * @param {import('express').Response} res - Respuesta HTTP
 * @returns {Promise<void>}
 */
const getUltimasAdmisiones = async (req, res) => {
  const sede = getSede(req);
  if (!sede) return res.status(401).json({ mensaje: 'Sin sede' });

  try {
    const rows = await atencionRepo.getUltimasAdmisiones(sede);
    res.json(rows);
  } catch (error) {
    logger.error(error);
    res.status(500).json({ mensaje: 'Error al obtener últimas admisiones' });
  }
};

/**
 * Busca pacientes por término y filtro dentro de la sede.
 *
 * @param {import('express').Request} req - Petición HTTP
 * @param {import('express').Response} res - Respuesta HTTP
 * @returns {Promise<void>}
 */
const buscarPaciente = async (req, res) => {
  const sede = getSede(req);
  if (!sede) return res.status(401).json({ mensaje: 'Sin sede' });

  try {
    const { termino } = req.params;
    const { filtro } = req.query;

    const rows = await pacienteRepo.buscarPaciente(termino, filtro, sede);
    res.json(rows);
  } catch (error) {
    logger.error(error);
    res.status(500).json({ mensaje: 'Error al buscar paciente' });
  }
};

/**
 * Crea un nuevo paciente validando unicidad de cédula por sede.
 *
 * @param {import('express').Request} req - Petición HTTP
 * @param {import('express').Response} res - Respuesta HTTP
 * @returns {Promise<void>}
 */
const crearPaciente = async (req, res) => {
  const sede = getSede(req);
  if (!sede) return res.status(401).json({ mensaje: 'Sin sede' });

  try {
    const { cedula, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, fecha_nacimiento, telefono, status } = req.body;
    const pn = (primer_nombre || '').toString().toUpperCase().trim();
    const pa = (primer_apellido || '').toString().toUpperCase().trim();

    if (!cedula || !pn || !pa) {
      return res.status(400).json({ mensaje: 'Cédula, primer nombre y primer apellido son requeridos' });
    }

    const existing = await pacienteRepo.findByCedula(cedula, sede);
    if (existing) {
      return res.status(409).json({ mensaje: 'Ya existe un paciente con esa cédula en esta sede' });
    }

    const paciente = await pacienteRepo.crearPaciente({
      cedula,
      primer_nombre: pn,
      segundo_nombre: (segundo_nombre || '').toString().toUpperCase().trim() || null,
      primer_apellido: pa,
      segundo_apellido: (segundo_apellido || '').toString().toUpperCase().trim() || null,
      fecha_nacimiento: fecha_nacimiento || null,
      telefono,
      status,
      sede,
    });
    res.status(201).json(paciente);
  } catch (error) {
    logger.error(error);
    if (error.code === '23505') {
      return res.status(400).json({ mensaje: 'Ya existe un paciente con esa cédula' });
    }
    res.status(500).json({ mensaje: 'Error al crear paciente' });
  }
};

/**
 * Actualiza los datos de un paciente existente.
 *
 * @param {import('express').Request} req - Petición HTTP
 * @param {import('express').Response} res - Respuesta HTTP
 * @returns {Promise<void>}
 */
const actualizarPaciente = async (req, res) => {
  const sede = getSede(req);
  if (!sede) return res.status(401).json({ mensaje: 'Sin sede' });

  try {
    const { id } = req.params;
    const { cedula, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, fecha_nacimiento, telefono } = req.body;

    const paciente = await pacienteRepo.actualizarPaciente(id, sede, {
      cedula,
      primer_nombre: (primer_nombre || '').toString().toUpperCase().trim() || null,
      segundo_nombre: (segundo_nombre || '').toString().toUpperCase().trim() || null,
      primer_apellido: (primer_apellido || '').toString().toUpperCase().trim() || null,
      segundo_apellido: (segundo_apellido || '').toString().toUpperCase().trim() || null,
      fecha_nacimiento: fecha_nacimiento || null,
      telefono,
    });

    if (!paciente) {
      return res.status(404).json({ mensaje: 'Paciente no encontrado' });
    }

    res.json(paciente);
  } catch (error) {
    logger.error(error);
    if (error.code === '23505') {
      return res.status(400).json({ mensaje: 'Ya existe otro paciente con esa cédula' });
    }
    res.status(500).json({ mensaje: 'Error al actualizar paciente' });
  }
};

/**
 * Elimina un paciente de la base de datos.
 *
 * @param {import('express').Request} req - Petición HTTP
 * @param {import('express').Response} res - Respuesta HTTP
 * @returns {Promise<void>}
 */
const eliminarPaciente = async (req, res) => {
  const sede = getSede(req);
  if (!sede) return res.status(401).json({ mensaje: 'Sin sede' });

  try {
    const { id } = req.params;

    const atenciones = await atencionRepo.getAtencionesDePaciente(id, sede);
    const fueraDeRegistrado = atenciones.some((a) => Number(a.id_estado_actual) !== 1);
    if (fueraDeRegistrado) {
      return res.status(400).json({ mensaje: 'Solo se puede eliminar un paciente en estado Registrado' });
    }

    // Borrado en cascada dentro de la misma transacción: historial, atenciones
    // y paciente. Así los números de turno (p. ej. CONS-01) quedan libres y el
    // siguiente paciente los reutiliza.
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await historialRepo.deleteByPaciente(client, id, sede);
      await atencionRepo.eliminarAtencionesDePaciente(client, id, sede);
      const eliminado = await pacienteRepo.eliminarPaciente(id, sede, client);
      await client.query('COMMIT');

      if (!eliminado) {
        return res.status(404).json({ mensaje: 'Paciente no encontrado' });
      }

      res.json({ mensaje: 'Paciente eliminado' });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error(error);
    res.status(500).json({ mensaje: 'Error al eliminar paciente' });
  }
};

/**
 * Actualiza los datos de una atención existente. Solo permite cambiar
 * servicio, especialidad, médico y responsable si la atención está en
 * estado "Registrado"; de lo contrario solo permite cambios menores.
 *
 * @param {import('express').Request} req - Petición HTTP
 * @param {import('express').Response} res - Respuesta HTTP
 * @returns {Promise<void>}
 */
const actualizarAtencion = async (req, res) => {
  const sede = getSede(req);
  if (!sede) return res.status(401).json({ mensaje: 'Sin sede' });

  try {
    const { id } = req.params;
    const { id_servicio, id_responsable, id_cliente, id_especialidad, id_medico, id_consultorio } = req.body;

    if (id_especialidad) {
      const activa = await espRepo.esEspecialidadActiva(id_especialidad, sede);
      if (!activa) {
        return res.status(400).json({ mensaje: 'La especialidad seleccionada está inactiva' });
      }
    }

    if (id_servicio !== undefined) {
      const current = await atencionRepo.getAtencionEstado(id, sede);

      if (!current) {
        return res.status(404).json({ mensaje: 'Atención no encontrada' });
      }

      const estadoActual = current.id_estado_actual;

      if (estadoActual !== 1) {
        if (id_servicio !== current.id_servicio) {
          return res.status(400).json({
            mensaje: 'Solo se puede cambiar el servicio en estado Registrado',
          });
        }
        if (id_especialidad !== undefined && id_especialidad !== current.id_especialidad) {
          return res.status(400).json({
            mensaje: 'Solo se puede cambiar la especialidad en estado Registrado',
          });
        }
        if (id_medico !== undefined && id_medico !== current.id_medico) {
          return res.status(400).json({
            mensaje: 'Solo se puede cambiar el médico en estado Registrado',
          });
        }
        if (id_responsable !== undefined && id_responsable !== current.id_responsable) {
          return res.status(400).json({
            mensaje: 'Solo se puede cambiar el responsable de pago en estado Registrado',
          });
        }
      }

      await atencionRepo.actualizarAtencionConServicio(id, sede, { id_servicio, id_responsable, id_cliente, id_especialidad, id_medico, id_consultorio });
    } else {
      await atencionRepo.actualizarAtencionSimple(id, sede, { id_responsable, id_cliente, id_especialidad });
    }

    res.json({ mensaje: 'Atención actualizada' });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ mensaje: 'Error al actualizar atención' });
  }
};

/**
 * Elimina una atención y su historial asociado.
 *
 * @param {import('express').Request} req - Petición HTTP
 * @param {import('express').Response} res - Respuesta HTTP
 * @returns {Promise<void>}
 */
const eliminarAtencion = async (req, res) => {
  const sede = getSede(req);
  if (!sede) return res.status(401).json({ mensaje: 'Sin sede' });

  const { id } = req.params;

  const atencion = await atencionRepo.getAtencionEstado(id, sede);
  if (!atencion) {
    return res.status(404).json({ mensaje: 'Atención no encontrada' });
  }

  if (Number(atencion.id_estado_actual) !== 1) {
    return res.status(400).json({ mensaje: 'Solo se puede eliminar una atención en estado Registrado' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await historialRepo.deleteByAtencion(client, id);
    await atencionRepo.eliminarAtencion(client, id, sede);
    await client.query('COMMIT');
    res.json({ mensaje: 'Atención eliminada' });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error(error);
    res.status(500).json({ mensaje: 'Error al eliminar atención' });
  } finally {
    client.release();
  }
};

/**
 * Actualiza el estado de una atención a un nuevo estado.
 *
 * @param {import('express').Request} req - Petición HTTP
 * @param {import('express').Response} res - Respuesta HTTP
 * @returns {Promise<void>}
 */
const actualizarEstadoAtencion = async (req, res) => {
  const sede = getSede(req);
  if (!sede) return res.status(401).json({ mensaje: 'Sin sede' });

  try {
    const { id } = req.params;
    const { id_estado_nuevo } = req.body;
    const estadoNuevo = Number(id_estado_nuevo);

    const actual = await atencionRepo.getAtencionEstado(id, sede);
    if (!actual) {
      return res.status(404).json({ mensaje: 'Atención no encontrada' });
    }

    // Idempotente: si la atención ya está en ese estado, no se reinserta
    // historial ni se reemite el evento (evita duplicados por doble envío).
    if (Number(actual.id_estado_actual) === estadoNuevo) {
      return res.json({ mensaje: 'Estado actualizado', id_estado_actual: estadoNuevo });
    }

    const result = await atencionRepo.actualizarEstadoAtencion(id, sede, id_estado_nuevo);

    if (!result) {
      // Posible carrera: otro proceso ya cambió el estado; no duplicar historial.
      return res.json({ mensaje: 'Estado actualizado', id_estado_actual: estadoNuevo });
    }

    if (req.io) req.io.emit('estado-actualizado', { tipo: 'estado-cambiado', id_atencion: id, id_estado_nuevo, id_sede: sede });

    await historialRepo.insertSinTransaccion(id, id_estado_nuevo);

    res.json({ mensaje: 'Estado actualizado', id_estado_actual: id_estado_nuevo });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ mensaje: 'Error al actualizar estado de atención' });
  }
};

/**
 * Emite por Socket.IO el evento de anuncio de voz hacia el turnero.
 * Compartido por el primer llamado (paciente Registrado) y el segundo
 * llamado (paciente de aseguradora en Espera de Clave con clave aprobada):
 * ambos deben sonar AL INSTANTE y repetirse en cada pulsación del botón.
 *
 * Pre-sintetiza el audio con Piper y adjunta la URL de descarga en el
 * evento para que TODOS los turneros reproduzcan el mismo WAV
 * simultáneamente (sincronización perfecta).
 *
 * @param {object} io - Servidor Socket.IO (req.io)
 * @param {object} admision - Atención con datos del paciente
 * @param {number} sede - Identificador de la sede
 * @param {string} consultorio - Destino del llamado
 */
const emitirLlamadoNuevo = async (io, admision, sede, consultorio = 'APS', salaEspera = false) => {
  const ahoraServidor = Date.now();
  const payload = {
    tipo: 'llamado',
    id_atencion: Number(admision.id_atencion),
    turno: admision.numero,
    consultorio,
    paciente: admision.nombre,
    apellido: admision.apellido || '',
    id_sede: sede,
    server_now: ahoraServidor,
    inicio_ms: ahoraServidor,
    forzar: true,
  };

  // Pre-sintetizar audio con Piper para que todos los turneros reproduzcan
  // el mismo WAV al recibir el evento (sincronización perfecta entre pantallas).
  try {
    const nombreCompleto = [admision.nombre, admision.apellido].filter(Boolean).join(' ').trim();
    const nombreNatural = nombreCompleto.split(/\s+/).map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(' ');
    const consultorioLower = (consultorio || '').toLowerCase();
    let texto = `Paciente ${nombreNatural},`;
    if (consultorioLower.includes('laboratorio')) {
      texto += salaEspera ? ' diríjase a laboratorio' : ' diríjase a la recepción de laboratorio';
    } else if (consultorioLower.includes('imagen')) {
      texto += salaEspera ? ' diríjase a imágenes' : ' diríjase a la recepción de imágenes';
    } else if (consultorioLower === 'aps' || consultorioLower.includes('aps')) {
      texto += ' diríjase a la recepción de APS';
    } else {
      texto += ` diríjase al consultorio ${consultorio}`;
    }
    const nombreArchivo = `tts_${Date.now()}`;
    await ttsService.generarAudio(texto, nombreArchivo);
    payload.audio_url = `/api/tts/audio/${nombreArchivo}.wav`;
  } catch (err) {
    logger.warn(`TTS pre-síntesis falló (el turnero usará fallback): ${err.message}`);
  }

  io.emit('nuevo-llamado', payload);
};

/**
 * Llama por voz a un paciente hacia un módulo de destino (APS,
 * Laboratorio o Imágenes). Solo emite el anuncio (voz en el turnero) SIN
 * cambiar el estado actual de la atención. Se valida que la atención esté
 * en el estado esperado del flujo de ese módulo.
 *
 * @param {import('express').Request} req - Petición HTTP
 * @param {import('express').Response} res - Respuesta HTTP
 * @param {string} consultorio - Destino del anuncio ('APS' | 'LABORATORIO' | 'IMAGENES')
 * @param {number} estadoEsperado - Estado en que debe estar la atención
 * @param {string} mensajeEstado - Mensaje de error si no está en ese estado
 * @returns {Promise<void>}
 */
const llamarDestino = async (req, res, consultorio, estadoEsperado, mensajeEstado) => {
  const sede = getSede(req);
  if (!sede) return res.status(401).json({ mensaje: 'Sin sede' });

  try {
    const { id } = req.params;

    const admision = await atencionRepo.getAdmisionById(id, sede);
    if (!admision) {
      return res.status(404).json({ mensaje: 'Atención no encontrada' });
    }

    if (Number(admision.id_estado_actual) !== estadoEsperado) {
      return res.status(400).json({ mensaje: mensajeEstado });
    }

    if (req.io) {
      emitirLlamadoNuevo(req.io, admision, sede, consultorio);
    }

    res.json({
      mensaje: 'Paciente llamado correctamente',
      paciente: {
        id_atencion: Number(id),
        nombre: admision.nombre,
        apellido: admision.apellido || '',
      },
    });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ mensaje: 'Error al llamar paciente' });
  }
};

/**
 * Primer llamado hacia APS: paciente en estado "Registrado" (particulares
 * y aseguradoras).
 */
const llamarAPS = (req, res) =>
  llamarDestino(req, res, 'APS', 1, 'El paciente debe estar en estado Registrado para ser llamado');

/**
 * Segundo llamado hacia APS: paciente de aseguradora en estado "Espera de
 * Clave" (8) con clave aprobada, para confirmar antes de pasar a Sala de
 * Espera.
 */
const llamarClaveAPS = (req, res) =>
  llamarDestino(req, res, 'APS', 8, 'El paciente debe estar en estado Espera de Clave para ser llamado');

/**
 * Llamado hacia el módulo de Laboratorio: paciente particular en estado
 * "Registrado".
 */
const llamarLaboratorio = (req, res) =>
  llamarDestino(req, res, 'LABORATORIO', 1, 'El paciente debe estar en estado Registrado para ser llamado');

/**
 * Llamado hacia el módulo de Imágenes: paciente particular en estado
 * "Registrado".
 */
const llamarImagenes = (req, res) =>
  llamarDestino(req, res, 'IMAGENES', 1, 'El paciente debe estar en estado Registrado para ser llamado');

/**
 * Llamado por voz desde la tabla de SALA DE ESPERA en Laboratorio.
 * Acepta estado 3 (Sala de Espera) o 4 (LLAMADO).
 * Si es 3, cambia a 4. Si ya es 4, solo re-anuncia la voz.
 */
const llamarLaboratorioSalaEspera = async (req, res) => {
  const sede = getSede(req);
  if (!sede) return res.status(401).json({ mensaje: 'Sin sede' });

  try {
    const { id } = req.params;
    const admision = await atencionRepo.getAdmisionById(id, sede);
    if (!admision) {
      return res.status(404).json({ mensaje: 'Atención no encontrada' });
    }
    const estado = Number(admision.id_estado_actual);
    if (estado !== 3 && estado !== 4) {
      return res.status(400).json({ mensaje: 'El paciente debe estar en Sala de Espera o Llamado para ser llamado' });
    }

    // Si está en estado 3, cambiar a 4 (LLAMADO)
    if (estado === 3) {
      await atencionRepo.actualizarEstadoAtencion(id, sede, 4);
      if (req.io) {
        req.io.emit('estado-actualizado', { tipo: 'estado-cambiado', id_atencion: id, id_estado_nuevo: 4, id_sede: sede });
      }
      await historialRepo.insertSinTransaccion(id, 4);
    }

    // Emitir voz en el turnero (siempre, para re-anunciar)
    if (req.io) {
      await emitirLlamadoNuevo(req.io, admision, sede, 'LABORATORIO', true);
    }

    res.json({ mensaje: 'Paciente llamado correctamente' });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ mensaje: 'Error al llamar paciente' });
  }
};

/**
 * Llamado por voz desde la tabla de SALA DE ESPERA en Imágenes.
 * Acepta estado 3 (Sala de Espera) o 4 (LLAMADO).
 * Si es 3, cambia a 4. Si ya es 4, solo re-anuncia la voz.
 */
const llamarImagenesSalaEspera = async (req, res) => {
  const sede = getSede(req);
  if (!sede) return res.status(401).json({ mensaje: 'Sin sede' });

  try {
    const { id } = req.params;
    const admision = await atencionRepo.getAdmisionById(id, sede);
    if (!admision) {
      return res.status(404).json({ mensaje: 'Atención no encontrada' });
    }
    const estado = Number(admision.id_estado_actual);
    if (estado !== 3 && estado !== 4) {
      return res.status(400).json({ mensaje: 'El paciente debe estar en Sala de Espera o Llamado para ser llamado' });
    }

    // Si está en estado 3, cambiar a 4 (LLAMADO)
    if (estado === 3) {
      await atencionRepo.actualizarEstadoAtencion(id, sede, 4);
      if (req.io) {
        req.io.emit('estado-actualizado', { tipo: 'estado-cambiado', id_atencion: id, id_estado_nuevo: 4, id_sede: sede });
      }
      await historialRepo.insertSinTransaccion(id, 4);
    }

    // Emitir voz en el turnero (siempre, para re-anunciar)
    if (req.io) {      await emitirLlamadoNuevo(req.io, admision, sede, 'IMAGENES', true);
    }


    res.json({ mensaje: 'Paciente llamado correctamente' });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ mensaje: 'Error al llamar paciente' });
  }
};

/**
 * Genera un nuevo turno (atención) para un paciente y servicio dados.
 * El número de turno sale de una secuencia atómica por día (sede + servicio)
 * dentro de la misma transacción: es imposible que dos turnos repitan número.
 * Emite evento Socket.IO al crearlo.
 *
 * @param {import('express').Request} req - Petición HTTP
 * @param {import('express').Response} res - Respuesta HTTP
 * @returns {Promise<void>}
 */
const generarTurno = async (req, res) => {
  const sede = getSede(req);
  if (!sede) return res.status(401).json({ mensaje: 'Sin sede' });
  const usuarioId = req.usuario?.id;

  try {
    const { id_paciente, id_servicio, id_responsable, id_cliente, id_especialidad, id_medico, id_consultorio } = req.body;

    if (!id_paciente || !id_servicio) {
      return res.status(400).json({ mensaje: 'Paciente y servicio son requeridos' });
    }

    if (id_especialidad) {
      const activa = await espRepo.esEspecialidadActiva(id_especialidad, sede);
      if (!activa) {
        return res.status(400).json({ mensaje: 'La especialidad seleccionada está inactiva' });
      }
    }

    const prefijo = await atencionRepo.getServicioPrefijo(id_servicio);

    // Número de turno ATÓMICO: la secuencia por día (sede + servicio) se
    // incrementa dentro de la misma transacción del turno. Así es imposible
    // que dos turnos repitan número, incluso con registros simultáneos o
    // con atenciones borradas durante el día (el método anterior contaba
    // las atenciones del día y reciclaba números al borrarse alguna).
    const client = await pool.connect();
    let turno;
    try {
      await client.query('BEGIN');
      const siguiente = await atencionRepo.getSiguienteNumero(client, id_servicio, sede);
      const numero = `${prefijo}-${String(siguiente).padStart(2, '0')}`;
      turno = await atencionRepo.insertarAtencion({ id_paciente, id_servicio, id_responsable, sede, usuarioId, numero, id_cliente, id_especialidad, id_medico, id_consultorio }, client);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    if (req.io) {
      const admision = await atencionRepo.getAdmisionById(turno.id_atencion, sede);
      req.io.emit('estado-actualizado', { tipo: 'nuevo-turno', admision });
    }

    res.status(201).json(turno);
  } catch (error) {
    logger.error(error);
    res.status(500).json({ mensaje: 'Error al generar turno' });
  }
};

module.exports = {
  getResponsablesPago,
  getUltimasAdmisiones,
  buscarPaciente,
  crearPaciente,
  actualizarPaciente,
  eliminarPaciente,
  actualizarAtencion,
  eliminarAtencion,
  actualizarEstadoAtencion,
  generarTurno,
  marcarAusente,
  llamarAPS,
  llamarClaveAPS,
  llamarLaboratorio,
  llamarImagenes,
  llamarLaboratorioSalaEspera,
  llamarImagenesSalaEspera,
  marcarAusente7,
};
