const pool = require('../config/db');

/**
 * Obtiene el historial de atenciones (turnos) para la sede actual.
 */
const getTodosLosTurnos = async (req, res) => {
  try {
    const { consultorio_id } = req.query;
    let query = `
      SELECT 
        a.id_atencion as id, 
        a.numero, 
        e.nombre_estado as estado, 
        a.hora_llegada, 
        a.hora_salida as hora_fin,
        p.nombre as nombre_paciente, 
        p.cedula as documento_paciente, 
        p.telefono as telefono_paciente,
        s.nombre_servicio as servicio_nombre, 
        a.id_sede,
        a.id_consultorio as consultorio_id
      FROM "Atencion" a
      JOIN "Pacientes" p ON a.id_paciente = p.id_paciente
      JOIN "Servicio" s ON a.id_servicio = s.id_servicio
      JOIN "Estado" e ON a.id_estado_actual = e.id_estado
      WHERE a.id_sede = $1
    `;
    const params = [req.usuario.id_sede];

    if (consultorio_id) {
      query += ` AND a.id_consultorio = $2`;
      params.push(consultorio_id);
    }

    query += ` ORDER BY a.hora_llegada DESC LIMIT 100`;

    const result = await pool.query(query, params);
    
    // Mapeo para compatibilidad con frontend
    const turnos = result.rows.map(t => {
      let estadoFrontend = 'EN_ESPERA';
      const st = t.estado.toLowerCase();
      
      if (st === 'atendido') estadoFrontend = 'ATENDIDO';
      else if (st === 'cancelado') estadoFrontend = 'AUSENTE';
      else if (st === 'llamado') estadoFrontend = 'LLAMADO';
      else if (st === 'en atencion') estadoFrontend = 'EN_ATENCION';

      return {
        ...t,
        estado: estadoFrontend,
        paciente: {
          nombre: t.nombre_paciente,
          documento: t.documento_paciente,
          telefono: t.telefono_paciente
        }
      };
    });

    res.json(turnos);
  } catch (error) {
    console.error('Error en getTodosLosTurnos:', error);
    res.status(500).json({ mensaje: 'Error al obtener turnos' });
  }
};

/**
 * Crea una nueva atención (turno) generando un ticket secuencial.
 */
const crearTurno = async (req, res) => {
  const { nombre_paciente, documento_paciente, telefono_paciente, servicio_id } = req.body;

  if (!nombre_paciente || !documento_paciente || !servicio_id) {
    return res.status(400).json({ mensaje: 'Faltan datos requeridos' });
  }

  // Normalización
  const nombreMayus = (nombre_paciente || 'PACIENTE').toString().toUpperCase().trim();
  const documentoLimpio = (documento_paciente || '').toString().replace(/\D/g, '');
  const telefonoLimpio = telefono_paciente ? telefono_paciente.toString().replace(/\D/g, '') : null;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 0. Verificar si el sistema está cerrado
    const configRes = await client.query("SELECT valor FROM configuraciones WHERE clave = 'sistema_cerrado' FOR SHARE");
    if (configRes.rows.length > 0 && configRes.rows[0].valor === 'true') {
      await client.query('ROLLBACK');
      return res.status(403).json({ mensaje: 'El sistema está cerrado. No se pueden generar nuevos turnos.' });
    }

    // 1. Obtener/Crear Paciente
    let pacienteId;
    const pacRes = await client.query('SELECT id_paciente FROM "Pacientes" WHERE cedula = $1', [documentoLimpio]);
    
    if (pacRes.rows.length > 0) {
      pacienteId = pacRes.rows[0].id_paciente;
    } else {
      const newPac = await client.query(
        'INSERT INTO "Pacientes" (cedula, nombre, apellido, telefono, id_sede) VALUES ($1, $2, $3, $4, $5) RETURNING id_paciente',
        [documentoLimpio, nombreMayus, 'N/A', telefonoLimpio, req.usuario.id_sede]
      );
      pacienteId = newPac.rows[0].id_paciente;
    }

    // 2. Validar Servicio y Bloquear para Numeración
    const servicioRes = await client.query('SELECT * FROM "Servicio" WHERE id_servicio = $1 AND id_sede = $2 FOR UPDATE', [servicio_id, req.usuario.id_sede]);
    if (servicioRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ mensaje: 'Servicio no encontrado' });
    }
    const servicio = servicioRes.rows[0];

    // 3. Generar Número Secuencial
    const ultimoRes = await client.query(`
      SELECT numero FROM "Atencion" 
      WHERE id_servicio = $1 
      AND id_sede = $2
      AND DATE(hora_llegada) = CURRENT_DATE
      ORDER BY id_atencion DESC LIMIT 1
    `, [servicio_id, req.usuario.id_sede]);

    let siguiente = 1;
    if (ultimoRes.rows.length > 0 && ultimoRes.rows[0].numero) {
      const partes = ultimoRes.rows[0].numero.split('-');
      if (partes.length === 2) siguiente = parseInt(partes[1], 10) + 1;
    }
    const nuevoNumero = `${servicio.prefijo || 'TK'}-${siguiente.toString().padStart(3, '0')}`.replace(/\s/g, '');

    // 4. Registrar Atención (Estado: Sala de Espera = 2)
    const atencionRes = await client.query(`
      INSERT INTO "Atencion" (id_paciente, id_servicio, id_estado_actual, id_sede, id_usuario_registro, numero)
      VALUES ($1, $2, 2, $3, $4, $5)
      RETURNING id_atencion as id, numero, hora_llegada
    `, [pacienteId, servicio_id, req.usuario.id_sede, req.usuario.id, nuevoNumero]);

    const atencion = atencionRes.rows[0];

    // 5. Historial
    await client.query('INSERT INTO "Historial_Atencion" (id_atencion, id_estado) VALUES ($1, 2)', [atencion.id]);

    await client.query('COMMIT');

    if (req.io) {
      req.io.emit('nuevo-turno', { ...atencion, estado: 'EN_ESPERA' });
    }

    res.status(201).json(atencion);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al crear turno:', error);
    res.status(500).json({ mensaje: 'Error al procesar el turno' });
  } finally {
    client.release();
  }
};

/**
 * Marca a un paciente como ausente (Cancelado ID 6).
 */
const marcarAusente = async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const atencionRes = await client.query('SELECT id_consultorio FROM "Atencion" WHERE id_atencion = $1 FOR UPDATE', [id]);
    if (atencionRes.rows.length === 0) throw new Error('Atención no encontrada');
    
    const consultorioId = atencionRes.rows[0].id_consultorio;
    
    await client.query('UPDATE "Atencion" SET id_estado_actual = 6, hora_salida = NOW() WHERE id_atencion = $1', [id]);
    await client.query('INSERT INTO "Historial_Atencion" (id_atencion, id_estado) VALUES ($1, 6)', [id]);
    
    if (consultorioId) {
      await client.query("UPDATE \"Consultorios\" SET estado_fisico = 'LIBRE' WHERE id_consultorio = $1", [consultorioId]);
    }
    
    await client.query('COMMIT');
    res.json({ mensaje: 'Paciente marcado como ausente (Cancelado)' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error en marcarAusente:', error);
    res.status(500).json({ mensaje: error.message });
  } finally {
    client.release();
  }
};

/**
 * Transfiere a un paciente a otro servicio.
 * Finaliza la atención actual (Atendido) y crea una nueva.
 */
const transferirPaciente = async (req, res) => {
  const { id } = req.params;
  const { nuevo_servicio_id } = req.body;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    
    // 1. Finalizar atención actual (ID 5: Atendido)
    const currentRes = await client.query('SELECT * FROM "Atencion" WHERE id_atencion = $1 FOR UPDATE', [id]);
    if (currentRes.rows.length === 0) throw new Error('Atención no encontrada');
    const actual = currentRes.rows[0];

    await client.query('UPDATE "Atencion" SET id_estado_actual = 5, hora_salida = NOW() WHERE id_atencion = $1', [id]);
    
    if (actual.id_consultorio) {
      await client.query("UPDATE \"Consultorios\" SET estado_fisico = 'LIBRE' WHERE id_consultorio = $1", [actual.id_consultorio]);
    }

    // 2. Crear nueva atención en el servicio destino
    // El frontend hará el flujo de creación o nosotros lo automatizamos aquí
    // Para simplificar y seguir el plan, llamaremos a la lógica de creación
    
    // Bloquear nuevo servicio para numeración
    const servicioRes = await client.query('SELECT * FROM "Servicio" WHERE id_servicio = $1 FOR UPDATE', [nuevo_servicio_id]);
    if (servicioRes.rows.length === 0) throw new Error('Servicio destino no encontrado');
    const servicio = servicioRes.rows[0];

    const ultimoRes = await client.query(`
      SELECT numero FROM "Atencion" WHERE id_servicio = $1 AND DATE(hora_llegada) = CURRENT_DATE ORDER BY id_atencion DESC LIMIT 1
    `, [nuevo_servicio_id]);

    let siguiente = 1;
    if (ultimoRes.rows.length > 0 && ultimoRes.rows[0].numero) {
      const partes = ultimoRes.rows[0].numero.split('-');
      if (partes.length === 2) siguiente = parseInt(partes[1], 10) + 1;
    }
    const nuevoNumero = `${servicio.prefijo || 'TK'}-${siguiente.toString().padStart(3, '0')}`.replace(/\s/g, '');

    const newRes = await client.query(`
      INSERT INTO "Atencion" (id_paciente, id_servicio, id_estado_actual, id_sede, id_usuario_registro, numero)
      VALUES ($1, $2, 2, $3, $4, $5) RETURNING id_atencion as id, numero
    `, [actual.id_paciente, nuevo_servicio_id, req.usuario.id_sede, req.usuario.id, nuevoNumero]);

    await client.query('INSERT INTO "Historial_Atencion" (id_atencion, id_estado) VALUES ($1, 2)', [newRes.rows[0].id]);

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

// Placeholders para funciones eliminadas
const pausarAtencion = (req, res) => res.status(410).json({ mensaje: 'Funcionalidad deshabilitada' });
const reanudarAtencion = (req, res) => res.status(410).json({ mensaje: 'Funcionalidad deshabilitada' });

module.exports = {
  getTodosLosTurnos,
  crearTurno,
  marcarAusente,
  transferirPaciente,
  pausarAtencion,
  reanudarAtencion
};
