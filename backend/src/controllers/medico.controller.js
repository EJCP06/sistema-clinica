const pool = require('../config/db');

const getPacientesEnEspera = async (req, res) => {
  const { id_servicio, id_especialidad } = req.query;

  try {
    let whereClause = 'WHERE a.id_sede = $1 AND a.hora_salida IS NULL';
    const params = [req.usuario?.id_sede];

    if (id_especialidad && id_especialidad !== 'null' && id_especialidad !== 'undefined') {
      whereClause += ` AND a.id_especialidad = $${params.length + 1}`;
      params.push(id_especialidad);
    } else if (id_servicio && id_servicio !== 'null' && id_servicio !== 'undefined') {
      whereClause += ` AND a.id_servicio = $${params.length + 1}`;
      params.push(id_servicio);
    }

    const result = await pool.query(
      `
      SELECT 
        a.id_atencion, 
        a.hora_llegada, 
        p.nombre, 
        p.apellido, 
        p.cedula, 
        e.nombre_estado, 
        s.nombre_servicio,
        a.id_estado_actual,
        a.id_especialidad,
        esp.nombre as nombre_especialidad
      FROM "Atencion" a
      INNER JOIN "Pacientes" p ON a.id_paciente = p.id_paciente
      INNER JOIN "Estado" e ON a.id_estado_actual = e.id_estado
      INNER JOIN "Servicio" s ON a.id_servicio = s.id_servicio
      LEFT JOIN "Especialidades" esp ON a.id_especialidad = esp.id_especialidad
      ${whereClause}
      AND UPPER(e.nombre_estado) IN ('SALA DE ESPERA')
      ORDER BY 
        a.hora_llegada ASC
    `,
      params,
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener lista de espera:', error);
    res.status(500).json({ mensaje: 'Error al obtener lista de espera' });
  }
};

const llamarPaciente = async (req, res) => {
  const { id_atencion } = req.body;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const estadoResult = await client.query(
      'SELECT id_estado FROM "Estado" WHERE nombre_estado = $1',
      ['En Atención'],
    );

    const id_estado_nuevo = estadoResult.rows[0].id_estado;

    await client.query('UPDATE "Atencion" SET id_estado_actual = $1 WHERE id_atencion = $2', [
      id_estado_nuevo,
      id_atencion,
    ]);

    await client.query(
      'INSERT INTO "Historial_Atencion" (id_atencion, id_estado) VALUES ($1, $2)',
      [id_atencion, id_estado_nuevo],
    );

    await client.query('COMMIT');

    if (req.io) req.io.emit('estado-actualizado', { id_atencion });

    res.json({ mensaje: 'Paciente en atención', id_estado_nuevo });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ mensaje: 'Error al llamar paciente' });
  } finally {
    client.release();
  }
};

const finalizarAtencion = async (req, res) => {
  const { id_atencion } = req.body;
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

    await client.query(
      'INSERT INTO "Historial_Atencion" (id_atencion, id_estado) VALUES ($1, $2)',
      [id_atencion, id_estado_final],
    );

    await client.query('COMMIT');

    if (req.io) req.io.emit('estado-actualizado', { id_atencion });

    res.json({ mensaje: 'Atención finalizada' });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ mensaje: 'Error al finalizar atención' });
  } finally {
    client.release();
  }
};

const getAtendidosHoy = async (req, res) => {
  const { id_servicio, id_especialidad } = req.query;

  try {
    let whereClause = 'WHERE a.hora_salida IS NOT NULL AND a.hora_salida::date = CURRENT_DATE AND a.id_sede = $1';
    const params = [req.usuario?.id_sede];

    if (id_especialidad && id_especialidad !== 'null' && id_especialidad !== 'undefined') {
      whereClause += ` AND a.id_especialidad = $${params.length + 1}`;
      params.push(id_especialidad);
    } else if (id_servicio && id_servicio !== 'null' && id_servicio !== 'undefined') {
      whereClause += ` AND a.id_servicio = $${params.length + 1}`;
      params.push(id_servicio);
    }

    const result = await pool.query(
      `
      SELECT 
        a.id_atencion, 
        a.hora_llegada, 
        a.hora_salida,
        p.nombre, 
        p.apellido, 
        p.cedula, 
        e.nombre_estado, 
        s.nombre_servicio,
        a.id_estado_actual,
        a.id_especialidad,
        esp.nombre as nombre_especialidad
      FROM "Atencion" a
      INNER JOIN "Pacientes" p ON a.id_paciente = p.id_paciente
      INNER JOIN "Estado" e ON a.id_estado_actual = e.id_estado
      INNER JOIN "Servicio" s ON a.id_servicio = s.id_servicio
      LEFT JOIN "Especialidades" esp ON a.id_especialidad = esp.id_especialidad
      ${whereClause}
      ORDER BY a.hora_salida DESC
      LIMIT 20
    `,
      params,
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener atendidos hoy:', error);
    res.status(500).json({ mensaje: 'Error al obtener pacientes atendidos' });
  }
};

module.exports = {
  getPacientesEnEspera,
  llamarPaciente,
  finalizarAtencion,
  getAtendidosHoy,
};
