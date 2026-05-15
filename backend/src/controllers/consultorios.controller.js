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
        t.id as turno_id,
        t.numero as turno_numero,
        t.estado as turno_estado,
        t.nombre_paciente,
        t.documento_paciente,
        t.hora_llegada as turno_hora_llegada
      FROM "Consultorios" c
      LEFT JOIN "Servicio" s ON c.id_servicio = s.id_servicio
      LEFT JOIN turnos t ON t.consultorio_id = c.id_consultorio AND t.estado IN ('LLAMADO', 'EN_ATENCION', 'EN_PAUSA')
      WHERE c.id_consultorio = $1
      ORDER BY t.id DESC
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
    
    // 1. Obtener consultorio y BLOQUEARLO para evitar llamados duplicados
    const consultorioRes = await client.query('SELECT estado_fisico as estado, id_servicio as servicio_id, nombre FROM "Consultorios" WHERE id_consultorio = $1 FOR UPDATE', [consultorioId]);
    if (consultorioRes.rows.length === 0) throw new Error('Consultorio no encontrado');
    
    const consultorio = consultorioRes.rows[0];
    if (consultorio.estado !== 'LIBRE') {
      await client.query('ROLLBACK');
      return res.status(400).json({ mensaje: 'El consultorio debe estar LIBRE para llamar' });
    }

    // 2. Buscar paciente en espera usando SKIP LOCKED para alta concurrencia
    const turnoRes = await client.query(`
      SELECT id, numero, estado, nombre_paciente, documento_paciente, telefono_paciente, hora_llegada
      FROM turnos
      WHERE servicio_id = $1 AND estado = 'EN_ESPERA' AND id_sede = $2
      ORDER BY hora_llegada ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    `, [consultorio.servicio_id, req.usuario.id_sede]);

    if (turnoRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ mensaje: 'No hay pacientes en espera en este servicio' });
    }

    const turno = turnoRes.rows[0];

    // 3. Actualizar turno y consultorio
    await client.query(
      "UPDATE turnos SET estado = 'LLAMADO', consultorio_id = $1, hora_llamado = NOW() WHERE id = $2",
      [consultorioId, turno.id]
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
  try {
    const result = await pool.query(
      "UPDATE turnos SET estado = 'EN_ATENCION', hora_inicio = NOW() WHERE consultorio_id = $1 AND estado = 'LLAMADO' RETURNING *",
      [consultorioId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ mensaje: 'No hay turno llamado esperando para iniciar atención' });
    }
    res.json({ mensaje: 'Atención iniciada correctamente', turno: result.rows[0].numero });
  } catch (error) {
    console.error('Error en iniciarAtencion:', error);
    res.status(500).json({ mensaje: 'Error al iniciar atención' });
  }
};

const finalizarAtencion = async (req, res) => {
  const consultorioId = req.usuario.consultorio_id;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Finalizar turno
    const turnoRes = await client.query(
      "UPDATE turnos SET estado = 'ATENDIDO', hora_fin = NOW() WHERE consultorio_id = $1 AND estado = 'EN_ATENCION' RETURNING id",
      [consultorioId]
    );
    
    if (turnoRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ mensaje: 'No hay ningún turno activo en atención para finalizar' });
    }

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
