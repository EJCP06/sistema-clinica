const db = require('../config/db');
const logger = require('../config/logger');
const espRepo = require('../repositories/especialidad.repository');

const getSede = (req) => {
  const sede = req.usuario?.id_sede;
  return sede !== undefined && sede !== null ? Number(sede) : null;
};

/**
 * Obtiene todas las especialidades de la sede del usuario autenticado,
 * incluyendo los IDs de consultorios asociados a cada una.
 *
 * @param {import('express').Request} req - Petición HTTP
 * @param {import('express').Response} res - Respuesta HTTP
 * @returns {Promise<void>}
 */
const getEspecialidades = async (req, res) => {
  try {
    const sede = getSede(req);
    if (!sede) {
      return res.status(401).json({ mensaje: 'Token inválido o sin sede' });
    }
    const especialidades = await espRepo.getAll(sede);
    const relaciones = await espRepo.getConsultoriosByEspecialidad();

    const consultoriosPorEsp = {};
    for (const row of relaciones) {
      if (!consultoriosPorEsp[row.id_especialidad]) {
        consultoriosPorEsp[row.id_especialidad] = [];
      }
      consultoriosPorEsp[row.id_especialidad].push(row.id_consultorio);
    }

    const rows = especialidades.map((e) => ({
      ...e,
      consultorios_ids: consultoriosPorEsp[e.id_especialidad] || [],
    }));

    res.json(rows);
  } catch (err) {
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
};

/**
 * Crea una nueva especialidad junto con sus relaciones a consultorios.
 *
 * @param {import('express').Request} req - Petición HTTP
 * @param {import('express').Response} res - Respuesta HTTP
 * @returns {Promise<void>}
 */
const createEspecialidad = async (req, res) => {
  const { nombre, prefijo, id_servicio, id_sede, piso, consultorios_ids, activo } = req.body;
  // El piso admite números y letras (M = mezanina); se guarda en MAYÚSCULA.
  const pisoLimpio = (piso !== undefined && piso !== null) ? String(piso).trim().toUpperCase().replace(/[^A-Z0-9]/g, '') : piso;
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const esp = await espRepo.create(client, { nombre, prefijo, id_servicio, id_sede, piso: pisoLimpio, activo });
    const espId = esp.id_especialidad;

    if (consultorios_ids && consultorios_ids.length > 0) {
      for (const conId of consultorios_ids) {
        await espRepo.insertConsultorioRelation(client, espId, conId);
      }
    }

    await client.query('COMMIT');
    res.status(201).json({ ...esp, consultorios_ids: consultorios_ids || [] });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  } finally {
    client.release();
  }
};

/**
 * Actualiza los datos de una especialidad y sus relaciones con consultorios.
 *
 * @param {import('express').Request} req - Petición HTTP
 * @param {import('express').Response} res - Respuesta HTTP
 * @returns {Promise<void>}
 */
const updateEspecialidad = async (req, res) => {
  const { id } = req.params;
  const { nombre, prefijo, id_servicio, id_sede, piso, consultorios_ids, activo } = req.body;
  // El piso admite números y letras (M = mezanina); se guarda en MAYÚSCULA.
  const pisoLimpio = (piso !== undefined && piso !== null) ? String(piso).trim().toUpperCase().replace(/[^A-Z0-9]/g, '') : piso;
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const espAntes = await espRepo.getById(id);

    const sets = [];
    const values = [];
    let idx = 1;

    if (nombre !== undefined) { sets.push(`nombre = $${idx++}`); values.push(nombre); }
    if (prefijo !== undefined) { sets.push(`prefijo = $${idx++}`); values.push(prefijo); }
    if (id_servicio !== undefined) { sets.push(`id_servicio = $${idx++}`); values.push(id_servicio); }
    if (id_sede !== undefined) { sets.push(`id_sede = $${idx++}`); values.push(id_sede); }
    if (piso !== undefined) { sets.push(`piso = $${idx++}`); values.push(pisoLimpio); }
    if (activo !== undefined) { sets.push(`activo = $${idx++}`); values.push(activo); }

    if (sets.length > 0) {
      await espRepo.update(client, id, sets, values, idx);
    }

    if (consultorios_ids !== undefined) {
      await espRepo.deleteConsultorioRelations(client, id);
      for (const conId of consultorios_ids) {
        await espRepo.insertConsultorioRelation(client, id, conId);
      }
    }

    await client.query('COMMIT');

    const result = await espRepo.getById(id);
    const consultoriosIds = await espRepo.getConsultorioIdsByEspecialidad(id);

    // Si la especialidad se desactiva, desconectar en tiempo real a los
    // médicos que la tengan asignada para que no sigan operando con su sesión.
    if (activo === false && espAntes && espAntes.activo !== false && req.io) {
      const sockets = await req.io.fetchSockets();
      for (const socket of sockets) {
        if (socket.usuario && Number(socket.usuario.id_especialidad) === Number(id)) {
          socket.emit('especialidad-desactivada');
        }
      }
    }

    res.json({
      ...result,
      consultorios_ids: consultoriosIds,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  } finally {
    client.release();
  }
};

/**
 * Elimina una especialidad del sistema.
 *
 * Antes de borrarla desvincula los registros que la referencian (médicos y
 * historial de atenciones) para que la eliminación siempre sea posible, y
 * desconecta en tiempo real a los médicos conectados que la tenían asignada.
 *
 * @param {import('express').Request} req - Petición HTTP
 * @param {import('express').Response} res - Respuesta HTTP
 * @returns {Promise<void>}
 */
const deleteEspecialidad = async (req, res) => {
  const { id } = req.params;
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await espRepo.remove(client, id);
    await client.query('COMMIT');

    // Desconectar en tiempo real a los médicos que tenían la especialidad
    // para que no sigan operando con una especialidad ya eliminada.
    if (req.io) {
      const sockets = await req.io.fetchSockets();
      for (const socket of sockets) {
        if (socket.usuario && Number(socket.usuario.id_especialidad) === Number(id)) {
          socket.emit('especialidad-desactivada');
        }
      }
    }

    res.json({ mensaje: 'Especialidad eliminada' });
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error(err);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  } finally {
    client.release();
  }
};

/**
 * Importa especialidades desde un arreglo de filas (típicamente Excel).
 * Normaliza nombres, sedes y evita duplicados.
 *
 * @param {import('express').Request} req - Petición HTTP
 * @param {import('express').Response} res - Respuesta HTTP
 * @returns {Promise<void>}
 */
const importarEspecialidades = async (req, res) => {
  const { rows } = req.body;
  if (!rows || !Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ mensaje: 'No hay datos para importar' });
  }

  let importados = 0;
  let omitidos = 0;
  let errores = 0;

  const sedesResult = await db.query('SELECT id_sede, nombre FROM "Sedes"');
  const mapaSedes = {};
  sedesResult.rows.forEach(s => {
    const nombreNormalizado = s.nombre
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
    mapaSedes[nombreNormalizado] = s.id_sede;
  });

  const nombresExcel = rows.map(r =>
    (r.nombre || r.Nombre || r.NOMBRE || '').toString().toUpperCase().trim()
  ).filter(n => n);
  // La existencia se verifica POR SEDE: cada sede tiene sus propias especialidades,
  // así que una especialidad eliminada en una sede puede reimportarse aunque el
  // mismo nombre exista en otra sede.
  const existentes = await db.query(
    `SELECT nombre, id_sede FROM "Especialidades" WHERE nombre = ANY($1)`,
    [nombresExcel],
  );
  const clavesExistentes = new Set(existentes.rows.map((r) => `${r.id_sede}|${String(r.nombre).toUpperCase().trim()}`));

  for (const row of rows) {
    try {
      const nombre = (row.nombre || row.Nombre || row.NOMBRE || '').toString().toUpperCase().trim();
      const prefijo = (row.prefijo || row.Prefijo || row.PREFIJO || '').toString().toUpperCase().trim();
      // Piso: admite números y letras (M = mezanina); se guarda en MAYÚSCULA.
      const piso = (row.piso || row.Piso || row.PISO || '').toString().trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

      let idSede = 1;
      if (row.id_sede !== undefined && row.id_sede !== null && row.id_sede !== '') {
        idSede = Number(row.id_sede) || 1;
      } else if (row.sede || row.Sede || row.SEDE) {
        const nombreSedeRaw = (row.sede || row.Sede || row.SEDE || '').toString();
        const nombreSedeNormalizado = nombreSedeRaw
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .trim();
        idSede = mapaSedes[nombreSedeNormalizado] || 1;
      }

      const valorActivoRaw = (row.activo !== undefined ? row.activo : true).toString();
      const esActivo = valorActivoRaw === 'true' || valorActivoRaw === 'verdadero' || valorActivoRaw === '1';

      if (!nombre) {
        errores++;
        continue;
      }

      if (clavesExistentes.has(`${idSede}|${nombre}`)) {
        omitidos++;
        continue;
      }

      const consultoriosIds = row.consultorios_ids || row.consultoriosIds || [];

      const client = await db.connect();
      try {
        const result = await client.query(
          `INSERT INTO "Especialidades" (nombre, prefijo, id_servicio, id_sede, piso, activo)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING id_especialidad`,
          [nombre, prefijo || null, 1, Number(idSede), piso || null, esActivo],
        );
        const idEspecialidad = result.rows[0].id_especialidad;

        if (consultoriosIds.length > 0) {
          for (const idConsultorio of consultoriosIds) {
            const conId = Number(idConsultorio);
            if (conId > 0) {
              await client.query(
                `INSERT INTO "Especialidad_Consultorio" (id_especialidad, id_consultorio) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
                [idEspecialidad, conId],
              );
            }
          }
        }

        importados++;
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error('Error al importar especialidad:', { error: error.message, row });
      errores++;
    }
  }

  res.json({
    mensaje: `Importación completada: ${importados}, ${omitidos} ya existían, ${errores} errores`,
    importados,
    omitidos,
    errores,
  });
};

module.exports = { getEspecialidades, createEspecialidad, updateEspecialidad, deleteEspecialidad, importarEspecialidades };
