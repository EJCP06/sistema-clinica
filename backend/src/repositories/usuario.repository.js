const pool = require('../config/db');

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
           u.primer_nombre AS nombre, u.primer_apellido AS apellido,
           u.id_servicio as servicio_id, u.id_consultorio as consultorio_id, u.id_sede,
           u.id_especialidad, e.nombre as especialidad_nombre,
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
    WHERE u.cedula = $1
  `, [cedula]);
  return result.rows[0] || null;
};

const findManyByCedula = async (cedula) => {
  const result = await pool.query(`
    SELECT u.id_usuario as id, u.cedula, u.password_hash, r.key as rol, u.id_rol,
           u.primer_nombre AS nombre, u.primer_apellido AS apellido,
           u.id_servicio as servicio_id, u.id_consultorio as consultorio_id, u.id_sede,
           u.id_especialidad, e.nombre as especialidad_nombre,
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
           u.primer_nombre AS nombre, u.primer_apellido AS apellido,
           u.id_servicio as servicio_id, u.id_consultorio as consultorio_id, u.id_sede,
           u.id_especialidad, e.nombre as especialidad_nombre,
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
      u.fecha_creacion, c.nombre AS consultorio_nombre, s.nombre_servicio AS servicio_nombre
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
  return result.rows[0];
};

const actualizarPersonal = async (id, sede, fields) => {
  const keys = Object.keys(fields);
  const sets = [];
  const values = [];
  let idx = 1;

  for (const key of keys) {
    if (key === 'rol') {
      const rolRes = await pool.query('SELECT id_rol FROM "Roles" WHERE key = $1 AND id_sede = $2', [fields.rol, sede]);
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
};

const eliminarPersonal = async (id, sede) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 0. Delete refresh tokens first (FK constraint)
    await client.query('DELETE FROM "Refresh_Tokens" WHERE id_usuario = $1', [id]);

    // 0.1 Nullify audit log references
    await client.query('UPDATE "Audit_Log" SET id_usuario = NULL WHERE id_usuario = $1', [id]);

    // 1. Delete from "Recuperacion_Clave"
    await client.query('DELETE FROM "Recuperacion_Clave" WHERE id_usuario = $1', [id]);
    
    // 2. Set id_medico to NULL in "Atencion"
    await client.query('UPDATE "Atencion" SET id_medico = NULL WHERE id_medico = $1', [id]);
    
    // 3. Set id_usuario_registro to NULL in "Atencion"
    await client.query('UPDATE "Atencion" SET id_usuario_registro = NULL WHERE id_usuario_registro = $1', [id]);
    
    // 4. Finally delete the user from "Usuarios"
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
};
