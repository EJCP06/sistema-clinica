const pool = require('../config/db');

const obtenerMiEstado = async (req, res) => {
  const consultorioId = req.usuario.consultorio_id;
  if (!consultorioId) {
    return res.status(400).json({ mensaje: 'No tiene consultorio asignado' });
  }

  try {
    const result = await pool.query(`
      SELECT 
        c.estado_fisico as estado, 
        c.id_servicio as servicio_id, 
        c.nombre, 
        s.nombre_servicio as servicio_nombre,
        a.id_atencion as turno_id,
        'N/A' as turno_numero,
        CASE 
          WHEN e.nombre_estado = 'En Atención' THEN 'EN_ATENCION'
          WHEN e.nombre_estado = 'Llamado' THEN 'LLAMADO'
          ELSE UPPER(e.nombre_estado)
        END as turno_estado,
        p.nombre as nombre_paciente,
        p.cedula as documento_paciente,
        a.hora_llegada as turno_hora_llegada
      FROM "Consultorios" c
      LEFT JOIN "Servicio" s ON c.id_servicio = s.id_servicio
      LEFT JOIN "Atencion" a ON a.id_consultorio = c.id_consultorio AND a.id_estado_actual IN (3, 4)
      LEFT JOIN "Estado" e ON a.id_estado_actual = e.id_estado
      LEFT JOIN "Pacientes" p ON a.id_paciente = p.id_paciente
      WHERE c.id_consultorio = $1
      ORDER BY a.id_atencion DESC
      LIMIT 1
    `, [consultorioId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ mensaje: 'Consultorio no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error en obtenerMiEstado:', error);
    res.status(500).json({ mensaje: 'Error al obtener estado del consultorio' });
  }
};

const llamarSiguiente = async (req, res) => {
  const consultorioId = req.usuario.consultorio_id;
  if (!consultorioId) return res.status(400).json({ mensaje: 'Usuario sin consultorio' });

  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    
    // 1. Obtener consultorio y BLOQUEARLO
    const consultorioRes = await client.query('SELECT estado_fisico as estado, id_servicio as servicio_id, nombre FROM "Consultorios" WHERE id_consultorio = $1 FOR UPDATE', [consultorioId]);
    if (consultorioRes.rows.length === 0) throw new Error('Consultorio no encontrado');
    
    const consultorio = consultorioRes.rows[0];
    if (consultorio.estado !== 'LIBRE') {
      await client.query('ROLLBACK');
      return res.status(400).json({ mensaje: 'El consultorio debe estar LIBRE para llamar' });
    }

    // 2. Buscar paciente en espera (estado_actual = 2)
    const turnoRes = await client.query(`
      SELECT a.id_atencion as id, 'N/A' as numero, e.nombre_estado as estado, p.nombre as nombre_paciente, p.cedula as documento_paciente, p.telefono as telefono_paciente, a.hora_llegada
      FROM "Atencion" a
      JOIN "Pacientes" p ON a.id_paciente = p.id_paciente
      JOIN "Estado" e ON a.id_estado_actual = e.id_estado
      WHERE a.id_servicio = $1 AND a.id_estado_actual = 2 AND a.id_sede = $2
      ORDER BY a.hora_llegada ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    `, [consultorio.servicio_id, req.usuario.id_sede]);

    if (turnoRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ mensaje: 'No hay pacientes en espera en este servicio' });
    }

    const turno = turnoRes.rows[0];

    // 3. Actualizar Atencion (estado 3 = Llamado)
    await client.query(
      "UPDATE \"Atencion\" SET id_estado_actual = 3, id_consultorio = $1 WHERE id_atencion = $2",
      [consultorioId, turno.id]
    );

    await client.query(
      "INSERT INTO \"Historial_Atencion\" (id_atencion, id_estado) VALUES ($1, 3)",
      [turno.id]
    );

    await client.query(
      "UPDATE \"Consultorios\" SET estado_fisico = 'OCUPADO' WHERE id_consultorio = $1",
      [consultorioId]
    );

    await client.query('COMMIT');

    // 4. Emitir evento por socket
    if (req.io) {
      req.io.emit('nuevo-llamado', { 
        turno: turno.numero, 
        consultorio: consultorio.nombre,
        paciente: turno.nombre_paciente,
        id_sede: req.usuario.id_sede
      });
    }

    res.json({
      mensaje: 'Paciente llamado exitosamente',
      turno: {
        id: turno.id,
        numero: turno.numero,
        estado: 'LLAMADO',
        hora_llegada: turno.hora_llegada,
        paciente: {
          nombre: turno.nombre_paciente,
          documento: turno.documento_paciente,
          telefono: turno.telefono_paciente
        }
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error en llamarSiguiente:', error);
    res.status(500).json({ mensaje: error.message || 'Error al procesar el llamado' });
  } finally {
    client.release();
  }
};

const iniciarAtencion = async (req, res) => {
  const consultorioId = req.usuario.consultorio_id;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await pool.query(
      "UPDATE \"Atencion\" SET id_estado_actual = 4 WHERE id_consultorio = $1 AND id_estado_actual = 3 RETURNING *",
      [consultorioId]
    );
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ mensaje: 'No hay paciente llamado esperando para iniciar atención' });
    }
    
    await client.query(
      "INSERT INTO \"Historial_Atencion\" (id_atencion, id_estado) VALUES ($1, 4)",
      [result.rows[0].id_atencion]
    );
    
    await client.query('COMMIT');
    res.json({ mensaje: 'Atención iniciada correctamente', turno: 'N/A' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error en iniciarAtencion:', error);
    res.status(500).json({ mensaje: 'Error al iniciar atención' });
  } finally {
    client.release();
  }
};

const finalizarAtencion = async (req, res) => {
  const consultorioId = req.usuario.consultorio_id;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Finalizar Atencion (estado 5 = Atendido)
    const turnoRes = await client.query(
      "UPDATE \"Atencion\" SET id_estado_actual = 5, hora_salida = NOW() WHERE id_consultorio = $1 AND id_estado_actual = 4 RETURNING id_atencion",
      [consultorioId]
    );
    
    if (turnoRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ mensaje: 'No hay ninguna atención activa para finalizar' });
    }

    await client.query(
      "INSERT INTO \"Historial_Atencion\" (id_atencion, id_estado) VALUES ($1, 5)",
      [turnoRes.rows[0].id_atencion]
    );

    // Liberar consultorio
    await client.query("UPDATE \"Consultorios\" SET estado_fisico = 'LIBRE' WHERE id_consultorio = $1", [consultorioId]);

    await client.query('COMMIT');
    res.json({ mensaje: 'Atención finalizada y consultorio liberado' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error en finalizarAtencion:', error);
    res.status(500).json({ mensaje: error.message || 'Error al finalizar atención' });
  } finally {
    client.release();
  }
};

const pausarConsultorio = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query("UPDATE \"Consultorios\" SET estado_fisico = 'EN_DESCANSO' WHERE id_consultorio = $1", [id]);
    res.json({ mensaje: 'El consultorio ha pasado a estado de descanso' });
  } catch (error) {
    console.error('Error en pausarConsultorio:', error);
    res.status(500).json({ mensaje: 'Error al poner consultorio en descanso' });
  }
};

const reanudarConsultorio = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query("UPDATE \"Consultorios\" SET estado_fisico = 'LIBRE' WHERE id_consultorio = $1", [id]);
    res.json({ mensaje: 'Consultorio reanudado y disponible (LIBRE)' });
  } catch (error) {
    console.error('Error en reanudarConsultorio:', error);
    res.status(500).json({ mensaje: 'Error al reanudar consultorio' });
  }
};

module.exports = {
  obtenerMiEstado,
  llamarSiguiente,
  iniciarAtencion,
  finalizarAtencion,
  pausarConsultorio,
  reanudarConsultorio
};
