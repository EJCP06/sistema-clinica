const logger = require('../config/logger');
const pool = require('../config/db');
const rolRepo = require('../repositories/rol.repository');

const getRoles = async (req, res) => {
  try {
    const sede = req.query.sede_id ? Number(req.query.sede_id) : req.usuario?.id_sede;
    const rows = sede
      ? await rolRepo.getAll(sede)
      : await rolRepo.getAll();
    res.json(rows);
  } catch (error) {
    logger.error(error);
    res.status(500).json({ mensaje: 'Error al obtener roles' });
  }
};

const crearRol = async (req, res) => {
  try {
    const { nombre, id_sede, activo } = req.body;
    if (!nombre) {
      return res.status(400).json({ mensaje: 'El nombre del rol es requerido' });
    }

    const nombreLimpio = nombre
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "")
      .toUpperCase()
      .trim();

    const key = nombre.toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "");

    if (await rolRepo.existsKeyForSede(key, id_sede || null)) {
      return res.status(409).json({ mensaje: 'Ya existe un rol con esta clave para esta sede' });
    }

    await rolRepo.create(nombreLimpio, key, id_sede, activo);
    res.status(201).json({ mensaje: 'Rol creado' });
  } catch (error) {
    logger.error(error);
    if (error.code === '23505') {
      return res.status(409).json({ mensaje: 'Ya existe un rol con este nombre o clave' });
    }
    res.status(500).json({ mensaje: 'Error al crear rol' });
  }
};

const actualizarRol = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, id_sede, activo } = req.body;

    let nombreLimpio = undefined;
    let key = undefined;

    if (nombre) {
      nombreLimpio = nombre
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, "")
        .toUpperCase()
        .trim();

      key = nombre.toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_+|_+$/g, "");
    }

    const rolAntes = await rolRepo.getById(id);
    await rolRepo.update(id, nombreLimpio, key, id_sede, activo);

    if (activo === false && rolAntes && rolAntes.activo !== false && req.io) {
      const sockets = await req.io.fetchSockets();
      for (const socket of sockets) {
        if (socket.usuario && Number(socket.usuario.id_rol) === Number(id)) {
          socket.emit('rol-desactivado');
        }
      }
    }

    res.json({ mensaje: 'Rol actualizado' });
  } catch (error) {
    logger.error(error);
    if (error.code === '23505') {
      return res.status(409).json({ mensaje: 'Ya existe un rol con este nombre o clave' });
    }
    res.status(500).json({ mensaje: 'Error al actualizar rol' });
  }
};

const eliminarRol = async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  let usuariosDesactivados = [];
  try {
    await client.query('BEGIN');

    const usersRes = await client.query(
      'SELECT id_usuario FROM "Usuarios" WHERE id_rol = $1',
      [id]
    );
    usuariosDesactivados = usersRes.rows.map((r) => Number(r.id_usuario));

    if (usuariosDesactivados.length > 0) {
      await client.query(
        'UPDATE "Usuarios" SET status = false, id_rol = NULL WHERE id_rol = $1',
        [id]
      );
    }

    await client.query('DELETE FROM "Roles" WHERE id_rol = $1', [id]);

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error al eliminar rol:', error);
    if (error.code === '23503') {
      return res.status(409).json({ mensaje: 'No se puede eliminar el rol porque está asignado a uno o más usuarios' });
    }
    return res.status(500).json({ mensaje: 'Error al eliminar rol' });
  } finally {
    client.release();
  }

  if (usuariosDesactivados.length > 0 && req.io) {
    try {
      const sockets = await req.io.fetchSockets();
      for (const socket of sockets) {
        if (socket.usuario && usuariosDesactivados.includes(Number(socket.usuario.id))) {
          socket.emit('rol-desactivado');
          socket.disconnect(true);
        }
      }
    } catch { /* Si fetchSockets falla, los usuarios ya quedaron desactivados en BD */ }
  }

  res.json({
    mensaje: 'Rol eliminado',
    desactivados: usuariosDesactivados.length,
  });
};

module.exports = { getRoles, crearRol, actualizarRol, eliminarRol };
