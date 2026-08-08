const logger = require('../config/logger');
const atencionRepo = require('../repositories/atencion.repository');
const historialRepo = require('../repositories/historial.repository');

/**
 * Obtiene la lista de pacientes en espera para un servicio y
 * especialidad determinados dentro de la sede del médico.
 *
 * @param {import('express').Request} req - Petición HTTP
 * @param {import('express').Response} res - Respuesta HTTP
 * @returns {Promise<void>}
 */
const getPacientesEnEspera = async (req, res) => {
  const { id_servicio, id_especialidad } = req.query;

  try {
    const rows = await atencionRepo.getPacientesEnEspera(req.usuario?.id_sede, id_servicio, id_especialidad);
    res.json(rows);
  } catch (error) {
    logger.error('Error al obtener lista de espera:', error);
    res.status(500).json({ mensaje: 'Error al obtener lista de espera' });
  }
};

/**
 * Cambia el estado de una atención a "En Atencion" e inserta el
 * registro en el historial.
 *
 * @param {import('express').Request} req - Petición HTTP
 * @param {import('express').Response} res - Respuesta HTTP
 * @returns {Promise<void>}
 */
const llamarPaciente = async (req, res) => {
  const { id_atencion } = req.body;
  const pool = require('../config/db');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const estadoResult = await client.query(
      'SELECT id_estado FROM "Estado" WHERE nombre_estado = $1',
      ['En Atencion'],
    );

    const id_estado_nuevo = estadoResult.rows[0].id_estado;

    await client.query('UPDATE "Atencion" SET id_estado_actual = $1 WHERE id_atencion = $2', [
      id_estado_nuevo,
      id_atencion,
    ]);

    await historialRepo.insert(client, id_atencion, id_estado_nuevo);

    await client.query('COMMIT');

    if (req.io) req.io.emit('estado-actualizado', { tipo: 'estado-cambiado', id_atencion, id_estado_nuevo, id_sede: req.usuario?.id_sede });

    res.json({ mensaje: 'Paciente en atención', id_estado_nuevo });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ mensaje: 'Error al llamar paciente' });
  } finally {
    client.release();
  }
};

/**
 * Finaliza la atención de un paciente cambiando su estado a "Atendido"
 * y registrando la hora de salida.
 *
 * @param {import('express').Request} req - Petición HTTP
 * @param {import('express').Response} res - Respuesta HTTP
 * @returns {Promise<void>}
 */
const finalizarAtencion = async (req, res) => {
  const { id_atencion } = req.body;
  const pool = require('../config/db');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const estadoResult = await client.query(
      'SELECT id_estado FROM "Estado" WHERE nombre_estado = $1',
      ['Atendido'],
    );

    const id_estado_final = estadoResult.rows[0].id_estado;

    await client.query(
      'UPDATE "Atencion" SET id_estado_actual = $1, hora_salida = NOW() WHERE id_atencion = $2',
      [id_estado_final, id_atencion],
    );

    await historialRepo.insert(client, id_atencion, id_estado_final);

    await client.query('COMMIT');

    if (req.io) req.io.emit('estado-actualizado', { tipo: 'estado-cambiado', id_atencion, id_estado_nuevo: id_estado_final, id_sede: req.usuario?.id_sede });

    res.json({ mensaje: 'Atención finalizada' });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ mensaje: 'Error al finalizar atención' });
  } finally {
    client.release();
  }
};

/**
 * Obtiene los pacientes atendidos hoy para un servicio y especialidad
 * determinados dentro de la sede del médico.
 *
 * @param {import('express').Request} req - Petición HTTP
 * @param {import('express').Response} res - Respuesta HTTP
 * @returns {Promise<void>}
 */
const getAtendidosHoy = async (req, res) => {
  const { id_servicio, id_especialidad } = req.query;

  try {
    const rows = await atencionRepo.getAtendidosHoy(req.usuario?.id_sede, id_servicio, id_especialidad);
    res.json(rows);
  } catch (error) {
    logger.error('Error al obtener atendidos hoy:', error);
    res.status(500).json({ mensaje: 'Error al obtener pacientes atendidos' });
  }
};

module.exports = {
  getPacientesEnEspera,
  llamarPaciente,
  finalizarAtencion,
  getAtendidosHoy,
};
