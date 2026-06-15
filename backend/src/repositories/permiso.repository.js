const pool = require('../config/db');
const { getTodasLasAccionesEspeciales, ACCIONES_ESPECIALES_POR_VISTA } = require('../config/acciones-especiales');

const getAll = async () => {
  const result = await pool.query(
    `SELECT DISTINCT 
       (rec.key || ':' || acc.key) as key,
       (rec.nombre || ' - ' || acc.nombre) as nombre,
       COALESCE(rec.descripcion || ' / ' || acc.descripcion, '') as descripcion
     FROM "Roles_Recursos_Acciones" rra
     INNER JOIN "Recursos" rec ON rra.id_recurso = rec.id_recurso
     INNER JOIN "Acciones" acc ON rra.id_accion = acc.id_accion
     ORDER BY nombre`
  );
  return result.rows.map((row, idx) => ({
    id: idx + 1,
    key: row.key,
    nombre: row.nombre,
    descripcion: row.descripcion
  }));
};

const getByRolId = async (idRol) => {
  const result = await pool.query(
    `SELECT 
       (rec.key || ':' || acc.key) as key,
       (rec.nombre || ' - ' || acc.nombre) as nombre,
       COALESCE(rec.descripcion || ' / ' || acc.descripcion, '') as descripcion
     FROM "Roles_Recursos_Acciones" rra
     INNER JOIN "Recursos" rec ON rra.id_recurso = rec.id_recurso
     INNER JOIN "Acciones" acc ON rra.id_accion = acc.id_accion
     WHERE rra.id_rol = $1
     ORDER BY nombre`,
    [idRol]
  );
  return result.rows.map((row, idx) => ({
    id: idx + 1,
    key: row.key,
    nombre: row.nombre,
    descripcion: row.descripcion
  }));
};

const getKeysByRolId = async (idRol) => {
  const result = await pool.query(
    `SELECT (rec.key || ':' || acc.key) as key
     FROM "Roles_Recursos_Acciones" rra
     INNER JOIN "Recursos" rec ON rra.id_recurso = rec.id_recurso
     INNER JOIN "Acciones" acc ON rra.id_accion = acc.id_accion
     WHERE rra.id_rol = $1`,
    [idRol]
  );
  return result.rows.map(r => r.key);
};

const create = async (key, nombre, descripcion) => {
  let recKey = key;
  let accKey = '*';
  if (key.includes(':')) {
    const parts = key.split(':');
    recKey = parts[0];
    accKey = parts[1];
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const recRes = await client.query(
      'INSERT INTO "Recursos" (key, nombre, descripcion) VALUES ($1, $2, $3) ON CONFLICT (key) DO UPDATE SET key=EXCLUDED.key RETURNING id_recurso',
      [recKey, nombre, descripcion]
    );
    const accRes = await client.query(
      'INSERT INTO "Acciones" (key, nombre, descripcion) VALUES ($1, $2, $3) ON CONFLICT (key) DO UPDATE SET key=EXCLUDED.key RETURNING id_accion',
      [accKey, accKey, descripcion]
    );
    await client.query('COMMIT');
    return { id: `${recRes.rows[0].id_recurso}-${accRes.rows[0].id_accion}`, key, nombre, descripcion };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const update = async (id, key, nombre, descripcion) => {
  // En este nuevo modelo, actualizar un permiso individual se delega a Recursos y Acciones
  let recKey = key;
  let accKey = '*';
  if (key && key.includes(':')) {
    const parts = key.split(':');
    recKey = parts[0];
    accKey = parts[1];
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (recKey) {
      await client.query(
        'UPDATE "Recursos" SET key = COALESCE($1, key), nombre = COALESCE($2, nombre), descripcion = $3 WHERE key = $4',
        [recKey, nombre, descripcion, recKey]
      );
    }
    if (accKey) {
      await client.query(
        'UPDATE "Acciones" SET key = COALESCE($1, key), nombre = COALESCE($2, nombre) WHERE key = $3',
        [accKey, accKey, accKey]
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const remove = async (id) => {
  // En este nuevo modelo, remover se traduce a limpiar asignaciones de Roles_Recursos_Acciones
  // Opcionalmente se puede limpiar de Recursos/Acciones si están huérfanos
};

const asignarPermisos = async (idRol, permisosKeys) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM "Roles_Recursos_Acciones" WHERE id_rol = $1', [idRol]);

    if (permisosKeys && permisosKeys.length > 0) {
      // Expandir permisosKeys con acciones especiales automáticas
      const keysExpandidos = [...permisosKeys];

      // Identificar qué vistast tienen algún permiso
      const vistastConAcceso = new Set();
      for (const p of keysExpandidos) {
        if (!p || !p.includes(':')) continue;
        const [recKey, accKey] = p.split(':');
        // Aceptamos cualquier acción (incluyendo especiales) para disparar la inyección
        if (accKey) {
          vistastConAcceso.add(recKey);
        }
      }

      // Agregar acciones especiales para esas vistast
      for (const vista of vistastConAcceso) {
        const especiales = getTodasLasAccionesEspeciales(vista);
        for (const acc of especiales) {
          keysExpandidos.push(`${vista}:${acc}`);
        }
      }

      for (const p of keysExpandidos) {
        if (!p) continue;

        let recKey, accKey;
        if (p.includes(':')) {
          const parts = p.split(':');
          recKey = parts[0];
          accKey = parts[1] || '*';
        } else {
          recKey = p;
          accKey = '*';
        }

        let recRes = await client.query('SELECT id_recurso FROM "Recursos" WHERE key = $1', [recKey]);
        let idRecurso;

        if (recRes.rows.length === 0) {
          const insertRec = await client.query(
            'INSERT INTO "Recursos" (key, nombre) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET key=EXCLUDED.key RETURNING id_recurso',
            [recKey, recKey.charAt(0).toUpperCase() + recKey.slice(1)]
          );
          idRecurso = insertRec.rows[0]?.id_recurso;
        } else {
          idRecurso = recRes.rows[0].id_recurso;
        }

        let accRes = await client.query('SELECT id_accion FROM "Acciones" WHERE key = $1', [accKey]);
        let idAccion;

        if (accRes.rows.length === 0) {
          const insertAcc = await client.query(
            'INSERT INTO "Acciones" (key, nombre) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET key=EXCLUDED.key RETURNING id_accion',
            [accKey, accKey.charAt(0).toUpperCase() + accKey.slice(1)]
          );
          idAccion = insertAcc.rows[0]?.id_accion;
        } else {
          idAccion = accRes.rows[0].id_accion;
        }

        if (idRecurso && idAccion) {
          await client.query(
            'INSERT INTO "Roles_Recursos_Acciones" (id_rol, id_recurso, id_accion) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
            [idRol, idRecurso, idAccion]
          );
        } else {
          console.warn(`No se pudo asignar el permiso ${p} por falta de ID de recurso o acción`);
        }
      }
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  getAll,
  getByRolId,
  getKeysByRolId,
  create,
  update,
  remove,
  asignarPermisos,
};