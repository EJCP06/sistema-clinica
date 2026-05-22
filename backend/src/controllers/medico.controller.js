const pool = require('../config/db');

const getPacientesEnEspera = async (req, res) => {
  const { id_servicio } = req.query;

  try {
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
        a.id_estado_actual
      FROM "Atencion" a
      INNER JOIN "Pacientes" p ON a.id_paciente = p.id_paciente
      INNER JOIN "Estado" e ON a.id_estado_actual = e.id_estado
      INNER JOIN "Servicio" s ON a.id_servicio = s.id_servicio
      WHERE a.id_servicio = $1 
      AND a.id_sede = $2
      AND a.hora_salida IS NULL
      AND e.nombre_estado IN ('Sala de Espera', 'Llamado', 'En Atención')
      ORDER BY 
        CASE WHEN e.nombre_estado = 'En Atención' THEN 0 ELSE 1 END,
        a.hora_llegada ASC
    `,
      [id_servicio, req.usuario?.id_sede],
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

    res.json({ mensaje: 'Atención finalizada' });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ mensaje: 'Error al finalizar atención' });
  } finally {
    client.release();
  }
};

module.exports = {
  getPacientesEnEspera,
  llamarPaciente,
  finalizarAtencion,
};
