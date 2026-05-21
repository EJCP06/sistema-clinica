const pool = require('../config/db');
const bcrypt = require('bcryptjs');

// --- REPORTES Y CIERRE DE SISTEMA ---

const getReporteDiario = async (req, res) => {
  try {
    const result = await pool.query(`
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
    `, [req.usuario.id_sede]);

    let atendidos = 0;
    let ausentes = 0;
    let transferidos = 0;
    let en_espera = 0;
    let tiempoEsperaTotal = 0;
    let tiempoAtencionTotal = 0;

    const turnosProcesados = result.rows.map((t) => {
      let estadoFrontend = 'EN_ESPERA';
      const st = t.estado.toLowerCase();
      
      if (st === 'atendido') {
        estadoFrontend = 'ATENDIDO';
        atendidos++;
      } else if (st === 'cancelado') {
        estadoFrontend = 'AUSENTE';
        ausentes++;
      } else if (st === 'llamado') {
        estadoFrontend = 'LLAMADO';
        en_espera++;
      } else if (st === 'en atencion') {
        estadoFrontend = 'EN_ATENCION';
        en_espera++;
      } else {
        en_espera++;
      }

      return {
        ...t,
        estado: estadoFrontend,
        paciente: {
          nombre: t.paciente_nombre,
          documento: t.paciente_documento || 'N/D',
          telefono: t.paciente_telefono || 'N/D',
        },
      };
    });

    const promedios = {
      esperaMinutos: atendidos > 0 ? (tiempoEsperaTotal / atendidos / 60000).toFixed(2) : '0.00',
      atencionMinutos: atendidos > 0 ? (tiempoAtencionTotal / atendidos / 60000).toFixed(2) : '0.00',
    };

    res.json({
      total: result.rows.length,
      turnos: turnosProcesados,
      estadisticas: { atendidos, ausentes, transferidos, en_espera },
      promedios,
    });
  } catch (error) {
    console.error('Error en getReporteDiario:', error);
    res.status(500).json({ mensaje: 'Error interno al generar el reporte diario' });
  }
};

const getEstadisticasAvanzadas = async (req, res) => {
  try {
    const tiemposPromedio = await pool.query(
      `
      SELECT 
        AVG(EXTRACT(EPOCH FROM (h2.fecha_hora - h1.fecha_hora))/60) as promedio_espera_min,
        AVG(EXTRACT(EPOCH FROM (a.hora_salida - a.hora_llegada))/60) as promedio_atencion_min
      FROM "Historial_Atencion" h1
      JOIN "Historial_Atencion" h2 ON h1.id_atencion = h2.id_atencion
      JOIN "Atencion" a ON h1.id_atencion = a.id_atencion
      WHERE h1.id_estado = 2 AND h2.id_estado = 4
      AND a.id_sede = $1
      AND h1.fecha_hora >= (CURRENT_DATE - interval '30 days')
    `,
      [req.usuario.id_sede],
    );

    const porServicio = await pool.query(
      `
      SELECT s.nombre_servicio as nombre, COUNT(a.id_atencion) as total
      FROM "Servicio" s
      LEFT JOIN "Atencion" a ON s.id_servicio = a.id_servicio
      WHERE s.id_sede = $1
      GROUP BY s.nombre_servicio
    `,
      [req.usuario.id_sede],
    );

    const porPago = await pool.query(
      `
      SELECT r.nombre, COUNT(a.id_atencion) as total
      FROM "Responsable_Pago" r
      LEFT JOIN "Atencion" a ON r.id_responsable = a.id_responsable
      WHERE a.id_sede = $1 OR a.id_sede IS NULL
      GROUP BY r.nombre
    `,
      [req.usuario.id_sede],
    );

    const auditoria = await pool.query(
      `
      SELECT p.nombre, p.apellido, e.nombre_estado, a.hora_llegada as fecha_creacion, u.cedula as responsable
      FROM "Atencion" a
      JOIN "Pacientes" p ON a.id_paciente = p.id_paciente
      JOIN "Estado" e ON a.id_estado_actual = e.id_estado
      JOIN "Usuarios" u ON a.id_usuario_registro = u.id_usuario
      WHERE a.id_sede = $1
      ORDER BY a.hora_llegada DESC
      LIMIT 10
    `,
      [req.usuario.id_sede],
    );

    res.json({
      estadisticas: {
        espera: Math.round(tiemposPromedio.rows[0]?.promedio_espera_min || 0),
        atencion: Math.round(tiemposPromedio.rows[0]?.promedio_atencion_min || 0),
        total_pacientes: auditoria.rowCount > 0 ? auditoria.rows.length : 0,
      },
      por_servicio: porServicio.rows,
      por_pago: porPago.rows,
      auditoria: auditoria.rows,
    });
  } catch (error) {
    console.error('Error en estadísticas:', error);
    res.status(500).json({ mensaje: 'Error al generar estadísticas' });
  }
};

const cerrarSistema = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `
      UPDATE "Atencion" 
      SET id_estado_actual = 6, hora_salida = NOW() 
      WHERE id_estado_actual IN (2, 3) 
      AND DATE(hora_llegada) = CURRENT_DATE
      AND id_sede = $1
    `,
      [req.usuario.id_sede],
    );

    await client.query('UPDATE "Consultorios" SET estado_fisico = \'LIBRE\' WHERE id_sede = $1', [
      req.usuario.id_sede,
    ]);

    await client.query("DELETE FROM configuraciones WHERE clave = 'sistema_cerrado'");
    await client.query("INSERT INTO configuraciones (clave, valor) VALUES ('sistema_cerrado', 'true')");

    await client.query('COMMIT');
    if (req.io) req.io.emit('sistema-cerrado', { mensaje: 'Atención finalizada por hoy.' });
    res.json({ mensaje: 'Sistema cerrado exitosamente.' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al cerrar sistema:', error);
    res.status(500).json({ mensaje: 'Error crítico al intentar cerrar el sistema' });
  } finally {
    client.release();
  }
};

// --- CRUD SERVICIOS ---

const getServicios = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id_servicio as id, nombre_servicio as nombre, status as activo, prefijo, piso, consultorio, id_sede
       FROM "Servicio" WHERE id_sede = $1 ORDER BY nombre_servicio ASC`,
      [req.usuario.id_sede]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener servicios' });
  }
};

const getResponsables = async (req, res) => {
  try {
    const result = await pool.query('SELECT id_responsable as id, nombre FROM "Responsable_Pago" ORDER BY id_responsable ASC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener responsables' });
  }
};

const crearServicio = async (req, res) => {
  try {
    let { nombre, activo, prefijo, piso, consultorio, id_sede } = req.body;
    const sedeId = id_sede || req.usuario.id_sede;
    nombre = (nombre || '').toString().toUpperCase().trim();
    prefijo = (prefijo || '').toString().toUpperCase().trim();
    piso = piso ? piso.toString().replace(/\D/g, '') : null;
    consultorio = consultorio ? consultorio.toString().toUpperCase().trim() : null;

    const result = await pool.query(
      `INSERT INTO "Servicio" (nombre_servicio, status, prefijo, piso, consultorio, id_sede) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id_servicio as id`,
      [nombre, activo ?? true, prefijo, piso, consultorio, sedeId]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al crear servicio' });
  }
};

const actualizarServicio = async (req, res) => {
  const { id } = req.params;
  let { nombre, activo, prefijo, piso, consultorio, id_sede } = req.body;
  const sedeId = id_sede || req.usuario.id_sede;
  try {
    nombre = nombre ? nombre.toString().toUpperCase().trim() : null;
    prefijo = prefijo ? prefijo.toString().toUpperCase().trim() : null;
    piso = piso ? piso.toString().replace(/\D/g, '') : null;
    consultorio = consultorio ? consultorio.toString().toUpperCase().trim() : null;

    await pool.query(
      `UPDATE "Servicio" SET nombre_servicio = $1, status = $2, prefijo = $3, piso = $4, consultorio = $5, id_sede = $6 WHERE id_servicio = $7`,
      [nombre, activo, prefijo, piso, consultorio, sedeId, id]
    );
    res.json({ mensaje: 'Servicio actualizado' });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al actualizar servicio' });
  }
};

const eliminarServicio = async (req, res) => {
  try {
    await pool.query('DELETE FROM "Servicio" WHERE id_servicio = $1', [req.params.id]);
    res.json({ mensaje: 'Servicio eliminado' });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al eliminar servicio' });
  }
};

// --- CRUD CONSULTORIOS ---

const getConsultorios = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.id_consultorio as id, c.nombre, c.piso, c.estado_fisico as estado, c.id_servicio as servicio_id, s.nombre_servicio as servicio_nombre
       FROM "Consultorios" c LEFT JOIN "Servicio" s ON c.id_servicio = s.id_servicio WHERE c.id_sede = $1 ORDER BY c.nombre ASC`,
      [req.usuario.id_sede]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener consultorios' });
  }
};

const getAseguradoras = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM vista_aseguradoras WHERE id_sede = $1', [req.usuario.id_sede]);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener aseguradoras' });
  }
};

const crearAseguradora = async (req, res) => {
  let { nombre } = req.body;
  if (!nombre) return res.status(400).json({ mensaje: 'Nombre obligatorio' });
  try {
    await pool.query('INSERT INTO "cliente" (id_tipo_cliente, nombre, id_sede) VALUES ($1, $2, $3)', [2, nombre.toString().toUpperCase().trim(), req.usuario.id_sede]);
    res.status(201).json({ mensaje: 'Aseguradora creada' });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al crear aseguradora' });
  }
};

const actualizarAseguradora = async (req, res) => {
  const { id } = req.params;
  const { nombre } = req.body;
  try {
    await pool.query('UPDATE "cliente" SET nombre = $1 WHERE id_cliente = $2 AND id_sede = $3', [nombre.toUpperCase().trim(), id, req.usuario.id_sede]);
    res.json({ mensaje: 'Aseguradora actualizada' });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al actualizar aseguradora' });
  }
};

const eliminarAseguradora = async (req, res) => {
  const { id } = req.params;
  try {
    // Verificar si tiene atenciones asociadas
    const check = await pool.query('SELECT COUNT(*) FROM "Atencion" WHERE id_cliente = $1', [id]);
    if (parseInt(check.rows[0].count) > 0) {
      return res.status(400).json({ mensaje: 'No se puede eliminar una aseguradora con historial de atenciones' });
    }
    await pool.query('DELETE FROM "cliente" WHERE id_cliente = $1 AND id_sede = $2', [id, req.usuario.id_sede]);
    res.json({ mensaje: 'Aseguradora eliminada' });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al eliminar aseguradora' });
  }
};

const crearConsultorio = async (req, res) => {
  let { nombre, servicio_id, piso } = req.body;
  try {
    nombre = (nombre || '').toString().toUpperCase().trim();
    piso = piso ? piso.toString().replace(/\D/g, '') : null;
    await pool.query('INSERT INTO "Consultorios" (nombre, id_servicio, piso, id_sede) VALUES ($1, $2, $3, $4)', [nombre, servicio_id, piso, req.usuario.id_sede]);
    res.status(201).json({ mensaje: 'Consultorio creado' });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al crear consultorio' });
  }
};

const actualizarConsultorio = async (req, res) => {
  const { id } = req.params;
  let { nombre, servicio_id, piso } = req.body;
  try {
    nombre = nombre ? nombre.toString().toUpperCase().trim() : null;
    piso = piso ? piso.toString().replace(/\D/g, '') : null;
    await pool.query('UPDATE "Consultorios" SET nombre = $1, id_servicio = $2, piso = $3 WHERE id_consultorio = $4', [nombre, servicio_id, piso, id]);
    res.json({ mensaje: 'Consultorio actualizado' });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al actualizar consultorio' });
  }
};

const eliminarConsultorio = async (req, res) => {
  try {
    await pool.query('DELETE FROM "Consultorios" WHERE id_consultorio = $1', [req.params.id]);
    res.json({ mensaje: 'Consultorio eliminado' });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al eliminar consultorio' });
  }
};

// --- CRUD MÉDICOS ---

const getMedicos = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM "Usuarios" WHERE rol = \'medico\' AND id_sede = $1', [req.usuario.id_sede]);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener médicos' });
  }
};

const crearMedico = async (req, res) => {
  let { nombre, apellido, cedula, telefono, email, password, servicio_id, id_consultorio, piso } = req.body;
  try {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password || cedula, salt);
    nombre = (nombre || '').toString().toUpperCase().trim();
    apellido = (apellido || '').toString().toUpperCase().trim();
    cedula = (cedula || '').toString().replace(/\D/g, '');
    telefono = telefono ? telefono.toString().replace(/\D/g, '') : null;
    email = email ? email.toString().toLowerCase().trim() : null;

    await pool.query(
      `INSERT INTO "Usuarios" (nombre, apellido, cedula, telefono, email, password_hash, rol, id_servicio, id_consultorio, piso, id_sede) 
       VALUES ($1, $2, $3, $4, $5, $6, 'medico', $7, $8, $9, $10)`,
      [nombre, apellido, cedula, telefono, email, hash, servicio_id, id_consultorio, piso, req.usuario.id_sede]
    );
    res.status(201).json({ mensaje: 'Médico creado' });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al crear médico' });
  }
};

const actualizarMedico = async (req, res) => {
  const { id } = req.params;
  let { nombre, apellido, cedula, telefono, email, password, servicio_id, id_consultorio, piso } = req.body;
  try {
    nombre = (nombre || '').toString().toUpperCase().trim();
    apellido = (apellido || '').toString().toUpperCase().trim();
    cedula = (cedula || '').toString().replace(/\D/g, '');
    telefono = telefono ? telefono.toString().replace(/\D/g, '') : null;
    email = email ? email.toString().toLowerCase().trim() : null;

    let query = `UPDATE "Usuarios" SET nombre=$1, apellido=$2, cedula=$3, telefono=$4, email=$5, id_servicio=$6, id_consultorio=$7, piso=$8`;
    let params = [nombre, apellido, cedula, telefono, email, servicio_id, id_consultorio, piso];

    if (password) {
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(password, salt);
      query += `, password_hash=$9`;
      params.push(hash);
    }
    query += ` WHERE id_usuario=$${params.length + 1}`;
    params.push(id);

    await pool.query(query, params);
    res.json({ mensaje: 'Médico actualizado' });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al actualizar médico' });
  }
};

const eliminarMedico = async (req, res) => {
  try {
    await pool.query('DELETE FROM "Usuarios" WHERE id_usuario = $1', [req.params.id]);
    res.json({ mensaje: 'Médico eliminado' });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al eliminar médico' });
  }
};

// --- CRUD RECEPCIONISTAS ---

const getRecepcionistas = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM "Usuarios" WHERE rol = \'recepcionista\' AND id_sede = $1', [req.usuario.id_sede]);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener recepcionistas' });
  }
};

const crearRecepcionista = async (req, res) => {
  let { nombre, apellido, cedula, telefono, email, password, piso } = req.body;
  try {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password || cedula, salt);
    nombre = (nombre || '').toString().toUpperCase().trim();
    apellido = (apellido || '').toString().toUpperCase().trim();
    cedula = (cedula || '').toString().replace(/\D/g, '');
    telefono = telefono ? telefono.toString().replace(/\D/g, '') : null;
    email = email ? email.toString().toLowerCase().trim() : null;

    await pool.query(
      `INSERT INTO "Usuarios" (nombre, apellido, cedula, telefono, email, password_hash, rol, piso, id_sede) 
       VALUES ($1, $2, $3, $4, $5, $6, 'recepcionista', $7, $8)`,
      [nombre, apellido, cedula, telefono, email, hash, piso, req.usuario.id_sede]
    );
    res.status(201).json({ mensaje: 'Recepcionista creada' });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al crear recepcionista' });
  }
};

const actualizarRecepcionista = async (req, res) => {
  const { id } = req.params;
  let { nombre, apellido, cedula, telefono, email, password, piso } = req.body;
  try {
    nombre = (nombre || '').toString().toUpperCase().trim();
    apellido = (apellido || '').toString().toUpperCase().trim();
    cedula = (cedula || '').toString().replace(/\D/g, '');
    telefono = telefono ? telefono.toString().replace(/\D/g, '') : null;
    email = email ? email.toString().toLowerCase().trim() : null;

    let query = `UPDATE "Usuarios" SET nombre=$1, apellido=$2, cedula=$3, telefono=$4, email=$5, piso=$6`;
    let params = [nombre, apellido, cedula, telefono, email, piso];

    if (password) {
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(password, salt);
      query += `, password_hash=$7`;
      params.push(hash);
    }
    query += ` WHERE id_usuario=$${params.length + 1}`;
    params.push(id);

    await pool.query(query, params);
    res.json({ mensaje: 'Recepcionista actualizada' });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al actualizar recepcionista' });
  }
};

const eliminarRecepcionista = async (req, res) => {
  try {
    await pool.query('DELETE FROM "Usuarios" WHERE id_usuario = $1', [req.params.id]);
    res.json({ mensaje: 'Recepcionista eliminada' });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al eliminar recepcionista' });
  }
};

// --- CRUD GENÉRICO DE USUARIOS ---

const getUsuarios = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM "Usuarios" WHERE id_sede = $1', [req.usuario.id_sede]);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener usuarios' });
  }
};

const crearUsuario = async (req, res) => {
  let { nombre, apellido, cedula, telefono, email, password, rol, id_sede } = req.body;
  try {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password || cedula, salt);
    nombre = (nombre || '').toString().toUpperCase().trim();
    apellido = (apellido || '').toString().toUpperCase().trim();
    cedula = (cedula || '').toString().replace(/\D/g, '');
    telefono = telefono ? telefono.toString().replace(/\D/g, '') : null;
    email = email ? email.toString().toLowerCase().trim() : null;

    await pool.query(
      `INSERT INTO "Usuarios" (nombre, apellido, cedula, telefono, email, password_hash, rol, id_sede) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [nombre, apellido, cedula, telefono, email, hash, rol, id_sede || req.usuario.id_sede]
    );
    res.status(201).json({ mensaje: 'Usuario creado' });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al crear usuario' });
  }
};

const actualizarUsuario = async (req, res) => {
  const { id } = req.params;
  let { nombre, apellido, cedula, telefono, email, password, rol, status, id_sede } = req.body;
  try {
    nombre = (nombre || '').toString().toUpperCase().trim();
    apellido = (apellido || '').toString().toUpperCase().trim();
    cedula = (cedula || '').toString().replace(/\D/g, '');
    telefono = telefono ? telefono.toString().replace(/\D/g, '') : null;
    email = email ? email.toString().toLowerCase().trim() : null;

    let query = `UPDATE "Usuarios" SET nombre=$1, apellido=$2, cedula=$3, telefono=$4, email=$5, rol=$6, status=$7, id_sede=$8`;
    let params = [nombre, apellido, cedula, telefono, email, rol, status, id_sede || req.usuario.id_sede];

    if (password) {
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(password, salt);
      query += `, password_hash=$9`;
      params.push(hash);
    }
    query += ` WHERE id_usuario=$${params.length + 1}`;
    params.push(id);

    
    await pool.query(query, params);
    res.json({ mensaje: 'Usuario actualizado' });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al actualizar usuario' });
  }
};

const eliminarUsuario = async (req, res) => {
  try {
    await pool.query('DELETE FROM "Usuarios" WHERE id_usuario = $1', [req.params.id]);
    res.json({ mensaje: 'Usuario eliminado' });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al eliminar usuario' });
  }
};

const resetDatabase = async (req, res) => {
  res.status(501).json({ mensaje: 'Reset manual deshabilitado por seguridad' });
};

const getSedes = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM "Sedes" ORDER BY id_sede ASC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener sedes' });
  }
};

module.exports = {
  getReporteDiario,
  getEstadisticasAvanzadas,
  cerrarSistema,
  getServicios,
  getResponsables,
  crearServicio,
  actualizarServicio,
  eliminarServicio,
  getConsultorios,
  crearConsultorio,
  actualizarConsultorio,
  eliminarConsultorio,
  getAseguradoras,
  crearAseguradora,
  actualizarAseguradora,
  eliminarAseguradora,
  getMedicos,
  crearMedico,
  actualizarMedico,
  eliminarMedico,
  getRecepcionistas,
  crearRecepcionista,
  actualizarRecepcionista,
  eliminarRecepcionista,
  getUsuarios,
  crearUsuario,
  actualizarUsuario,
  eliminarUsuario,
  resetDatabase,
  getSedes,
};
