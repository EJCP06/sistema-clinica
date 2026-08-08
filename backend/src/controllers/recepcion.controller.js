const logger = require('../config/logger');
const pacienteRepo = require('../repositories/paciente.repository');
const atencionRepo = require('../repositories/atencion.repository');
const sharedRepo = require('../repositories/shared.repository');
const historialRepo = require('../repositories/historial.repository');
const espRepo = require('../repositories/especialidad.repository');
const pool = require('../config/db');

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
    
    if (![2, 3, 7, 8].includes(idEstadoActual)) {
      return res.status(400).json({ mensaje: 'Solo se pueden retirar pacientes en estados válidos' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      const result = await atencionRepo.marcarAusente(client, id, 9);
      
      await client.query('COMMIT');
      
      if (req.io) {
        const admision = await atencionRepo.getAdmisionById(id, sede);
        req.io.emit('estado-actualizado', { tipo: 'retirado', id_atencion: Number(id), admision, id_sede: sede });
      }
      
      await historialRepo.insertSinTransaccion(id, 9);
      
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
    }
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
    const eliminado = await pacienteRepo.eliminarPaciente(id, sede);

    if (!eliminado) {
      return res.status(404).json({ mensaje: 'Paciente no encontrado' });
    }

    res.json({ mensaje: 'Paciente eliminado' });
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

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;
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

    const result = await atencionRepo.actualizarEstadoAtencion(id, sede, id_estado_nuevo);

    if (!result) {
      return res.status(404).json({ mensaje: 'Atención no encontrada' });
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
 * Genera un nuevo turno (atención) para un paciente y servicio dados.
 * Calcula el número de turno usando el prefijo del servicio y el
 * conteo del día. Emite evento Socket.IO al crearlo.
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

    const { prefijo, next } = await atencionRepo.getPrefijoYConteo(id_servicio, sede);
    const numero = `${prefijo}-${String(next).padStart(2, '0')}`;

    const turno = await atencionRepo.insertarAtencion({ id_paciente, id_servicio, id_responsable, sede, usuarioId, numero, id_cliente, id_especialidad, id_medico, id_consultorio });

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
};
