const pool = require('../config/db');
const logger = require('../config/logger');
const atencionRepo = require('../repositories/atencion.repository');
const consultorioRepo = require('../repositories/consultorio.repository');
const historialRepo = require('../repositories/historial.repository');

/**
 * Obtiene todos los turnos del día para la sede del usuario autenticado.
 *
 * @param {import('express').Request} req - Petición HTTP
 * @param {import('express').Response} res - Respuesta HTTP
 * @returns {Promise<void>}
 */
const getTodosLosTurnos = async (req, res) => {
  if (!req.usuario || !req.usuario.id_sede) {
    return res.status(400).json({ mensaje: 'Datos de usuario insuficientes' });
  }
  
  try {
    const rows = await atencionRepo.getTodosLosTurnos(req.usuario.id_sede);
    
    const turnos = rows.map(r => ({
      id: r.id,
      numero: r.numero,
      estado: r.estado,
      hora_llegada: r.hora_llegada,
      id_especialidad: r.id_especialidad,
      id_consultorio: r.id_consultorio,
      id_servicio: r.id_servicio,
      id_sede: r.id_sede,
      id_estado_actual: r.id_estado_actual,
      nombre_servicio: r.nombre_servicio,
      paciente: {
        nombre: r.paciente_nombre,
        apellido: r.paciente_apellido,
        documento: r.paciente_documento
      }
    }));
    
    res.json(turnos);
  } catch (error) {
    logger.error('Error en getTodosLosTurnos:', error);
    res.status(500).json({ mensaje: 'Error al obtener turnos' });
  }
};

/**
 * Crea un nuevo turno de forma manual. Calcula el número de turno
 * usando el prefijo del servicio y el conteo del día.
 *
 * @param {import('express').Request} req - Petición HTTP
 * @param {import('express').Response} res - Respuesta HTTP
 * @returns {Promise<void>}
 */
const crearTurno = async (req, res) => {
  const { id_paciente, id_servicio, id_especialidad, id_responsable } = req.body;
  
  if (!req.usuario || !req.usuario.id_sede) {
    return res.status(400).json({ mensaje: 'Datos de usuario insuficientes' });
  }
  
  try {
    const next = await atencionRepo.getConteoServicioHoy(id_servicio);
    const prefijo = await atencionRepo.getServicioPrefijo(id_servicio);
    const nuevoNumero = `${prefijo}-${String(next).padStart(2, '0')}`;

    const turno = await atencionRepo.insertarTurno({
      id_paciente, id_servicio, id_especialidad, id_responsable,
      id_sede: req.usuario.id_sede, numero: nuevoNumero,
    });
    res.status(201).json(turno);
  } catch (error) {
    logger.error('Error en crearTurno:', error);
    res.status(500).json({ mensaje: 'Error al crear turno' });
  }
};

/**
 * Marca un turno como ausente y libera el consultorio si corresponde.
 *
 * @param {import('express').Request} req - Petición HTTP
 * @param {import('express').Response} res - Respuesta HTTP
 * @returns {Promise<void>}
 */
const marcarAusente = async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const atencion = await atencionRepo.marcarAusente(client, id);
    
    if (!atencion) {
      await client.query('ROLLBACK');
      return res.status(404).json({ mensaje: 'Turno no encontrado' });
    }
    
    if (atencion.id_consultorio) {
      await consultorioRepo.setEstadoFisico(client, atencion.id_consultorio, 'LIBRE');
    }
    
    await historialRepo.insert(client, id, 7);
    
    await client.query('COMMIT');
    if (req.io) {
      const sede = req.usuario?.id_sede || 1;
      const admision = await atencionRepo.getAdmisionById(id, sede);
      req.io.emit('estado-actualizado', { tipo: 'retirado', admision });
    }
    res.json({ mensaje: 'Turno marcado como ausente' });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error en marcarAusente:', error);
    res.status(500).json({ mensaje: 'Error al marcar ausente' });
  } finally {
    client.release();
  }
};

/**
 * Reincorpora a un paciente previamente marcado como ausente,
 * devolviéndolo a Sala de Espera.
 *
 * @param {import('express').Request} req - Petición HTTP
 * @param {import('express').Response} res - Respuesta HTTP
 * @returns {Promise<void>}
 */
const reincorporarPaciente = async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await atencionRepo.reincorporarPaciente(client, id);

    if (!result) {
      await client.query('ROLLBACK');
      return res.status(404).json({ mensaje: 'Paciente no encontrado o no está en estado Ausente' });
    }

    await historialRepo.insert(client, id, 3);

    await client.query('COMMIT');
    if (req.io) req.io.emit('estado-actualizado', { id_atencion: Number(id) });
    res.json({ mensaje: 'Paciente reincorporado a Sala de Espera' });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error en reincorporarPaciente:', error);
    res.status(500).json({ mensaje: 'Error al reincorporar paciente' });
  } finally {
    client.release();
  }
};

module.exports = {
  getTodosLosTurnos,
  crearTurno,
  marcarAusente,
  reincorporarPaciente,
};
