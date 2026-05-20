const pool = require('../config/db');
const bcrypt = require('bcryptjs');

// --- REPORTES Y CIERRE DE SISTEMA ---

/**
 * Obtiene el resumen de actividad del día actual.
 */
const getReporteDiario = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT t.id, t.numero, t.estado, t.hora_llegada, t.hora_inicio, t.hora_fin,
             t.nombre_paciente as paciente_nombre, t.documento_paciente as paciente_documento, t.telefono_paciente as paciente_telefono,
             s.nombre_servicio as servicio, t.id_sede
      FROM turnos t
      JOIN "Servicio" s ON t.servicio_id = s.id_servicio
      WHERE t.hora_llegada >= CURRENT_DATE 
      AND t.hora_llegada < (CURRENT_DATE + interval '1 day')
      AND t.id_sede = $1
      ORDER BY t.hora_llegada DESC
    `, [req.usuario.id_sede]);

    let atendidos = 0;
    let ausentes = 0;
    let transferidos = 0;
    let en_espera = 0;
    let tiempoEsperaTotal = 0;
    let tiempoAtencionTotal = 0;

    const turnosProcesados = result.rows.map((t) => {
      // Mapeo para el frontend que espera objeto paciente
      const processed = {
        ...t,
        paciente: {
          nombre: t.paciente_nombre,
          documento: t.paciente_documento || 'N/D',
          telefono: t.paciente_telefono || 'N/D',
        },
      };

      if (t.estado === 'ATENDIDO') {
        atendidos++;
        // ... (resto de lógica de tiempos si existieran las columnas en t)
      } else if (t.estado === 'AUSENTE') ausentes++;
      else if (t.estado === 'TRANSFERIDO') transferidos++;
      else if (t.estado === 'EN_ESPERA' || t.estado === 'LLAMADO') en_espera++;

      return processed;
    });

    const promedios = {
      esperaMinutos: atendidos > 0 ? (tiempoEsperaTotal / atendidos / 60000).toFixed(2) : '0.00',
      atencionMinutos:
        atendidos > 0 ? (tiempoAtencionTotal / atendidos / 60000).toFixed(2) : '0.00',
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

/**
 * Estadísticas avanzadas con filtrado por rango de fechas.
 */
const getEstadisticasAvanzadas = async (req, res) => {
  try {
    // 1. Tiempos Promedio (Espera y Atención)
    const tiemposPromedio = await pool.query(
      `
      SELECT 
        AVG(EXTRACT(EPOCH FROM (h2.fecha_hora_entrada - h1.fecha_hora_entrada))/60) as promedio_espera_min,
        AVG(EXTRACT(EPOCH FROM (h2.fecha_hora_salida - h2.fecha_hora_entrada))/60) as promedio_atencion_min
      FROM "Historial_Atencion" h1
      JOIN "Historial_Atencion" h2 ON h1.id_atencion = h2.id_atencion
      JOIN "Estado" e1 ON h1.id_estado = e1.id_estado
      JOIN "Estado" e2 ON h2.id_estado = e2.id_estado
      WHERE e1.nombre_estado = 'Registro' AND e2.nombre_estado = 'En Atención'
      AND h1.id_sede = $1
      AND h1.fecha_hora_entrada >= (CURRENT_DATE - interval '30 days')
    `,
      [req.usuario.id_sede],
    );

    // 2. Pacientes por Servicio
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

    // 3. Distribución por Responsable de Pago
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

    // 4. Últimos Movimientos (Auditoría)
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
        espera: Math.round(tiemposPromedio.rows[0].promedio_espera_min || 0),
        atencion: Math.round(tiemposPromedio.rows[0].promedio_atencion_min || 0),
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

/**
 * Cierra el sistema para el día actual.
 */
const cerrarSistema = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Marcar como ausentes los turnos que quedaron colgados
    await client.query(
      `
      UPDATE turnos 
      SET estado = 'AUSENTE', hora_fin = NOW() 
      WHERE estado IN ('EN_ESPERA', 'LLAMADO') 
      AND DATE(hora_llegada) = CURRENT_DATE
      AND id_sede = $1
    `,
      [req.usuario.id_sede],
    );

    // 2. Resetear todos los consultorios a estado LIBRE
    await client.query('UPDATE "Consultorios" SET estado_fisico = \'LIBRE\' WHERE id_sede = $1', [
      req.usuario.id_sede,
    ]);

    // 3. Registrar el cierre en configuraciones
    await client.query("DELETE FROM configuraciones WHERE clave = 'sistema_cerrado'");
    await client.query(
      "INSERT INTO configuraciones (clave, valor) VALUES ('sistema_cerrado', 'true')",
    );

    await client.query('COMMIT');

    if (req.io) {
      req.io.emit('sistema-cerrado', { mensaje: 'Atención finalizada por hoy.' });
    }

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
      `
      SELECT id_servicio as id, nombre_servicio as nombre, status as activo, 
             prefijo, piso, consultorio, id_sede
      FROM "Servicio" 
      WHERE id_sede = $1
      ORDER BY nombre_servicio ASC
    `,
      [req.usuario.id_sede],
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error en getServicios:', error);
    res.status(500).json({ mensaje: 'Error al obtener la lista de servicios' });
  }
};

const getResponsables = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id_responsable as id, nombre FROM "Responsable_Pago" ORDER BY id_responsable ASC',
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error en getResponsables:', error);
    res.status(500).json({ mensaje: 'Error al obtener responsables de pago' });
  }
};

const crearServicio = async (req, res) => {
  try {
    const { nombre, activo, prefijo, piso, consultorio, id_sede } = req.body;
    const sedeId = id_sede || req.usuario.id_sede;
    const nombreMayus = (nombre || '').toUpperCase().trim();
    const pisoLimpio = piso ? piso.toString().replace(/\D/g, '') : null;
    const consultorioMayus = consultorio ? consultorio.toUpperCase().trim() : null;

    const result = await pool.query(
      `INSERT INTO "Servicio" 
       (nombre_servicio, status, prefijo, piso, consultorio, id_sede) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING id_servicio as id, nombre_servicio as nombre, piso, consultorio, id_sede`,
      [
        nombreMayus || 'NUEVO SERVICIO',
        activo ?? true,
        (prefijo || '').toUpperCase().trim(),
        pisoLimpio,
        consultorioMayus,
        sedeId,
      ],
    );

    // Auto-sincronizar tabla Consultorios para el flujo médico
    const newId = result.rows[0].id;
    if (consultorioMayus && pisoLimpio) {
      const nombres = consultorioMayus
        .split(',')
        .map((n) => n.trim())
        .filter((n) => n);
      for (const cn of nombres) {
        await pool.query(
          `INSERT INTO "Consultorios" (nombre, piso, id_servicio, estado_fisico, id_sede) VALUES ($1, $2, $3, 'LIBRE', $4)`,
          [cn, pisoLimpio, newId, sedeId],
        );
      }
    }

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error al crear servicio:', error);
    res.status(500).json({ mensaje: 'Error al registrar el nuevo servicio' });
  }
};

const actualizarServicio = async (req, res) => {
  const { id } = req.params;
  const { nombre, activo, prefijo, piso, consultorio, id_sede } = req.body;
  const sedeId = id_sede || req.usuario.id_sede;
  try {
    // Sanitización y Formateo
    const nombreMayus = nombre ? nombre.toUpperCase().trim() : null;
    const pisoLimpio = piso ? piso.toString().replace(/\D/g, '') : null;
    const consultorioMayus = consultorio ? consultorio.toUpperCase().trim() : null;

    const result = await pool.query(
      `UPDATE "Servicio" 
       SET nombre_servicio = $1, status = $2, prefijo = $3, piso = $4, consultorio = $5, id_sede = $6
       WHERE id_servicio = $7 
       RETURNING id_servicio as id, id_sede`,
      [
        nombreMayus,
        activo,
        prefijo ? prefijo.toUpperCase().trim() : null,
        pisoLimpio,
        consultorioMayus,
        sedeId,
        id,
      ],
    );
    if (result.rows.length === 0)
      return res.status(404).json({ mensaje: 'Servicio no encontrado' });

    // Auto-sincronizar tabla Consultorios
    if (consultorioMayus && pisoLimpio) {
      // Eliminar consultorios previos de este servicio y recrear
      await pool.query('DELETE FROM "Consultorios" WHERE id_servicio = $1', [id]);
      const nombres = consultorioMayus
        .split(',')
        .map((n) => n.trim())
        .filter((n) => n);
      for (const cn of nombres) {
        await pool.query(
          `INSERT INTO "Consultorios" (nombre, piso, id_servicio, estado_fisico, id_sede) VALUES ($1, $2, $3, 'LIBRE', $4)`,
          [cn, pisoLimpio, id, sedeId],
        );
      }
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error al actualizar servicio:', error);
    res.status(500).json({ mensaje: 'Error al actualizar el servicio' });
  }
};

const eliminarServicio = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM "Servicio" WHERE id_servicio = $1', [id]);
    res.json({ mensaje: 'Servicio eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar servicio:', error);
    res.status(500).json({ mensaje: 'Error al eliminar el servicio' });
  }
};

// --- CRUD CONSULTORIOS ---

const getConsultorios = async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT c.id_consultorio as id, c.nombre, c.piso, c.estado_fisico as estado, c.id_servicio as servicio_id, s.nombre_servicio as servicio_nombre
      FROM "Consultorios" c
      LEFT JOIN "Servicio" s ON c.id_servicio = s.id_servicio
      WHERE c.id_sede = $1
      ORDER BY c.nombre ASC
    `,
      [req.usuario.id_sede],
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error en getConsultorios:', error);
    res.status(500).json({ mensaje: 'Error al obtener consultorios' });
  }
};

const getAseguradoras = async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT c.nombre as aseguradora, t.nombre as tipo
      FROM "cliente" c
      JOIN "tipo_cliente" t ON c.id_tipo_cliente = t.id_tipo_cliente
      WHERE c.id_tipo_cliente = 2
      ORDER BY c.nombre ASC
    `,
      [],
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error en getAseguradoras:', error);
    res.status(500).json({ mensaje: 'Error al obtener aseguradoras' });
  }
};

const crearAseguradora = async (req, res) => {
  const { nombre } = req.body;

  if (!nombre || !nombre.toString().trim()) {
    return res.status(400).json({ mensaje: 'El nombre de la aseguradora es obligatorio' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO "cliente" (id_tipo_cliente, nombre) VALUES ($1, $2) RETURNING id_cliente as id, nombre',
      [2, nombre.toString().trim()]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error en crearAseguradora:', error);
    res.status(500).json({ mensaje: 'Error al crear aseguradora', error: error.message });
  }
};

const crearConsultorio = async (req, res) => {
  const { nombre, servicio_id, piso } = req.body;
  try {
    // Sanitización y Formateo
    const nombreMayus = nombre.toUpperCase().trim();
    const pisoLimpio = piso ? piso.toString().replace(/\D/g, '') : null;

    const result = await pool.query(
      'INSERT INTO "Consultorios" (nombre, id_servicio, piso, estado_fisico, id_sede) VALUES ($1, $2, $3, $4, $5) RETURNING id_consultorio as id',
      [nombreMayus, servicio_id, pisoLimpio, 'LIBRE', req.usuario.id_sede],
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error al crear consultorio:', error);
    res.status(500).json({ mensaje: 'Error al registrar consultorio' });
  }
};

const actualizarConsultorio = async (req, res) => {
  const { id } = req.params;
  const { nombre, servicio_id, piso } = req.body;
  try {
    // Sanitización y Formateo
    const nombreMayus = nombre ? nombre.toUpperCase().trim() : null;
    const pisoLimpio = piso ? piso.toString().replace(/\D/g, '') : null;

    const result = await pool.query(
      'UPDATE "Consultorios" SET nombre = $1, id_servicio = $2, piso = $3 WHERE id_consultorio = $4 RETURNING id_consultorio as id',
      [nombreMayus, servicio_id, pisoLimpio, id],
    );
    if (result.rows.length === 0)
      return res.status(404).json({ mensaje: 'Consultorio no encontrado' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error al actualizar consultorio:', error);
    res.status(500).json({ mensaje: 'Error al actualizar consultorio' });
  }
};

const eliminarConsultorio = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM "Consultorios" WHERE id_consultorio = $1', [id]);
    res.json({ mensaje: 'Consultorio eliminado' });
  } catch (error) {
    console.error('Error al eliminar consultorio:', error);
    res.status(500).json({ mensaje: 'Error al eliminar el consultorio' });
  }
};

// --- CRUD MÉDICOS ---

const getMedicos = async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT id_usuario as id, rol, id_consultorio as consultorio_id, id_servicio as servicio_id, nombre, apellido, cedula, telefono, email, status as activo, piso, id_sede
      FROM "Usuarios" 
      WHERE rol = 'medico' AND id_sede = $1
      ORDER BY apellido ASC, nombre ASC
    `,
      [req.usuario.id_sede],
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error en getMedicos:', error);
    res.status(500).json({ mensaje: 'Error al obtener lista de médicos' });
  }
};

const crearMedico = async (req, res) => {
  const {
    username,
    password,
    nombre,
    apellido,
    cedula,
    telefono,
    email,
    activo,
    id_consultorio,
    servicio_id,
    piso,
  } = req.body;
  try {
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const result = await pool.query(
      `INSERT INTO "Usuarios" (password_hash, rol, nombre, apellido, cedula, telefono, email, status, id_consultorio, id_servicio, piso, id_sede) 
       VALUES ($1, 'medico', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id_usuario as id, cedula`,
      [
        password_hash,
        (nombre || '').toUpperCase().trim(),
        (apellido || '').toUpperCase().trim(),
        (cedula || '').toString().replace(/\D/g, ''),
        telefono || null,
        email ? email.toLowerCase().trim() : null,
        activo ?? true,
        id_consultorio || null,
        servicio_id || null,
        piso || null,
        req.usuario.id_sede
      ],
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error al crear médico:', error);
    res
      .status(500)
      .json({
        mensaje: 'Error al registrar médico (verifique si el username o cédula ya existen)',
      });
  }
};

const actualizarMedico = async (req, res) => {
  const { id } = req.params;
  const {
    username,
    nombre,
    apellido,
    cedula,
    telefono,
    email,
    activo,
    id_consultorio,
    servicio_id,
    password,
    piso,
  } = req.body;
  try {
    let query = `UPDATE "Usuarios" SET nombre = $1, apellido = $2, cedula = $3, telefono = $4, email = $5, status = $6, id_consultorio = $7, id_servicio = $8, piso = $9`;
    const params = [
      (nombre || '').toUpperCase().trim(),
      (apellido || '').toUpperCase().trim(),
      (cedula || '').toString().replace(/\D/g, ''),
      telefono || null,
      email ? email.toLowerCase().trim() : null,
      activo,
      id_consultorio || null,
      servicio_id || null,
      piso || null,
    ];

    if (password && password.trim() !== '') {
      const salt = await bcrypt.genSalt(10);
      const password_hash = await bcrypt.hash(password, salt);
      query += `, password_hash = $${params.length + 1}`;
      params.push(password_hash);
    }

    query += ` WHERE id_usuario = $${params.length + 1} AND rol = 'medico' RETURNING id_usuario as id, cedula`;
    params.push(id);

    const result = await pool.query(query, params);
    if (result.rows.length === 0) return res.status(404).json({ mensaje: 'Médico no encontrado' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error al actualizar médico:', error);
    res.status(500).json({ mensaje: 'Error al actualizar datos del médico' });
  }
};

const eliminarMedico = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM "Usuarios" WHERE id_usuario = $1 AND rol = $2', [id, 'medico']);
    res.json({ mensaje: 'Médico eliminado exitosamente' });
  } catch (error) {
    console.error('Error al eliminar médico:', error);
    res.status(500).json({ mensaje: 'Error al intentar eliminar el médico' });
  }
};

// --- CRUD RECEPCIONISTAS ---

const getRecepcionistas = async (req, res) => {
  try {
    const query = `
      SELECT id_usuario as id, nombre, apellido, cedula, telefono, email, status as activo, rol, id_consultorio, id_servicio, piso, id_sede
      FROM "Usuarios" 
      WHERE rol = 'recepcionista' 
      AND id_sede = $1
      ORDER BY nombre ASC
    `;
    const result = await pool.query(query, [req.usuario?.id_sede]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error en getRecepcionistas:', error);
    res.status(500).json({ mensaje: 'Error al obtener lista de recepcionistas' });
  }
};

const crearRecepcionista = async (req, res) => {
  const { username, password, nombre, apellido, cedula, telefono, email, activo, piso } = req.body;
  try {
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const result = await pool.query(
      `INSERT INTO "Usuarios" (password_hash, rol, nombre, apellido, cedula, telefono, email, status, piso, id_consultorio, id_servicio, id_sede) 
       VALUES ($1, 'recepcionista', $2, $3, $4, $5, $6, $7, $8, NULL, NULL, $9) RETURNING id_usuario as id, cedula`,
      [
        password_hash,
        (nombre || '').toUpperCase().trim(),
        (apellido || '').toUpperCase().trim(),
        (cedula || '').toString().replace(/\D/g, ''),
        telefono || null,
        email ? email.toLowerCase().trim() : null,
        activo ?? true,
        piso || null,
        req.usuario.id_sede
      ],
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error al crear recepcionista:', error);
    res.status(500).json({ mensaje: 'Error al registrar recepcionista' });
  }
};

const actualizarRecepcionista = async (req, res) => {
  const { id } = req.params;
  const { username, nombre, apellido, cedula, telefono, email, activo, password, piso } = req.body;
  try {
    let query = `UPDATE "Usuarios" SET nombre = $1, apellido = $2, cedula = $3, telefono = $4, email = $5, status = $6, piso = $7, id_consultorio = NULL, id_servicio = NULL`;
    const params = [
      (nombre || '').toUpperCase().trim(),
      (apellido || '').toUpperCase().trim(),
      (cedula || '').toString().replace(/\D/g, ''),
      telefono || null,
      email ? email.toLowerCase().trim() : null,
      activo,
      piso || null
    ];

    if (password && password.trim() !== '') {
      const salt = await bcrypt.genSalt(10);
      const password_hash = await bcrypt.hash(password, salt);
      query += `, password_hash = $${params.length + 1}`;
      params.push(password_hash);
    }

    query += ` WHERE id_usuario = $${params.length + 1} AND rol = 'recepcionista' RETURNING id_usuario as id, cedula`;
    params.push(id);

    const result = await pool.query(query, params);
    if (result.rows.length === 0)
      return res.status(404).json({ mensaje: 'Recepcionista no encontrada' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error al actualizar recepcionista:', error);
    res.status(500).json({ mensaje: 'Error al actualizar datos de recepcionista' });
  }
};

const eliminarRecepcionista = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM "Usuarios" WHERE id_usuario = $1 AND rol = $2', [
      id,
      'recepcionista',
    ]);
    res.json({ mensaje: 'Recepcionista eliminada correctamente' });
  } catch (error) {
    console.error('Error al eliminar recepcionista:', error);
    res.status(500).json({ mensaje: 'Error al intentar eliminar la recepcionista' });
  }
};

// --- CRUD GENÉRICO DE USUARIOS (PERSONAL) ---

const getUsuarios = async (req, res) => {
  const { rol } = req.query;
  try {
    let query =
      'SELECT id_usuario as id, rol, id_consultorio as consultorio_id, id_servicio as servicio_id, nombre, apellido, cedula, telefono, email, status as activo, piso, id_sede FROM "Usuarios"';
    const params = [];

    const sedeId = req.usuario?.id_sede;
    const userRol = req.usuario?.rol;

    if (rol) {
      query += ' WHERE rol = $1 AND id_sede = $2';
      params.push(rol, sedeId);
    } else {
      query += ' WHERE id_sede = $1';
      params.push(sedeId);
    }

    query += ' ORDER BY rol ASC, apellido ASC, nombre ASC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error en getUsuarios:', error);
    res.status(500).json({ mensaje: 'Error al obtener lista de personal' });
  }
};

const crearUsuario = async (req, res) => {
  const {
    password,
    rol,
    nombre,
    apellido,
    cedula,
    telefono,
    email,
    activo,
    id_consultorio,
    servicio_id,
    piso,
  } = req.body;
  try {
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password || cedula || '123456', salt);

    // Usar la sede del usuario que crea, o la que viene en el body
    const sedeId = req.body.id_sede || req.usuario.id_sede;

    const result = await pool.query(
      `INSERT INTO "Usuarios" (password_hash, rol, nombre, apellido, cedula, telefono, email, status, id_consultorio, id_servicio, piso, id_sede) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id_usuario as id, cedula, rol`,
      [
        password_hash,
        rol || 'admin',
        (nombre || 'NUEVO').toUpperCase().trim(),
        (apellido || 'USUARIO').toUpperCase().trim(),
        (cedula || Date.now().toString()).toString().replace(/\D/g, ''),
        telefono || null,
        email ? email.toLowerCase().trim() : null,
        activo ?? true,
        id_consultorio || null,
        servicio_id || null,
        piso || null,
        sedeId
      ],
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('--- ERROR AL CREAR USUARIO ---');
    console.error('Error:', error);
    console.error('Body:', req.body);
    res.status(500).json({ 
      mensaje: 'Error al registrar personal', 
      error: error.message,
      detalle: error.detail 
    });
  }
};

const actualizarUsuario = async (req, res) => {
  const { id } = req.params;
  const {
    username,
    rol,
    nombre,
    apellido,
    cedula,
    telefono,
    email,
    activo,
    id_consultorio,
    servicio_id,
    password,
    piso,
  } = req.body;
  try {
    // Sanitización y Formateo
    const nombreMayus = nombre ? nombre.toUpperCase().trim() : null;
    const apellidoMayus = apellido ? apellido.toUpperCase().trim() : null;
    const cedulaLimpia = cedula ? cedula.toString().replace(/\D/g, '') : null;
    const telefonoLimpio = telefono ? telefono.toString().replace(/\D/g, '') : null;
    const emailMin = email ? email.toLowerCase().trim() : null;

    // Limpiar campos según rol
    const cleanPiso =
      rol === 'medico' || rol === 'recepcionista'
        ? piso
          ? piso.toString().replace(/\D/g, '')
          : null
        : null;
    const cleanConsultorio = rol === 'medico' ? id_consultorio || null : null;
    const cleanServicio = rol === 'medico' ? servicio_id || null : null;

    let query = `UPDATE "Usuarios" SET rol = $1, nombre = $2, apellido = $3, cedula = $4, telefono = $5, email = $6, status = $7, id_consultorio = $8, id_servicio = $9, piso = $10, id_sede = $11`;
    const params = [
      rol,
      nombreMayus,
      apellidoMayus,
      cedulaLimpia,
      telefonoLimpio,
      emailMin,
      activo,
      cleanConsultorio,
      cleanServicio,
      cleanPiso,
      req.body.id_sede || req.usuario.id_sede
    ];

    if (password && password.trim() !== '') {
      const salt = await bcrypt.genSalt(10);
      const password_hash = await bcrypt.hash(password, salt);
      query += `, password_hash = $${params.length + 1}`;
      params.push(password_hash);
    }

    query += ` WHERE id_usuario = $${params.length + 1} RETURNING id_usuario as id, cedula, rol`;
    params.push(id);

    const result = await pool.query(query, params);
    if (result.rows.length === 0) return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('--- ERROR AL ACTUALIZAR USUARIO ---');
    console.error('Error:', error);
    console.error('Body:', req.body);
    res.status(500).json({ 
      mensaje: 'Error al actualizar personal', 
      error: error.message,
      detalle: error.detail 
    });
  }
};

const eliminarUsuario = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM "Usuarios" WHERE id_usuario = $1', [id]);
    res.json({ mensaje: 'Usuario eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar usuario:', error);
    res.status(500).json({ mensaje: 'Error al intentar eliminar el usuario' });
  }
};

const resetDatabase = async (req, res) => {
  const fs = require('fs');
  const path = require('path');
  try {
    const sqlPath = path.join(__dirname, '../../db/reset_data.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    await pool.query(sql);

    res.json({ mensaje: 'Base de datos reseteada y cargada con éxito' });
  } catch (error) {
    console.error('Error al resetear DB:', error);
    res.status(500).json({ mensaje: 'Error al ejecutar el reset: ' + error.message });
  }
};

const getSedes = async (req, res) => {
  try {
    const result = await pool.query('SELECT id_sede, nombre FROM "Sedes" ORDER BY id_sede ASC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error en getSedes:', error);
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
