const pool = require('../config/db');

const getSede = (req) => req.usuario?.id_sede;

// GET /recepcion/responsables-pago
const getResponsablesPago = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id_responsable, nombre, status FROM "Responsable_Pago" WHERE status = true ORDER BY id_responsable',
    );
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error al obtener responsables de pago' });
  }
};

// GET /recepcion/ultimas-admisiones
const getUltimasAdmisiones = async (req, res) => {
  const sede = getSede(req);
  if (!sede) return res.status(401).json({ mensaje: 'Sin sede' });

  try {
    const result = await pool.query(
      `SELECT
        a.id_atencion, a.numero,
        a.hora_llegada as fecha_creacion,
        a.hora_salida,
        a.id_estado_actual, a.id_servicio, a.id_paciente, a.id_especialidad,
        p.id_paciente, p.cedula, p.nombre, p.apellido, p.telefono,
        COALESCE(p.notificaciones_sms, true) as mensaje,
        s.nombre_servicio, s.prefijo,
        e.nombre_estado,
        rp.nombre as modalidad_pago,
        a.id_responsable
      FROM "Atencion" a
      JOIN "Pacientes" p ON a.id_paciente = p.id_paciente
      JOIN "Servicio" s ON a.id_servicio = s.id_servicio
      JOIN "Estado" e ON a.id_estado_actual = e.id_estado
      LEFT JOIN "Responsable_Pago" rp ON a.id_responsable = rp.id_responsable
      WHERE a.id_sede = $1 AND a.hora_llegada >= CURRENT_DATE
      ORDER BY a.hora_llegada DESC
      LIMIT 50`,
      [sede],
    );
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error al obtener últimas admisiones' });
  }
};

// GET /recepcion/pacientes/:cedula
const buscarPaciente = async (req, res) => {
  const sede = getSede(req);
  if (!sede) return res.status(401).json({ mensaje: 'Sin sede' });

  try {
    const { cedula } = req.params;
    const result = await pool.query(
      `SELECT id_paciente, cedula, nombre, apellido, telefono, notificaciones_sms, status, id_sede
       FROM "Pacientes"
       WHERE cedula ILIKE $1 AND id_sede = $2
       ORDER BY id_paciente DESC
       LIMIT 20`,
      [`%${cedula}%`, sede],
    );
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error al buscar paciente' });
  }
};

// POST /recepcion/pacientes
const crearPaciente = async (req, res) => {
  const sede = getSede(req);
  if (!sede) return res.status(401).json({ mensaje: 'Sin sede' });

  try {
    const { cedula, nombre, apellido, telefono, status, notificaciones_sms } = req.body;

    if (!cedula || !nombre || !apellido) {
      return res.status(400).json({ mensaje: 'Cédula, nombre y apellido son requeridos' });
    }

    const result = await pool.query(
      `INSERT INTO "Pacientes" (cedula, nombre, apellido, telefono, status, notificaciones_sms, id_sede)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id_paciente, cedula, nombre, apellido, telefono, status`,
      [cedula, nombre, apellido, telefono || null, status !== false, notificaciones_sms !== false, sede],
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    if (error.code === '23505') {
      return res.status(400).json({ mensaje: 'Ya existe un paciente con esa cédula' });
    }
    res.status(500).json({ mensaje: 'Error al crear paciente' });
  }
};

// PUT /recepcion/pacientes/:id
const actualizarPaciente = async (req, res) => {
  const sede = getSede(req);
  if (!sede) return res.status(401).json({ mensaje: 'Sin sede' });

  try {
    const { id } = req.params;
    const { cedula, nombre, apellido, telefono, notificaciones_sms } = req.body;

    const result = await pool.query(
      `UPDATE "Pacientes"
       SET cedula = COALESCE($1, cedula),
           nombre = COALESCE($2, nombre),
           apellido = COALESCE($3, apellido),
           telefono = COALESCE($4, telefono),
           notificaciones_sms = COALESCE($5, notificaciones_sms)
       WHERE id_paciente = $6 AND id_sede = $7
       RETURNING id_paciente, cedula, nombre, apellido, telefono`,
      [cedula, nombre, apellido, telefono, notificaciones_sms, id, sede],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ mensaje: 'Paciente no encontrado' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    if (error.code === '23505') {
      return res.status(400).json({ mensaje: 'Ya existe otro paciente con esa cédula' });
    }
    res.status(500).json({ mensaje: 'Error al actualizar paciente' });
  }
};

// DELETE /recepcion/pacientes/:id
const eliminarPaciente = async (req, res) => {
  const sede = getSede(req);
  if (!sede) return res.status(401).json({ mensaje: 'Sin sede' });

  try {
    const { id } = req.params;
    const result = await pool.query(
      'DELETE FROM "Pacientes" WHERE id_paciente = $1 AND id_sede = $2 RETURNING id_paciente',
      [id, sede],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ mensaje: 'Paciente no encontrado' });
    }

    res.json({ mensaje: 'Paciente eliminado' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error al eliminar paciente' });
  }
};

// PUT /recepcion/atencion/:id
const actualizarAtencion = async (req, res) => {
  const sede = getSede(req);
  if (!sede) return res.status(401).json({ mensaje: 'Sin sede' });

  try {
    const { id } = req.params;
    const { id_servicio, id_responsable, id_cliente, id_especialidad } = req.body;

    await pool.query(
      `UPDATE "Atencion"
       SET id_servicio = COALESCE($1, id_servicio),
           id_responsable = COALESCE($2, id_responsable),
           id_cliente = COALESCE($3, id_cliente),
           id_especialidad = COALESCE($4, id_especialidad)
       WHERE id_atencion = $5 AND id_sede = $6`,
      [id_servicio || null, id_responsable || null, id_cliente || null, id_especialidad || null, id, sede],
    );

    res.json({ mensaje: 'Atención actualizada' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error al actualizar atención' });
  }
};

// DELETE /recepcion/atencion/:id
const eliminarAtencion = async (req, res) => {
  const sede = getSede(req);
  if (!sede) return res.status(401).json({ mensaje: 'Sin sede' });

  try {
    const { id } = req.params;
    await pool.query('DELETE FROM "Atencion" WHERE id_atencion = $1 AND id_sede = $2', [id, sede]);
    res.json({ mensaje: 'Atención eliminada' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error al eliminar atención' });
  }
};

// PUT /recepcion/atencion/:id/estado
const actualizarEstadoAtencion = async (req, res) => {
  const sede = getSede(req);
  if (!sede) return res.status(401).json({ mensaje: 'Sin sede' });

  try {
    const { id } = req.params;
    const { id_estado_nuevo } = req.body;

    const result = await pool.query(
      `UPDATE "Atencion"
       SET id_estado_actual = $1
       WHERE id_atencion = $2 AND id_sede = $3
       RETURNING id_atencion, id_estado_actual`,
      [id_estado_nuevo, id, sede],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ mensaje: 'Atención no encontrada' });
    }

    // Emitir evento
    if (req.io) req.io.emit('estado-actualizado', { id_atencion: id });

    await pool.query(
      `INSERT INTO "Historial_Atencion" (id_atencion, id_estado) VALUES ($1, $2)`,
      [id, id_estado_nuevo],
    );

    res.json({ mensaje: 'Estado actualizado', id_estado_actual: id_estado_nuevo });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error al actualizar estado de atención' });
  }
};

// POST /recepcion/generar-turno
const generarTurno = async (req, res) => {
  const sede = getSede(req);
  if (!sede) return res.status(401).json({ mensaje: 'Sin sede' });
  const usuarioId = req.usuario?.id;

  try {
    const { id_paciente, id_servicio, id_responsable, id_cliente, id_especialidad } = req.body;

    if (!id_paciente || !id_servicio) {
      return res.status(400).json({ mensaje: 'Paciente y servicio son requeridos' });
    }

    // Obtener prefijo y contar atenciones de hoy
    const prefijoResult = await pool.query(
      `SELECT prefijo FROM "Servicio" WHERE id_servicio = $1`,
      [id_servicio],
    );
    const prefijo = prefijoResult.rows[0]?.prefijo || 'T';

    const countResult = await pool.query(
      `SELECT COUNT(*) + 1 as next FROM "Atencion"
       WHERE id_servicio = $1 AND hora_llegada >= CURRENT_DATE AND id_sede = $2`,
      [id_servicio, sede],
    );
    const numero = `${prefijo}-${String(countResult.rows[0].next).padStart(3, '0')}`;

    const result = await pool.query(
      `INSERT INTO "Atencion" (id_paciente, id_servicio, id_responsable, id_estado_actual, id_sede, id_usuario_registro, numero, id_cliente, id_especialidad)
       VALUES ($1, $2, $3, 1, $4, $5, $6, $7, $8)
       RETURNING id_atencion, numero, hora_llegada`,
      [id_paciente, id_servicio, id_responsable || null, sede, usuarioId || null, numero, id_cliente || null, id_especialidad || null],
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
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
};
