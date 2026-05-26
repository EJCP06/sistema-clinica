const pool = require('../config/db');

const getTodosLosTurnos = async (req, res) => {
  // Verificar que el usuario y su sede existan
  if (!req.usuario || !req.usuario.id_sede) {
    return res.status(400).json({ mensaje: 'Datos de usuario insuficientes' });
  }
  
  try {
    const result = await pool.query(`
      SELECT a.*, p.nombre, p.apellido, p.cedula, s.nombre_servicio, e.nombre_estado as estado, a.id_especialidad
      FROM "Atencion" a
      JOIN "Pacientes" p ON a.id_paciente = p.id_paciente
      JOIN "Servicio" s ON a.id_servicio = s.id_servicio
      JOIN "Estado" e ON a.id_estado_actual = e.id_estado
      WHERE a.id_sede = $1 AND a.hora_llegada >= CURRENT_DATE
      ORDER BY a.hora_llegada DESC
    `, [req.usuario.id_sede]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error en getTodosLosTurnos:', error);
    res.status(500).json({ mensaje: 'Error al obtener turnos' });
  }
};

const crearTurno = async (req, res) => {
  // Nota: recepcion.controller.js ya tiene generarTurno, pero implementamos este por compatibilidad
  const { id_paciente, id_servicio, id_especialidad, id_responsable } = req.body;
  
  // Verificar que el usuario y su sede existan
  if (!req.usuario || !req.usuario.id_sede) {
    return res.status(400).json({ mensaje: 'Datos de usuario insuficientes' });
  }
  
  try {
    // Obtener el siguiente número de turno para el servicio
    const countResult = await pool.query(
      'SELECT COUNT(*) + 1 as next FROM "Atencion" WHERE id_servicio = $1 AND hora_llegada >= CURRENT_DATE',
      [id_servicio]
    );
    
    // Obtener el prefijo del servicio
    const prefijoRes = await pool.query('SELECT prefijo FROM "Servicio" WHERE id_servicio = $1', [id_servicio]);
    const prefijo = prefijoRes.rows[0]?.prefijo || 'T';
    const nuevoNumero = `${prefijo}-${String(countResult.rows[0].next).padStart(3, '0')}`;
    
    const result = await pool.query(
      'INSERT INTO "Atencion" (id_paciente, id_servicio, id_especialidad, id_responsable, id_estado_actual, id_sede, numero) VALUES ($1, $2, $3, $4, 2, $5, $6) RETURNING *',
      [id_paciente, id_servicio, id_especialidad, id_responsable, req.usuario.id_sede, nuevoNumero]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error en crearTurno:', error);
    res.status(500).json({ mensaje: 'Error al crear turno' });
  }
};

const marcarAusente = async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Estado 6 = Ausente
    const result = await client.query(
      'UPDATE "Atencion" SET id_estado_actual = 6, hora_salida = NOW() WHERE id_atencion = $1 RETURNING id_consultorio',
      [id]
    );
    
    if (result.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ mensaje: 'Turno no encontrado' });
    }
    
    const consultorioId = result.rows[0].id_consultorio;
    if (consultorioId) {
      await client.query('UPDATE "Consultorios" SET estado_fisico = \'LIBRE\' WHERE id_consultorio = $1', [consultorioId]);
    }
    
    await client.query('INSERT INTO "Historial_Atencion" (id_atencion, id_estado) VALUES ($1, 6)', [id]);
    
    await client.query('COMMIT');
    res.json({ mensaje: 'Turno marcado como ausente' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error en marcarAusente:', error);
    res.status(500).json({ mensaje: 'Error al marcar ausente' });
  } finally {
    client.release();
  }
};

const transferirPaciente = async (req, res) => {
  const { id } = req.params;
  const { nuevo_servicio_id } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // 1. Finalizar atención actual
    const originalRes = await client.query(
      'UPDATE "Atencion" SET id_estado_actual = 5, hora_salida = NOW() WHERE id_atencion = $1 RETURNING *',
      [id]
    );
    
    if (originalRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ mensaje: 'Turno no encontrado' });
    }
    
    const original = originalRes.rows[0];
    
    // 2. Liberar consultorio si tenía uno
    if (original.id_consultorio) {
      await client.query('UPDATE "Consultorios" SET estado_fisico = \'LIBRE\' WHERE id_consultorio = $1', [original.id_consultorio]);
    }
    
    // 3. Crear nuevo turno en el nuevo servicio
    const countResult = await client.query(
      'SELECT COUNT(*) + 1 as next FROM "Atencion" WHERE id_servicio = $1 AND hora_llegada >= CURRENT_DATE',
      [nuevo_servicio_id]
    );
    const prefijoRes = await client.query('SELECT prefijo FROM "Servicio" WHERE id_servicio = $1', [nuevo_servicio_id]);
    const prefijo = prefijoRes.rows[0]?.prefijo || 'T';
    const nuevoNumero = `${prefijo}-${String(countResult.rows[0].next).padStart(3, '0')}`;
    
    const nuevoTurnoRes = await client.query(
      'INSERT INTO "Atencion" (id_paciente, id_servicio, id_responsable, id_estado_actual, id_sede, numero) VALUES ($1, $2, $3, 2, $4, $5) RETURNING *',
      [original.id_paciente, nuevo_servicio_id, original.id_responsable, original.id_sede, nuevoNumero]
    );
    
    await client.query('COMMIT');
    res.json({ mensaje: 'Paciente transferido con éxito', nuevo_turno: nuevoTurnoRes.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error en transferirPaciente:', error);
    res.status(500).json({ mensaje: 'Error al transferir paciente' });
  } finally {
    client.release();
  }
};

module.exports = {
  getTodosLosTurnos,
  crearTurno,
  marcarAusente,
  transferirPaciente,
};
