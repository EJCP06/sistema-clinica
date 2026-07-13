const logger = require('../config/logger');
const pool = require('../config/db');
const rolRepo = require('../repositories/rol.repository');
const permisoRepo = require('../repositories/permiso.repository');

const getRoles = async (req, res) => {
  try {
    const sede = req.query.sede_id ? Number(req.query.sede_id) : req.usuario?.id_sede;
    const rows = sede ? await rolRepo.getAll(sede) : await rolRepo.getAll();
    res.json(rows);
  } catch (error) {
    logger.error(error);
    res.status(500).json({ mensaje: 'Error al obtener roles' });
  }
};

const crearRol = async (req, res) => {
  try {
    let { nombre, id_sede, activo } = req.body;
    if (!nombre) return res.status(400).json({ mensaje: 'El nombre del rol es requerido' });
    const nombreLimpio = nombre.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "").toUpperCase().trim();
    const key = nombre.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "");
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
    let { nombre, id_sede, activo } = req.body;
    let nombreLimpio, key;
    if (nombre) {
      nombreLimpio = nombre.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "").toUpperCase().trim();
      key = nombre.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "");
    }
    await rolRepo.update(id, nombreLimpio, key, id_sede, activo);
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
  try {
    const { id } = req.params;
    await rolRepo.remove(id);
    res.json({ mensaje: 'Rol eliminado' });
  } catch (error) {
    logger.error('Error al eliminar rol:', error);
    if (error.code === '23503') {
      return res.status(409).json({ mensaje: 'No se puede eliminar el rol porque está asignado a uno o más usuarios' });
    }
    res.status(500).json({ mensaje: 'Error al eliminar rol' });
  }
};

const getPermisos = async (req, res) => {
  try {
    const permisos = await permisoRepo.getAll();
    res.json(permisos);
  } catch (error) {
    logger.error(error);
    res.status(500).json({ mensaje: 'Error al obtener permisos' });
  }
};

const getPermisosByRol = async (req, res) => {
  try {
    const { id } = req.params;
    const permisos = await permisoRepo.getKeysByRolId(id);
    res.json(permisos);
  } catch (error) {
    logger.error(error);
    res.status(500).json({ mensaje: 'Error al obtener permisos del rol' });
  }
};

const asignarPermisos = async (req, res) => {
  try {
    const { id } = req.params;
    const { permisos } = req.body;
    await permisoRepo.asignarPermisos(id, permisos || []);
    req.io.emit('permisos-actualizados', { id_rol: Number(id) });
    res.json({ mensaje: 'Matriz de permisos actualizada correctamente' });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ mensaje: 'Error al asignar permisos' });
  }
};

const getMatrizPermisos = async (req, res) => {
  try {
    const allPermisos = await permisoRepo.getAll();
    const recursosMap = new Map();
    const accionesBasicas = ['ver', 'crear', 'editar', 'eliminar'];
    allPermisos.forEach(p => {
      if (!p.key.includes(':')) return;
      const [recKey, accKey] = p.key.split(':');
      if (!recursosMap.has(recKey)) {
        recursosMap.set(recKey, { key: recKey, nombre: p.nombre.split(' - ')[0], descripcion: p.descripcion ? p.descripcion.split(' / ')[0] : '', acciones: [] });
      }
      recursosMap.get(recKey).acciones.push(accKey || '*');
    });
    res.json({ recursos: Array.from(recursosMap.values()), accionesBasicas });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ mensaje: 'Error al obtener matriz de permisos' });
  }
};

const recargarCachePermisos = async (req, res) => {
  try {
    res.json({ mensaje: 'Caché de permisos recargada' });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ mensaje: 'Error al recargar caché de permisos' });
  }
};

const seedPermisosAdmin = async (req, res) => {
  try {
    const sede = req.usuario?.id_sede || 1;
    const rolRes = await pool.query('SELECT id_rol FROM "Roles" WHERE key = $1 AND id_sede = $2', ['administrador', sede]);
    if (rolRes.rows.length === 0) {
      return res.status(404).json({ mensaje: 'No se encontró el rol administrador para esta sede' });
    }
    const idRol = rolRes.rows[0].id_rol;
    const recursos = ['admision', 'aps', 'laboratorio', 'imagenes', 'atencion_medica', 'aseguradoras', 'personal', 'roles', 'especialidades', 'permisologia'];
    const permisos = recursos.map(r => `${r}:*`);
    await permisoRepo.asignarPermisos(idRol, permisos);
    res.json({ mensaje: 'Permisos de administrador sembrados correctamente. Vuelve a iniciar sesión.' });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ mensaje: 'Error al sembrar permisos' });
  }
};

module.exports = { getRoles, crearRol, actualizarRol, eliminarRol, getPermisos, getPermisosByRol, asignarPermisos, getMatrizPermisos, recargarCachePermisos, seedPermisosAdmin };
