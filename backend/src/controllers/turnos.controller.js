const pool = require('../config/db');

const getTodosLosTurnos = async (req, res) => {
  try {
    const { consultorio_id } = req.query;
    let query = `
      SELECT t.*, s.nombre_servicio as servicio_nombre 
      FROM turnos t 
      LEFT JOIN "Servicio" s ON t.servicio_id = s.id_servicio
      WHERE t.id_sede = $1
    `;
    const params = [req.usuario.id_sede];

    if (consultorio_id) {
      query += ` AND t.consultorio_id = $2`;
      params.push(consultorio_id);
    }

    query += ` ORDER BY t.hora_llegada DESC LIMIT 100`;

    const result = await pool.query(query, params);
    
    // Mapeo para compatibilidad con frontend (paciente object)
    const turnos = result.rows.map(t => ({
      ...t,
      paciente: {
        nombre: t.nombre_paciente,
        documento: t.documento_paciente,
        telefono: t.telefono_paciente
      }
    }));

    res.json(turnos);
  } catch (error) {
    console.error('Error en getTodosLosTurnos:', error);
    res.status(500).json({ mensaje: 'Error al obtener turnos' });
  }
};

const crearTurno = async (req, res) => {
  const { nombre_paciente, documento_paciente, telefono_paciente, servicio_id, notificar } = req.body;

  if (!nombre_paciente || !documento_paciente || !servicio_id) {
    return res.status(400).json({ mensaje: 'Faltan datos requeridos' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 0. Verificar si el sistema está cerrado
    const configRes = await client.query("SELECT valor FROM configuraciones WHERE clave = 'sistema_cerrado' FOR SHARE");
    if (configRes.rows.length > 0 && configRes.rows[0].valor === 'true') {
      await client.query('ROLLBACK');
      return res.status(403).json({ mensaje: 'El sistema está cerrado. No se pueden generar nuevos turnos.' });
    }

    // 1. Validar que el servicio exista y BLOQUEARLO
    const servicioRes = await client.query('SELECT * FROM "Servicio" WHERE id_servicio = $1 AND id_sede = $2 FOR UPDATE', [servicio_id, req.usuario.id_sede]);
    if (servicioRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ mensaje: 'Servicio no encontrado' });
    }
    const servicio = servicioRes.rows[0];

    // 2. Validación anti-duplicado
    const dupRes = await client.query(`
      SELECT id FROM turnos 
      WHERE documento_paciente = $1 
      AND servicio_id = $2 
      AND id_sede = $3
      AND estado NOT IN ('ATENDIDO', 'AUSENTE')
    `, [documento_paciente, servicio_id, req.usuario.id_sede]);

    if (dupRes.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ mensaje: 'El paciente ya tiene un turno activo en este servicio' });
    }

    // 3. Generación de número secuencial (Ahora seguro dentro de la transacción y con FOR UPDATE en el servicio)
    const ultimoTurnoRes = await client.query(`
      SELECT numero FROM turnos 
      WHERE servicio_id = $1 
      AND id_sede = $2
      AND DATE(hora_llegada) = CURRENT_DATE
      ORDER BY id DESC LIMIT 1
    `, [servicio_id, req.usuario.id_sede]);

    let siguienteNumero = 1;
    if (ultimoTurnoRes.rows.length > 0) {
      const ultimoNumero = ultimoTurnoRes.rows[0].numero;
      const partes = ultimoNumero.split('-');
      if (partes.length === 2) {
        siguienteNumero = parseInt(partes[1], 10) + 1;
      }
    }

    const nuevoNumeroFormateado = `${servicio.prefijo}-${siguienteNumero.toString().padStart(3, '0')}`;

    // 4. Insertar nuevo turno
    const insertRes = await client.query(`
      INSERT INTO turnos (numero, estado, servicio_id, nombre_paciente, documento_paciente, telefono_paciente, id_sede)
      VALUES ($1, 'EN_ESPERA', $2, $3, $4, $5, $6)
      RETURNING id, numero, hora_llegada, id_sede
    `, [nuevoNumeroFormateado, servicio_id, nombre_paciente, documento_paciente, telefono_paciente, req.usuario.id_sede]);

    const turno = insertRes.rows[0];

    await client.query('COMMIT');

    // 5. Opcional: Integración para notificar (ej. SMS)
    if (notificar) {
      console.log(`[Simulación] SMS enviado al paciente ${nombre_paciente} al número ${telefono_paciente}`);
    }

    if (req.io) {
      req.io.emit('nuevo-turno', turno);
    }

    res.status(201).json(turno);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al crear turno:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  } finally {
    client.release();
  }
};

const pausarAtencion = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      "UPDATE turnos SET estado = 'EN_PAUSA' WHERE id = $1 AND estado = 'EN_ATENCION' AND id_sede = $2 RETURNING *",
      [id, req.usuario.id_sede]
    );
    if (result.rows.length === 0) return res.status(400).json({ mensaje: 'El turno no está en atención o no existe' });
    res.json({ mensaje: 'Atención pausada', turno: result.rows[0] });
  } catch (error) {
    console.error('Error en pausarAtencion:', error);
    res.status(500).json({ mensaje: 'Error interno' });
  }
};

const reanudarAtencion = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      "UPDATE turnos SET estado = 'EN_ATENCION' WHERE id = $1 AND estado = 'EN_PAUSA' AND id_sede = $2 RETURNING *",
      [id, req.usuario.id_sede]
    );
    if (result.rows.length === 0) return res.status(400).json({ mensaje: 'El turno no está en pausa o no existe' });
    res.json({ mensaje: 'Atención reanudada', turno: result.rows[0] });
  } catch (error) {
    console.error('Error en reanudarAtencion:', error);
    res.status(500).json({ mensaje: 'Error interno' });
  }
};

const transferirPaciente = async (req, res) => {
  const { id } = req.params;
  const { nuevo_servicio_id } = req.body;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    
    // 1. Obtener turno actual y BLOQUEARLO
    const currentRes = await client.query('SELECT * FROM turnos WHERE id = $1 FOR UPDATE', [id]);
    if (currentRes.rows.length === 0) throw new Error('Turno no encontrado');
    const turnoActual = currentRes.rows[0];

    // 2. Cerrar turno actual
    await client.query("UPDATE turnos SET estado = 'TRANSFERIDO', hora_fin = NOW() WHERE id = $1", [id]);

    // 3. Liberar consultorio actual
    if (turnoActual.consultorio_id) {
      await client.query("UPDATE \"Consultorios\" SET estado_fisico = 'LIBRE' WHERE id_consultorio = $1", [turnoActual.consultorio_id]);
    }

    // 4. Bloquear nuevo servicio para numeración segura
    const servicioRes = await client.query('SELECT * FROM "Servicio" WHERE id_servicio = $1 FOR UPDATE', [nuevo_servicio_id]);
    if (servicioRes.rows.length === 0) throw new Error('Servicio destino no encontrado');
    const servicio = servicioRes.rows[0];

    const ultimoTurnoRes = await client.query(`
      SELECT numero FROM turnos 
      WHERE servicio_id = $1 
      AND DATE(hora_llegada) = CURRENT_DATE
      ORDER BY id DESC LIMIT 1
    `, [nuevo_servicio_id]);

    let siguienteNumero = 1;
    if (ultimoTurnoRes.rows.length > 0) {
      const partes = ultimoTurnoRes.rows[0].numero.split('-');
      if (partes.length === 2) siguienteNumero = parseInt(partes[1], 10) + 1;
    }
    const nuevoNumero = `${servicio.prefijo}-${siguienteNumero.toString().padStart(3, '0')}`;

    // 5. Crear nuevo turno heredando la llegada original
    const newRes = await client.query(`
      INSERT INTO turnos (numero, estado, servicio_id, nombre_paciente, documento_paciente, telefono_paciente, hora_llegada)
      VALUES ($1, 'EN_ESPERA', $2, $3, $4, $5, $6) RETURNING id, numero
    `, [nuevoNumero, nuevo_servicio_id, turnoActual.nombre_paciente, turnoActual.documento_paciente, turnoActual.telefono_paciente, turnoActual.hora_llegada]);

    await client.query('COMMIT');
    res.json({ mensaje: 'Transferido exitosamente', nuevo_turno: newRes.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error en transferirPaciente:', error);
    res.status(500).json({ mensaje: error.message });
  } finally {
    client.release();
  }
};

const marcarAusente = async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const turnoRes = await client.query("SELECT consultorio_id FROM turnos WHERE id = $1 AND estado = 'LLAMADO' FOR UPDATE", [id]);
    if (turnoRes.rows.length === 0) throw new Error('Turno no encontrado o no está en estado LLAMADO');
    
    const consultorioId = turnoRes.rows[0].consultorio_id;
    
    await client.query("UPDATE turnos SET estado = 'AUSENTE', hora_fin = NOW() WHERE id = $1", [id]);
    
    if (consultorioId) {
      await client.query("UPDATE \"Consultorios\" SET estado_fisico = 'LIBRE' WHERE id_consultorio = $1", [consultorioId]);
    }
    
    await client.query('COMMIT');
    res.json({ mensaje: 'Paciente marcado como ausente' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error en marcarAusente:', error);
    res.status(500).json({ mensaje: error.message });
  } finally {
    client.release();
  }
};

module.exports = {
  getTodosLosTurnos,
  crearTurno,
  pausarAtencion,
  reanudarAtencion,
  transferirPaciente,
  marcarAusente
};
