const logger = require('../config/logger');
const pool = require('../config/db');
const permisoRepo = require('../repositories/permiso.repository');
const permissionSets = require('../config/permission-sets');
const { VISIBLES_ADMIN, INMUTABLES_ADMIN } = require('./admin.helpers');

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

    const rolRes = await pool.query('SELECT key FROM "Roles" WHERE id_rol = $1', [id]);
    const esAdmin = rolRes.rows.length > 0 && rolRes.rows[0].key === 'administrador';

    let permisosFinales = permisos || [];

    if (esAdmin) {
      permisosFinales = permisosFinales.filter(k => {
        const mod = String(k).split(':')[0];
        return VISIBLES_ADMIN.has(mod);
      });
      INMUTABLES_ADMIN.forEach(m => permisosFinales.push(`${m}:*`));
    }

    await permisoRepo.asignarPermisos(id, permisosFinales);

    const esMiRol = req.usuario?.id_rol && Number(req.usuario.id_rol) === Number(id);
    if (!esMiRol) {
      req.io.emit('permisos-actualizados', { id_rol: Number(id) });
    }

    res.json({ mensaje: 'Matriz de permisos actualizada correctamente' });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ mensaje: 'Error al asignar permisos' });
  }
};

const getMatrizPermisos = async (req, res) => {
  try {
    const allPermisos = await permisoRepo.getAll();

    const recursosVisibles = new Set([
      'admision', 'aps', 'laboratorio', 'imagenes', 'atencion_medica', 'aseguradoras', 'especialidades'
    ]);

    const recursosMap = new Map();
    const accionesBasicas = ['ver', 'crear', 'editar', 'eliminar'];

    allPermisos.forEach(p => {
      if (!p.key.includes(':')) return;

      const [recKey, accKey] = p.key.split(':');
      if (!recursosVisibles.has(recKey)) return;

      if (!recursosMap.has(recKey)) {
        recursosMap.set(recKey, {
          key: recKey,
          nombre: p.nombre.split(' - ')[0],
          descripcion: p.descripcion ? p.descripcion.split(' / ')[0] : '',
          acciones: []
        });
      }
      recursosMap.get(recKey).acciones.push(accKey || '*');
    });

    res.json({
      recursos: Array.from(recursosMap.values()),
      accionesBasicas
    });
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
    const recursos = permissionSets.RECURSOS_ADMIN;
    const permisos = recursos.map(r => `${r}:*`);
    await permisoRepo.asignarPermisos(idRol, permisos);
    res.json({ mensaje: 'Permisos de administrador sembrados correctamente. Vuelve a iniciar sesión.' });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ mensaje: 'Error al sembrar permisos' });
  }
};

module.exports = {
  getPermisos,
  getPermisosByRol,
  asignarPermisos,
  getMatrizPermisos,
  recargarCachePermisos,
  seedPermisosAdmin,
};
