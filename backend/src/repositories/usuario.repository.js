/**
 * Repositorio de usuarios/personal (tabla "Usuarios").
 *
 * Un usuario pertenece a una sede, tiene un rol (id_rol) y puede estar
 * vinculado a un servicio, consultorio y/o especialidad. Cada usuario tiene
 * un sesion_token que se renueva en cada login: sirve para invalidar sesiones
 * antiguas (una sola sesión activa por usuario).
 *
 * Las consultas de login (findByCedula, findById, findManyByCedula) traen
 * además la lista de permisos del rol como JSON (recursos:acciones).
 */
const pool = require('../config/db');

/**
 * Verifica qué cédulas de una lista ya existen en la base (validación en masa).
 *
 * @param {string[]} cedulas - Lista de cédulas a verificar
 * @returns {Promise<Array<{cedula: string}>>}
 */
const findByCedulas = async (cedulas) => {
  if (!cedulas || cedulas.length === 0) return [];
  const placeholders = cedulas.map((_, i) => `$${i + 1}`).join(',');
  const result = await pool.query(
    `SELECT cedula FROM "Usuarios" WHERE cedula IN (${placeholders})`,
    cedulas,
  );
  return result.rows;
};

const findByCedula = async (cedula) => {
  const result = await pool.query(`
    SELECT u.id_usuario as id, u.cedula, u.password_hash, r.key as rol, u.id_rol,
           r.activo as rol_activo,
           u.primer_nombre AS nombre, u.primer_apellido AS apellido,
           u.id_servicio as servicio_id, u.id_consultorio as consultorio_id, u.id_sede,
           u.id_especialidad, e.nombre as especialidad_nombre, e.activo as esp_activo,
           u.sesion_token, u.status,
           COALESCE(
             (SELECT json_agg(rec.key || ':' || acc.key)
              FROM "Roles_Recursos_Acciones" rra
              INNER JOIN "Recursos" rec ON rra.id_recurso = rec.id_recurso
              INNER JOIN "Acciones" acc ON rra.id_accion = acc.id_accion
              WHERE rra.id_rol = u.id_rol),
             '[]'::json
           ) as permisos,
           COALESCE(
             (SELECT json_agg(
                      json_build_object('id', ue.id_especialidad, 'nombre', e2.nombre)
                      ORDER BY (ue.id_especialidad = u.id_especialidad) DESC, ue.id_especialidad
                    )
              FROM "Usuario_Especialidad" ue
              LEFT JOIN "Especialidades" e2 ON ue.id_especialidad = e2.id_especialidad
              WHERE ue.id_usuario = u.id_usuario AND ue.activo = TRUE AND e2.activo = TRUE),
             '[]'::json
           ) as especialidades_activas
    FROM "Usuarios" u
    LEFT JOIN "Roles" r ON u.id_rol = r.id_rol
    LEFT JOIN "Especialidades" e ON u.id_especialidad = e.id_especialidad
    WHERE u.cedula = $1
  `, [cedula]);
  return result.rows[0] || null;
};

const findManyByCedula = async (cedula) => {
  const result = await pool.query(`
    SELECT u.id_usuario as id, u.cedula, u.password_hash, r.key as rol, u.id_rol,
           r.activo as rol_activo,
           u.primer_nombre AS nombre, u.primer_apellido AS apellido,
           u.id_servicio as servicio_id, u.id_consultorio as consultorio_id, u.id_sede,
           u.id_especialidad, e.nombre as especialidad_nombre, e.activo as esp_activo,
           u.sesion_token, u.status,
           COALESCE(
             (SELECT json_agg(rec.key || ':' || acc.key)
              FROM "Roles_Recursos_Acciones" rra
              INNER JOIN "Recursos" rec ON rra.id_recurso = rec.id_recurso
              INNER JOIN "Acciones" acc ON rra.id_accion = acc.id_accion
              WHERE rra.id_rol = u.id_rol),
             '[]'::json
           ) as permisos,
           COALESCE(
             (SELECT json_agg(
                      json_build_object('id', ue.id_especialidad, 'nombre', e2.nombre)
                      ORDER BY (ue.id_especialidad = u.id_especialidad) DESC, ue.id_especialidad
                    )
              FROM "Usuario_Especialidad" ue
              LEFT JOIN "Especialidades" e2 ON ue.id_especialidad = e2.id_especialidad
              WHERE ue.id_usuario = u.id_usuario AND ue.activo = TRUE AND e2.activo = TRUE),
             '[]'::json
           ) as especialidades_activas
    FROM "Usuarios" u
    LEFT JOIN "Roles" r ON u.id_rol = r.id_rol
    LEFT JOIN "Especialidades" e ON u.id_especialidad = e.id_especialidad
    WHERE u.cedula = $1
  `, [cedula]);
  return result.rows;
};

const actualizarSesionToken = async (id, token) => {
  await pool.query('UPDATE "Usuarios" SET sesion_token = $1 WHERE id_usuario = $2', [token, id]);
};

const findById = async (id) => {
  const result = await pool.query(`
    SELECT u.id_usuario as id, u.cedula, u.password_hash, r.key as rol, u.id_rol,
           r.activo as rol_activo,
           u.primer_nombre AS nombre, u.primer_apellido AS apellido,
           u.id_servicio as servicio_id, u.id_consultorio as consultorio_id, u.id_sede,
           u.id_especialidad, e.nombre as especialidad_nombre, e.activo as esp_activo,
           u.sesion_token, u.status,
           COALESCE(
             (SELECT json_agg(rec.key || ':' || acc.key)
              FROM "Roles_Recursos_Acciones" rra
              INNER JOIN "Recursos" rec ON rra.id_recurso = rec.id_recurso
              INNER JOIN "Acciones" acc ON rra.id_accion = acc.id_accion
              WHERE rra.id_rol = u.id_rol),
             '[]'::json
           ) as permisos
    FROM "Usuarios" u
    LEFT JOIN "Roles" r ON u.id_rol = r.id_rol
    LEFT JOIN "Especialidades" e ON u.id_especialidad = e.id_especialidad
    WHERE u.id_usuario = $1
  `, [id]);
  return result.rows[0] || null;
};

const findByCedulaSimple = async (cedula) => {
  const result = await pool.query('SELECT id_usuario FROM "Usuarios" WHERE cedula = $1', [cedula]);
  return result.rows[0] || null;
};

const findByCedulaSede = async (cedula, idSede) => {
  const result = await pool.query('SELECT id_usuario FROM "Usuarios" WHERE cedula = $1 AND id_sede = $2', [cedula, idSede]);
  return result.rows[0] || null;
};

const updatePasswordByCedula = async (cedula, passwordHash) => {
  await pool.query('UPDATE "Usuarios" SET password_hash = $1 WHERE cedula = $2', [passwordHash, cedula]);
};

const updatePassword = async (id, passwordHash) => {
  await pool.query('UPDATE "Usuarios" SET password_hash = $1 WHERE id_usuario = $2', [passwordHash, id]);
};

const findByCedulaAndEmail = async (email, cedula) => {
  const result = await pool.query(
    'SELECT id_usuario, email, cedula FROM "Usuarios" WHERE LOWER(email) = LOWER($1) AND cedula = $2',
    [email.trim(), cedula.trim()],
  );
  return result.rows[0] || null;
};

const deleteByCedula = async (cedula) => {
  await pool.query('DELETE FROM "Usuarios" WHERE cedula = $1', [cedula]);
};

const insertAdmin = async (hash, rolKey, nombre, apellido, cedula, idSede, status) => {
  const rolRes = await pool.query('SELECT id_rol FROM "Roles" WHERE key = $1 AND id_sede = $2', [rolKey, idSede || 1]);
  const idRol = rolRes.rows[0]?.id_rol;
  
  if (!idRol) throw new Error(`Rol no encontrado: ${rolKey}`);

  await pool.query(
    'INSERT INTO "Usuarios" (password_hash, id_rol, primer_nombre, primer_apellido, cedula, id_sede, status) VALUES ($1, $2, $3, $4, $5, $6, $7)',
    [hash, idRol, nombre, apellido, cedula, idSede, status],
  );
};

const getPersonal = async (sede, rolKey) => {
  let query = `SELECT
      u.id_usuario, u.cedula, r.key as rol, u.id_rol,
      u.primer_nombre AS nombre, u.segundo_nombre, u.primer_apellido AS apellido, u.segundo_apellido,
      u.telefono, u.email,
      u.id_consultorio, u.id_servicio, u.id_especialidad, u.id_sede, u.status,
      u.fecha_creacion, c.nombre AS consultorio_nombre, s.nombre_servicio AS servicio_nombre,
      COALESCE(
        (SELECT json_agg(x.id_especialidad)
         FROM (
           SELECT ue.id_especialidad
           FROM "Usuario_Especialidad" ue
           WHERE ue.id_usuario = u.id_usuario
           ORDER BY (ue.id_especialidad = u.id_especialidad) DESC, ue.id_especialidad
         ) x),
        '[]'::json
      ) AS especialidades,
      COALESCE(
        (SELECT json_agg(x.id_especialidad)
         FROM (
           SELECT ue.id_especialidad
           FROM "Usuario_Especialidad" ue
           WHERE ue.id_usuario = u.id_usuario AND ue.activo = FALSE
         ) x),
        '[]'::json
      ) AS especialidades_inactivas
    FROM "Usuarios" u
    LEFT JOIN "Roles" r ON u.id_rol = r.id_rol
    LEFT JOIN "Consultorios" c ON u.id_consultorio = c.id_consultorio
    LEFT JOIN "Servicio" s ON u.id_servicio = s.id_servicio`;
  const params = [];
  const condiciones = [];

  if (sede && Number(sede) !== 0) {
    condiciones.push(`u.id_sede = $1`);
    params.push(Number(sede));
  }

  if (rolKey) {
    condiciones.push(`r.key = $${params.length + 1}`);
    params.push(rolKey);
  }

  if (condiciones.length > 0) {
    query += ` WHERE ${condiciones.join(' AND ')}`;
  }
  query += ` ORDER BY u.primer_nombre, u.primer_apellido`;
  const result = await pool.query(query, params);
  return result.rows;
};

const crearPersonal = async (data) => {
  // Buscamos el id_rol si se pasa el key (rol)
  let idRol = data.id_rol;
  if (!idRol && data.rol) {
    const rolRes = await pool.query('SELECT id_rol FROM "Roles" WHERE key = $1 AND id_sede = $2', [data.rol, data.sede]);
    idRol = rolRes.rows[0]?.id_rol;
  }

  if (!idRol) throw new Error('Se requiere un rol válido');

  const result = await pool.query(
    `INSERT INTO "Usuarios" (cedula, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, telefono, email, password_hash, id_rol, id_consultorio, id_servicio, id_especialidad, id_sede, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
     RETURNING id_usuario`,
    [data.cedula, data.primer_nombre, data.segundo_nombre, data.primer_apellido, data.segundo_apellido, data.telefono, data.email, data.password_hash, idRol, data.id_consultorio, data.id_servicio, data.id_especialidad, data.sede, data.status],
  );
  const idUsuario = result.rows[0].id_usuario;
  await sincronizarEspecialidades(idUsuario, data.especialidades, data.especialidadesInactivas);
  return result.rows[0];
};

/**
 * Sincroniza las especialidades de un usuario en la tabla puente
 * "Usuario_Especialidad": borra las actuales y guarda las nuevas.
 * La especialidad PRINCIPAL (Usuarios.id_especialidad) no se toca aquí.
 *
 * @param {number} idUsuario - ID del usuario
 * @param {Array<number>|null|undefined} especialidades - IDs de especialidades
 */
const sincronizarEspecialidades = async (idUsuario, especialidades, especialidadesInactivas) => {
  if (idUsuario === null || idUsuario === undefined) return;
  await pool.query('DELETE FROM "Usuario_Especialidad" WHERE id_usuario = $1', [idUsuario]);
  const valores = Array.isArray(especialidades)
    ? [...new Set(especialidades.map(Number).filter(Boolean))]
    : [];
  const inactivas = new Set((Array.isArray(especialidadesInactivas) ? especialidadesInactivas : []).map(Number));
  for (const espId of valores) {
    await pool.query(
      'INSERT INTO "Usuario_Especialidad" (id_usuario, id_especialidad, activo) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
      [idUsuario, espId, !inactivas.has(espId)],
    );
  }
};

const actualizarPersonal = async (id, sede, fields) => {
  const keys = Object.keys(fields);
  const sets = [];
  const values = [];
  let idx = 1;

  // "especialidades" (array) no es una columna: se sincroniza en la tabla
  // puente después del UPDATE. Lo mismo para "especialidades_inactivas".
  let especialidades = null;
  let especialidadesInactivas = null;
  if (fields.especialidades !== undefined) {
    especialidades = fields.especialidades;
    delete fields.especialidades;
  }
  if (fields.especialidades_inactivas !== undefined) {
    especialidadesInactivas = fields.especialidades_inactivas;
    delete fields.especialidades_inactivas;
  }

  for (const key of keys) {
    if (key === 'especialidades') continue;
    if (key === 'rol') {
      // El rol debe resolverse en la sede NUEVA del usuario (si viene en el
      // mismo guardado) y no en la sede del admin que edita: si se usaba la
      // sede del admin, al cambiarle la sede al usuario quedaba id_sede de
      // una sede e id_rol de otra, y los permisos del sidebar correspondían
      // al rol de la sede equivocada.
      const sedeDelRol = fields.id_sede !== undefined && fields.id_sede !== null
        ? Number(fields.id_sede)
        : sede;
      const rolRes = await pool.query('SELECT id_rol FROM "Roles" WHERE key = $1 AND id_sede = $2', [fields.rol, sedeDelRol]);
      const idRol = rolRes.rows[0]?.id_rol;
      if (idRol) {
        sets.push(`id_rol = $${idx++}`);
        values.push(idRol);
      }
      continue;
    }
    sets.push(`"${key}" = $${idx++}`);
    values.push(fields[key]);
  }

  values.push(id, sede);
  await pool.query(
    `UPDATE "Usuarios" SET ${sets.join(', ')} WHERE id_usuario = $${idx++} AND id_sede = $${idx}`,
    values,
  );

  if (especialidades !== null) {
    await sincronizarEspecialidades(id, especialidades, especialidadesInactivas);
  }
};

/**
 * Elimina un usuario de forma segura, en una transacción.
 *
 * El borrado es complejo porque "Usuarios" tiene claves foráneas hacia ella:
 * se limpian/neutralizan los registros relacionados (refresh tokens, auditoría,
 * códigos de recuperación y referencias en "Atencion") antes de borrar.
 *
 * @param {number} id - ID del usuario a eliminar
 * @param {number} sede - Sede del usuario (filtro de seguridad adicional)
 * @returns {Promise<boolean>} true si se eliminó algún registro
 */
const eliminarPersonal = async (id, sede) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 0. Se eliminan los refresh tokens primero (restricción de FK)
    await client.query('DELETE FROM "Refresh_Tokens" WHERE id_usuario = $1', [id]);

    // 0.1 Se anulan las referencias en el log de auditoría (se conserva el histórico)
    await client.query('UPDATE "Audit_Log" SET id_usuario = NULL WHERE id_usuario = $1', [id]);

    // 1. Códigos de recuperación de contraseña pendientes
    await client.query('DELETE FROM "Recuperacion_Clave" WHERE id_usuario = $1', [id]);
    
    // 2 y 3. En "Atencion" el usuario puede aparecer como médico o como quien registró;
    // se dejan en NULL para conservar la atención (no borrar histórico médico).
    await client.query('UPDATE "Atencion" SET id_medico = NULL WHERE id_medico = $1', [id]);
    await client.query('UPDATE "Atencion" SET id_usuario_registro = NULL WHERE id_usuario_registro = $1', [id]);
    
    // 4. Finalmente se elimina el usuario
    const result = await client.query(
      'DELETE FROM "Usuarios" WHERE id_usuario = $1 AND id_sede = $2 RETURNING id_usuario',
      [id, sede]
    );
    
    await client.query('COMMIT');
    return result.rowCount > 0;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  findByCedulas,
  findByCedula,
  findById,
  findManyByCedula,
  findByCedulaSimple,
  findByCedulaSede,
  actualizarSesionToken,
  updatePasswordByCedula,
  updatePassword,
  findByCedulaAndEmail,
  deleteByCedula,
  insertAdmin,
  getPersonal,
  crearPersonal,
  actualizarPersonal,
  eliminarPersonal,
  sincronizarEspecialidades,
};
