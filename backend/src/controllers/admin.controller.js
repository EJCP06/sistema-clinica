const pool = require('../config/db');
const bcrypt = require('bcryptjs');

/* =========================================================
   UTILIDAD SEGURA (EVITA 500 POR req.usuario UNDEFINED)
========================================================= */
const getSede = (req, res) => {
  const sede = req.usuario?.id_sede;
  if (!sede) {
    res.status(401).json({ mensaje: 'Token inválido o sin sede' });
    return null;
  }
  return sede;
};

/* =========================================================
   REPORTES
========================================================= */

const getReporteDiario = async (req, res) => {
  const sede = getSede(req, res);
  if (!sede) return;

  try {
    const result = await pool.query(
      `
      SELECT 
        a.id_atencion as id, 
        a.numero,
        e.nombre_estado as estado, 
        a.hora_llegada, 
        a.hora_salida as hora_fin,
        p.nombre as paciente_nombre, 
        p.cedula as paciente_documento, 
        p.telefono as paciente_telefono,
        s.nombre_servicio as servicio, 
        a.id_sede
      FROM "Atencion" a
      JOIN "Pacientes" p ON a.id_paciente = p.id_paciente
      JOIN "Servicio" s ON a.id_servicio = s.id_servicio
      JOIN "Estado" e ON a.id_estado_actual = e.id_estado
      WHERE a.hora_llegada >= CURRENT_DATE 
      AND a.hora_llegada < (CURRENT_DATE + interval '1 day')
      AND a.id_sede = $1
      ORDER BY a.hora_llegada DESC
    `,
      [sede],
    );

    const turnos = result.rows.map(r => ({
      id: r.id,
      numero: r.numero,
      estado: r.estado,
      hora_llegada: r.hora_llegada,
      hora_fin: r.hora_fin,
      servicio_nombre: r.servicio,
      id_sede: r.id_sede,
      paciente: {
        nombre: r.paciente_nombre,
        documento: r.paciente_documento,
        telefono: r.paciente_telefono,
      },
    }));

    // Calcular estadísticas por estado
    const atendidos = turnos.filter(t => t.estado === 'Atendido').length;
    const ausentes = turnos.filter(t => t.estado === 'Ausente').length;
    const enEspera = turnos.filter(t => t.estado === 'Sala de Espera' || t.estado === 'Llamado').length;

    res.json({
      total: turnos.length,
      turnos,
      estadisticas: {
        atendidos,
        ausentes,
        en_espera: enEspera,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error interno al generar el reporte diario' });
  }
};

const getEstadisticasAvanzadas = async (req, res) => {
  const sede = getSede(req, res);
  if (!sede) return;

  try {
    const tiemposPromedio = await pool.query(
      `
      SELECT 
        AVG(EXTRACT(EPOCH FROM (h2.fecha_hora - h1.fecha_hora))/60) as promedio_espera_min,
        AVG(EXTRACT(EPOCH FROM (a.hora_salida - a.hora_llegada))/60) as promedio_atencion_min
      FROM "Historial_Atencion" h1
      JOIN "Historial_Atencion" h2 ON h1.id_atencion = h2.id_atencion
      JOIN "Atencion" a ON h1.id_atencion = a.id_atencion
      WHERE a.id_sede = $1
    `,
      [sede],
    );

    res.json({
      estadisticas: tiemposPromedio.rows[0] || {},
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error al generar estadísticas' });
  }
};

const cerrarSistema = async (req, res) => {
  const sede = getSede(req, res);
  if (!sede) return;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await client.query(
      `UPDATE "Atencion"
       SET id_estado_actual = 6, hora_salida = NOW()
       WHERE id_estado_actual IN (2,3)
       AND id_sede = $1`,
      [sede],
    );

    await client.query(
      `UPDATE "Consultorios"
       SET estado_fisico = 'LIBRE'
       WHERE id_sede = $1`,
      [sede],
    );

    await client.query('COMMIT');

    res.json({ mensaje: 'Sistema cerrado exitosamente' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ mensaje: 'Error crítico al cerrar sistema' });
  } finally {
    client.release();
  }
};

/* =========================================================
   SERVICIOS
========================================================= */

const getServicios = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id_servicio as id, nombre_servicio as nombre, prefijo, status as activo
       FROM "Servicio"
       ORDER BY id_servicio`
    );

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error al obtener servicios' });
  }
};

const crearServicio = async (req, res) => {
  try {
    let { nombre, prefijo, piso, activo } = req.body;

    await pool.query(
      `INSERT INTO "Servicio" (nombre_servicio, prefijo, piso, status)
       VALUES ($1, $2, $3, $4)`,
      [nombre, prefijo || null, piso || null, activo !== false],
    );

    res.status(201).json({ mensaje: 'Servicio creado' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error al crear servicio' });
  }
};

const actualizarServicio = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, prefijo, piso, activo } = req.body;

    await pool.query(
      `UPDATE "Servicio"
       SET nombre_servicio = COALESCE($1, nombre_servicio),
           prefijo = COALESCE($2, prefijo),
           piso = COALESCE($3, piso),
           status = COALESCE($4, status)
       WHERE id_servicio = $5`,
      [nombre, prefijo || null, piso || null, activo !== undefined ? activo : null, id],
    );

    res.json({ mensaje: 'Servicio actualizado' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error al actualizar servicio' });
  }
};

const eliminarServicio = async (req, res) => {
  try {
    await pool.query(
      `DELETE FROM "Servicio"
       WHERE id_servicio = $1`,
      [req.params.id],
    );

    res.json({ mensaje: 'Servicio eliminado' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error al eliminar servicio' });
  }
};

/* =========================================================
   CONSULTORIOS
========================================================= */

const getConsultorios = async (req, res) => {
  const sede = getSede(req, res);
  if (!sede) return;

  try {
    const result = await pool.query(
      `SELECT id_consultorio as id, nombre, estado_fisico as estado, id_servicio as servicio_id
       FROM "Consultorios"
       WHERE id_sede = $1`,
      [sede],
    );

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error al obtener consultorios' });
  }
};

const crearConsultorio = async (req, res) => {
  const sede = getSede(req, res);
  if (!sede) return;

  try {
    const { nombre } = req.body;

    await pool.query(
      `INSERT INTO "Consultorios" (nombre, id_sede)
       VALUES ($1, $2)`,
      [nombre, sede],
    );

    res.json({ mensaje: 'Consultorio creado' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error al crear consultorio' });
  }
};

const actualizarConsultorio = async (req, res) => {
  const sede = getSede(req, res);
  if (!sede) return;

  try {
    const { id } = req.params;
    const { nombre } = req.body;

    await pool.query(
      `UPDATE "Consultorios"
       SET nombre = $1
       WHERE id_consultorio = $2 AND id_sede = $3`,
      [nombre, id, sede],
    );

    res.json({ mensaje: 'Consultorio actualizado' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error al actualizar consultorio' });
  }
};

const eliminarConsultorio = async (req, res) => {
  const sede = getSede(req, res);
  if (!sede) return;

  try {
    await pool.query(
      `DELETE FROM "Consultorios"
       WHERE id_consultorio = $1 AND id_sede = $2`,
      [req.params.id, sede],
    );

    res.json({ mensaje: 'Consultorio eliminado' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error al eliminar consultorio' });
  }
};

/* =========================================================
   EXPORT
========================================================= */

/* =========================================================
   SEDES
========================================================= */

const getSedes = async (req, res) => {
  const sede = getSede(req, res);
  if (!sede) return;

  try {
    const result = await pool.query(
      `SELECT id_sede, nombre FROM "Sedes" ORDER BY id_sede`,
    );
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error al obtener sedes' });
  }
};

/* =========================================================
   PERSONAL
========================================================= */

const getPersonal = async (req, res) => {
  const sede = getSede(req, res);
  if (!sede) return;

  try {
    const result = await pool.query(
      `SELECT
        u.id_usuario,
        u.cedula,
        u.rol,
        u.nombre,
        u.apellido,
        u.telefono,
        u.piso,
        u.id_consultorio,
        u.id_servicio,
        u.id_especialidad,
        u.id_sede,
        u.status,
        u.fecha_creacion,
        c.nombre AS consultorio_nombre,
        s.nombre_servicio AS servicio_nombre
      FROM "Usuarios" u
      LEFT JOIN "Consultorios" c ON u.id_consultorio = c.id_consultorio
      LEFT JOIN "Servicio" s ON u.id_servicio = s.id_servicio
      WHERE u.id_sede = $1
      ORDER BY u.nombre, u.apellido`,
      [sede],
    );

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error al obtener personal' });
  }
};

const crearPersonal = async (req, res) => {
  const sedeToken = getSede(req, res);
  if (!sedeToken) return;

  try {
    const { cedula, nombre, apellido, telefono, password, rol, piso, id_consultorio, id_servicio, id_especialidad, username, status, id_sede } = req.body;

    if (!cedula || !nombre || !rol) {
      return res.status(400).json({ mensaje: 'Cédula, nombre y rol son requeridos' });
    }

    const password_hash = password ? await bcrypt.hash(password, 10) : await bcrypt.hash(cedula, 10);
    const sedeFinal = id_sede ? Number(id_sede) : sedeToken;

    const result = await pool.query(
      `INSERT INTO "Usuarios" (cedula, nombre, apellido, telefono, password_hash, rol, piso, id_consultorio, id_servicio, id_especialidad, id_sede, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id_usuario`,
      [cedula, nombre, apellido || '', telefono || '', password_hash, rol, piso || null, id_consultorio || null, id_servicio || null, id_especialidad || null, sedeFinal, status !== false],
    );

    res.status(201).json({ mensaje: 'Personal creado', id: result.rows[0].id_usuario });
  } catch (error) {
    console.error(error);
    if (error.code === '23505') {
      return res.status(400).json({ mensaje: 'Ya existe un usuario con esa cédula' });
    }
    res.status(500).json({ mensaje: 'Error al crear personal' });
  }
};

const actualizarPersonal = async (req, res) => {
  const sede = getSede(req, res);
  if (!sede) return;

  try {
    const { id } = req.params;
    const { cedula, nombre, apellido, telefono, password, rol, piso, id_consultorio, id_servicio, id_especialidad, status, id_sede } = req.body;

    const sets = [];
    const values = [];
    let idx = 1;

    if (cedula !== undefined) { sets.push(`cedula = $${idx++}`); values.push(cedula); }
    if (nombre !== undefined) { sets.push(`nombre = $${idx++}`); values.push(nombre); }
    if (apellido !== undefined) { sets.push(`apellido = $${idx++}`); values.push(apellido); }
    if (telefono !== undefined) { sets.push(`telefono = $${idx++}`); values.push(telefono); }
    if (password) { sets.push(`password_hash = $${idx++}`); values.push(await bcrypt.hash(password, 10)); }
    if (rol !== undefined) { sets.push(`rol = $${idx++}`); values.push(rol); }
    if (piso !== undefined) { sets.push(`piso = $${idx++}`); values.push(piso); }
    if (id_consultorio !== undefined) { sets.push(`id_consultorio = $${idx++}`); values.push(id_consultorio); }
    if (id_servicio !== undefined) { sets.push(`id_servicio = $${idx++}`); values.push(id_servicio); }
    if (id_especialidad !== undefined) { sets.push(`id_especialidad = $${idx++}`); values.push(id_especialidad); }
    if (id_sede !== undefined) { sets.push(`id_sede = $${idx++}`); values.push(Number(id_sede)); }
    if (status !== undefined) { sets.push(`status = $${idx++}`); values.push(status); }

    if (sets.length === 0) {
      return res.status(400).json({ mensaje: 'No hay campos para actualizar' });
    }

    values.push(id, sede);
    await pool.query(
      `UPDATE "Usuarios" SET ${sets.join(', ')} WHERE id_usuario = $${idx} AND id_sede = $${idx + 1}`,
      values,
    );

    res.json({ mensaje: 'Personal actualizado' });
  } catch (error) {
    console.error(error);
    if (error.code === '23505') {
      return res.status(400).json({ mensaje: 'Ya existe un usuario con esa cédula' });
    }
    res.status(500).json({ mensaje: 'Error al actualizar personal' });
  }
};

const eliminarPersonal = async (req, res) => {
  const sede = getSede(req, res);
  if (!sede) return;

  try {
    const { id } = req.params;

    const result = await pool.query(
      `DELETE FROM "Usuarios" WHERE id_usuario = $1 AND id_sede = $2 RETURNING id_usuario`,
      [id, sede],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }

    res.json({ mensaje: 'Personal eliminado' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error al eliminar personal' });
  }
};

module.exports = {
  getReporteDiario,
  getEstadisticasAvanzadas,
  cerrarSistema,

  getServicios,
  crearServicio,
  actualizarServicio,
  eliminarServicio,

  getConsultorios,
  crearConsultorio,
  actualizarConsultorio,
  eliminarConsultorio,

  getSedes,
  getPersonal,
  crearPersonal,
  actualizarPersonal,
  eliminarPersonal,
};
