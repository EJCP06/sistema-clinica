const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const logger = require('../config/logger');
const pool = require('../config/db');
const atencionRepo = require('../repositories/atencion.repository');
const servicioRepo = require('../repositories/servicio.repository');
const consultorioRepo = require('../repositories/consultorio.repository');
const sharedRepo = require('../repositories/shared.repository');
const usuarioRepo = require('../repositories/usuario.repository');
const rolRepo = require('../repositories/rol.repository');
const permisoRepo = require('../repositories/permiso.repository');
const { ACCIONES_ESPECIALES_POR_VISTA, ACCIONES_ESPECIALES_GLOBALES } = require('../config/acciones-especiales');

/* =========================================================
   UTILIDAD SEGURA (EVITA 500 POR req.usuario UNDEFINED)
========================================================= */
const getSede = (req, res) => {
  const sede = req.usuario?.id_sede;
  const rol = req.usuario?.rol;
  console.log(`DEBUG: Usuario ${req.usuario?.cedula} (Rol: ${rol}) accediendo a Sede: ${sede}`);
  
  if (sede === undefined || sede === null) {
    res.status(401).json({ mensaje: 'Token inválido o sin sede' });
    return null;
  }
  return Number(sede);
};

/* =========================================================
   REPORTES
========================================================= */

const getReporteDiario = async (req, res) => {
  const sede = getSede(req, res);
  if (!sede) return;

  try {
    const rows = await atencionRepo.getReporteDiario(sede);

    const turnos = rows.map((r) => ({
      id: r.id,
      numero: r.numero,
      estado: r.estado,
      hora_llegada: r.hora_llegada,
      hora_fin: r.hora_fin,
      servicio_nombre: r.servicio,
      especialidad: r.especialidad,
      consultorio: r.consultorio,
      medico_nombre: r.medico_nombre,
      medico_apellido: r.medico_apellido,
      hora_inicio_atencion: r.hora_inicio_atencion,
      hora_fin_atencion: r.hora_fin_atencion,
      id_sede: r.id_sede,
      paciente: {
        nombre: r.paciente_nombre,
        apellido: r.paciente_apellido,
        documento: r.paciente_documento,
        telefono: r.paciente_telefono,
      },
    }));

    const atendidos = turnos.filter((t) => t.estado === 'Atendido');
    const ausentes = turnos.filter((t) => t.estado === 'Ausente');
    const enEspera = turnos.filter(
      (t) => t.estado === 'Sala de Espera' || t.estado === 'Llamado',
    );
    const enAtencion = turnos.filter((t) => t.estado === 'En Atencion');
    const registrados = turnos.filter((t) => t.estado === 'Registrado');

    // Calcular KPIs
    const turnosConEspera = turnos.filter(t => t.hora_inicio_atencion && t.hora_llegada);
    const tiempoPromedioEspera = turnosConEspera.length > 0
      ? Math.round(turnosConEspera.reduce((sum, t) => {
          const inicio = new Date(t.hora_inicio_atencion);
          const llegada = new Date(t.hora_llegada);
          return sum + (inicio - llegada) / 60000;
        }, 0) / turnosConEspera.length)
      : 0;

    const turnosConAtencion = turnos.filter(t => t.hora_fin_atencion && t.hora_inicio_atencion);
    const tiempoPromedioAtencion = turnosConAtencion.length > 0
      ? Math.round(turnosConAtencion.reduce((sum, t) => {
          const fin = new Date(t.hora_fin_atencion);
          const inicio = new Date(t.hora_inicio_atencion);
          return sum + (fin - inicio) / 60000;
        }, 0) / turnosConAtencion.length)
      : 0;

    // Agrupado por servicio
    const porServicio = {};
    turnos.forEach(t => {
      const key = t.servicio_nombre;
      if (!porServicio[key]) {
        porServicio[key] = { servicio: key, total: 0, atendidos: 0, ausentes: 0, en_espera: 0, en_atencion: 0, registrados: 0 };
      }
      porServicio[key].total++;
      if (t.estado === 'Atendido') porServicio[key].atendidos++;
      else if (t.estado === 'Ausente') porServicio[key].ausentes++;
      else if (t.estado === 'Sala de Espera' || t.estado === 'Llamado') porServicio[key].en_espera++;
      else if (t.estado === 'En Atencion') porServicio[key].en_atencion++;
      else if (t.estado === 'Registrado') porServicio[key].registrados++;
    });

    // Lista de ausentes con detalles
    const listaAusentes = ausentes.map(t => ({
      numero: t.numero,
      paciente_nombre: t.paciente.nombre,
      paciente_apellido: t.paciente.apellido,
      paciente_documento: t.paciente.documento,
      servicio: t.servicio_nombre,
      especialidad: t.especialidad,
      hora_llegada: t.hora_llegada,
    }));

    res.json({
      total: turnos.length,
      turnos,
      estadisticas: {
        atendidos: atendidos.length,
        ausentes: ausentes.length,
        en_espera: enEspera.length,
        en_atencion: enAtencion.length,
        registrados: registrados.length,
      },
      kpis: {
        tiempo_promedio_espera_min: tiempoPromedioEspera,
        tiempo_promedio_atencion_min: tiempoPromedioAtencion,
        ausentismo_porcentaje: turnos.length > 0 ? Math.round((ausentes.length / turnos.length) * 100) : 0,
      },
      por_servicio: Object.values(porServicio),
      ausentes: listaAusentes,
    });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ mensaje: 'Error interno al generar el reporte diario' });
  }
};

/* =========================================================
   SERVICIOS
========================================================= */

const getServicios = async (req, res) => {
  const sede = getSede(req, res);
  if (!sede) return;

  try {
    const rows = await servicioRepo.getAll(sede);
    res.json(rows);
  } catch (error) {
    logger.error(error);
    res.status(500).json({ mensaje: 'Error al obtener servicios' });
  }
};

const crearServicio = async (req, res) => {
  try {
    let { nombre, prefijo, piso, activo } = req.body;

    await servicioRepo.create(nombre, prefijo, piso, activo);
    res.status(201).json({ mensaje: 'Servicio creado' });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ mensaje: 'Error al crear servicio' });
  }
};

const actualizarServicio = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, prefijo, piso, activo } = req.body;

    await servicioRepo.update(id, nombre, prefijo, piso, activo);
    res.json({ mensaje: 'Servicio actualizado' });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ mensaje: 'Error al actualizar servicio' });
  }
};

const eliminarServicio = async (req, res) => {
  try {
    await servicioRepo.remove(req.params.id);
    res.json({ mensaje: 'Servicio eliminado' });
  } catch (error) {
    logger.error(error);
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
    const rows = await consultorioRepo.getConsultoriosBySede(sede);
    res.json(rows);
  } catch (error) {
    logger.error(error);
    res.status(500).json({ mensaje: 'Error al obtener consultorios' });
  }
};

const crearConsultorio = async (req, res) => {
  const sede = getSede(req, res);
  if (!sede) return;

  try {
    const { nombre } = req.body;
    await consultorioRepo.createConsultorio(nombre, sede);
    res.json({ mensaje: 'Consultorio creado' });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ mensaje: 'Error al crear consultorio' });
  }
};

const actualizarConsultorio = async (req, res) => {
  const sede = getSede(req, res);
  if (!sede) return;

  try {
    const { id } = req.params;
    const { nombre } = req.body;

    await consultorioRepo.updateConsultorio(id, sede, nombre);
    res.json({ mensaje: 'Consultorio actualizado' });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ mensaje: 'Error al actualizar consultorio' });
  }
};

const eliminarConsultorio = async (req, res) => {
  const sede = getSede(req, res);
  if (!sede) return;

  try {
    await consultorioRepo.deleteConsultorio(req.params.id, sede);
    res.json({ mensaje: 'Consultorio eliminado' });
  } catch (error) {
    logger.error(error);
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
    const rows = await sharedRepo.getSedes();
    res.json(rows);
  } catch (error) {
    logger.error(error);
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
    const { rol } = req.query;
    const rows = await usuarioRepo.getPersonal(sede, rol);
    res.json(rows);
  } catch (error) {
    logger.error(error);
    res.status(500).json({ mensaje: 'Error al obtener personal' });
  }
};

const crearPersonal = async (req, res) => {
  const sedeToken = getSede(req, res);
  if (!sedeToken) return;

  try {
    const {
      cedula,
      primer_nombre,
      segundo_nombre,
      primer_apellido,
      segundo_apellido,
      telefono,
      email,
      password,
      rol,
      piso,
      id_consultorio,
      id_servicio,
      id_especialidad,
      username,
      status,
      id_sede,
    } = req.body;

    if (!cedula || !primer_nombre || !rol) {
      return res.status(400).json({ mensaje: 'Cédula, nombre y rol son requeridos' });
    }

    const sedeFinal = id_sede ? Number(id_sede) : sedeToken;

    const existe = await usuarioRepo.findByCedulaSede(cedula, sedeFinal);
    if (existe) {
      return res.status(409).json({ mensaje: 'Ya existe un usuario con esa cédula en esta sede' });
    }

    const password_hash = password ? await bcrypt.hash(password, 10) : await bcrypt.hash(crypto.randomBytes(6).toString('hex'), 10);
    const emailFinal = email ? email.toLowerCase().trim() : null;

    const result = await usuarioRepo.crearPersonal({
      cedula,
      primer_nombre,
      segundo_nombre: segundo_nombre || null,
      primer_apellido: primer_apellido || '',
      segundo_apellido: segundo_apellido || null,
      telefono: telefono || '',
      email: emailFinal,
      password_hash,
      rol,
      piso: piso || null,
      id_consultorio: id_consultorio || null,
      id_servicio: id_servicio || null,
      id_especialidad: id_especialidad || null,
      sede: sedeFinal,
      status: status !== false,
    });

    res.status(201).json({ mensaje: 'Personal creado', id: result.id_usuario });
  } catch (error) {
    logger.error(error);
    if (error.code === '23505') {
      return res.status(409).json({ mensaje: 'Ya existe un usuario con esa cédula' });
    }
    res.status(500).json({ mensaje: 'Error al crear personal' });
  }
};

const actualizarPersonal = async (req, res) => {
  const sede = getSede(req, res);
  if (!sede) return;

  try {
    const { id } = req.params;
    const {
      cedula,
      primer_nombre,
      segundo_nombre,
      primer_apellido,
      segundo_apellido,
      telefono,
      email,
      password,
      rol,
      piso,
      id_consultorio,
      id_servicio,
      id_especialidad,
      status,
      id_sede,
    } = req.body;

    const sets = [];
    const values = [];
    let idx = 1;

    if (cedula !== undefined) {
      sets.push(`cedula = $${idx++}`);
      values.push(cedula);
    }
    if (primer_nombre !== undefined) {
      sets.push(`primer_nombre = $${idx++}`);
      values.push(primer_nombre);
    }
    if (segundo_nombre !== undefined) {
      sets.push(`segundo_nombre = $${idx++}`);
      values.push(segundo_nombre);
    }
    if (primer_apellido !== undefined) {
      sets.push(`primer_apellido = $${idx++}`);
      values.push(primer_apellido);
    }
    if (segundo_apellido !== undefined) {
      sets.push(`segundo_apellido = $${idx++}`);
      values.push(segundo_apellido);
    }
    if (telefono !== undefined) {
      sets.push(`telefono = $${idx++}`);
      values.push(telefono);
    }
    if (email !== undefined) {
      sets.push(`email = $${idx++}`);
      values.push(email ? email.toLowerCase().trim() : null);
    }
    if (password) {
      sets.push(`password_hash = $${idx++}`);
      values.push(await bcrypt.hash(password, 10));
    }
    if (rol !== undefined) {
      sets.push(`rol = $${idx++}`);
      values.push(rol);
    }
    if (piso !== undefined) {
      sets.push(`piso = $${idx++}`);
      values.push(piso);
    }
    if (id_consultorio !== undefined) {
      sets.push(`id_consultorio = $${idx++}`);
      values.push(id_consultorio);
    }
    if (id_servicio !== undefined) {
      sets.push(`id_servicio = $${idx++}`);
      values.push(id_servicio);
    }
    if (id_especialidad !== undefined) {
      sets.push(`id_especialidad = $${idx++}`);
      values.push(id_especialidad);
    }
    if (id_sede !== undefined) {
      sets.push(`id_sede = $${idx++}`);
      values.push(Number(id_sede));
    }
    if (status !== undefined) {
      sets.push(`status = $${idx++}`);
      values.push(status);
    }

    if (sets.length === 0) {
      return res.status(400).json({ mensaje: 'No hay campos para actualizar' });
    }

    await usuarioRepo.actualizarPersonal(id, sede, sets, values, idx);

    // Si el usuario fue desactivado, notificar en tiempo real a su sesión activa
    if (status === false && req.io) {
      for (const socket of req.io.sockets.sockets.values()) {
        if (socket.usuario && Number(socket.usuario.id) === Number(id)) {
          socket.emit('usuario-desactivado');
          break;
        }
      }
    }

    res.json({ mensaje: 'Personal actualizado' });
  } catch (error) {
    logger.error(error);
    if (error.code === '23505') {
      return res.status(409).json({ mensaje: 'Ya existe un usuario con esa cédula' });
    }
    res.status(500).json({ mensaje: 'Error al actualizar personal' });
  }
};

const eliminarPersonal = async (req, res) => {
  const sede = getSede(req, res);
  if (!sede) return;

  try {
    const { id } = req.params;

    const eliminado = await usuarioRepo.eliminarPersonal(id, sede);
    if (!eliminado) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }

    res.json({ mensaje: 'Personal eliminado' });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ mensaje: 'Error al eliminar personal' });
  }
};

/* =========================================================
   IMPORTAR PERSONAL (Excel)
========================================================= */

const importarPersonal = async (req, res) => {
  const sedeToken = getSede(req, res);
  if (!sedeToken) return;

  const { rows, rol: rolGlobal } = req.body;
  if (!rows || !Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ mensaje: 'No hay datos para importar' });
  }

  let importados = 0;
  let omitidos = 0;
  let errores = 0;

  // Obtener cédulas existentes para evitar duplicados
  const cedulasExcel = rows.map(r =>
    String(r.cedula || r.Cedula || r.CÉDULA || r.documento || r.Documento || '').replace(/\D/g, '')
  ).filter(c => c);
  const existentes = await usuarioRepo.findByCedulas(cedulasExcel);
  const cedulasExistentes = new Set(existentes.map((u) => u.cedula));

  // Auxiliar para normalizar roles (ej: "Médico" -> "medico")
  const normalizarRol = (r) => {
    if (!r) return null;
    return String(r).toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "")
      .trim();
  };

  for (const row of rows) {
    try {
      const cedula = String(row.cedula || row.Cedula || row.CÉDULA || row.documento || row.Documento || '').replace(/\D/g, '');
      const telefono = (row.telefono || row.Teléfono || row.TELEFONO || row.Telefono || row.telefono || '').toString().replace(/\D/g, '');
      const email = (row.email || row.Email || row.EMAIL || row.correo || row.Correo || '').toString().toLowerCase().trim() || null;
      const piso = row.piso || row.Piso || row.PISO || null;

      let primerNombre, segundoNombre, primerApellido, segundoApellido;

      if (row.primer_nombre) {
        primerNombre = (row.primer_nombre || '').toString().toUpperCase().trim();
        segundoNombre = (row.segundo_nombre || '').toString().toUpperCase().trim() || null;
        primerApellido = (row.primer_apellido || '').toString().toUpperCase().trim();
        segundoApellido = (row.segundo_apellido || '').toString().toUpperCase().trim() || null;
      } else {
        const nombre = (row.nombre || row.Nombre || row.NOMBRE || '').toString().toUpperCase().trim();
        const apellido = (row.apellido || row.Apellido || row.APELLIDO || '').toString().toUpperCase().trim();
        const [pn, ...rn] = nombre.split(' ');
        const [pa, ...ra] = apellido.split(' ');
        primerNombre = pn;
        segundoNombre = rn.join(' ') || null;
        primerApellido = pa;
        segundoApellido = ra.join(' ') || null;
      }

      const rolFila = row.rol || row.Rol || row.ROL || row.puesto || row.Puesto || row.cargo || row.Cargo || null;
      const rolFinal = normalizarRol(rolFila) || normalizarRol(rolGlobal) || 'medico';

      if (!cedula || !primerNombre) {
        errores++;
        continue;
      }

      if (cedulasExistentes.has(cedula)) {
        omitidos++;
        continue;
      }

      const password_hash = await bcrypt.hash(crypto.randomBytes(6).toString('hex'), 10);
      const sedeFinal = row.id_sede || row.sede || sedeToken;
      const idConsultorio = row.id_consultorio || row.consultorio_id || null;
      const idServicio = row.id_servicio || row.servicio_id || null;
      const idEspecialidad = row.id_especialidad || row.especialidad_id || null;

      await usuarioRepo.crearPersonal({
        cedula,
        primer_nombre: primerNombre,
        segundo_nombre: segundoNombre,
        primer_apellido: primerApellido || '',
        segundo_apellido: segundoApellido,
        telefono: telefono || '',
        email: email || null,
        password_hash,
        rol: rolFinal,
        piso: piso ? String(piso) : null,
        id_consultorio: idConsultorio ? Number(idConsultorio) : null,
        id_servicio: idServicio ? Number(idServicio) : null,
        id_especialidad: idEspecialidad ? Number(idEspecialidad) : null,
        sede: Number(sedeFinal),
        status: row.status !== undefined ? !!row.status : true,
      });
      importados++;
    } catch (error) {
      logger.error('Error al importar personal:', { error: error.message, row });
      errores++;
    }
  }

  res.json({
    mensaje: `Importación completada: ${importados},\n${omitidos} ya existían, ${errores} errores`,
    importados,
    omitidos,
    errores,
  });
};

/* =========================================================
   ROLES
========================================================= */

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
    let { nombre, id_sede, activo } = req.body;
    if (!nombre) {
      return res.status(400).json({ mensaje: 'El nombre del rol es requerido' });
    }

    // Nombre: MAYÚSCULAS, sin acentos, sin espacios
    const nombreLimpio = nombre
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // remover acentos
      .replace(/\s+/g, "")             // remover espacios
      .toUpperCase()
      .trim();
    
    // Generar Key automáticamente: minúsculas, sin acentos, con guiones bajos para legibilidad en código
    const key = nombre.toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "");

    // Verificar si ya existe un rol con esta clave PARA ESTA SEDE
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
    console.log('Intentando eliminar rol ID:', id);
    await rolRepo.remove(id);
    res.json({ mensaje: 'Rol eliminado' });
  } catch (error) {
    console.error('Error al eliminar rol, detalles:', error);
    logger.error('Error al eliminar rol:', error);
    if (error.code === '23503') {
      return res.status(409).json({ mensaje: 'No se puede eliminar el rol porque está asignado a uno o más usuarios' });
    }
    res.status(500).json({ mensaje: 'Error al eliminar rol' });
  }
};

module.exports = {
  getReporteDiario,

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
  importarPersonal,

  getRoles,
  crearRol,
  actualizarRol,
  eliminarRol,

  // =============================================
  // PERMISOS
  // =============================================
  getPermisos: async (req, res) => {
    try {
      const permisos = await permisoRepo.getAll();
      res.json(permisos);
    } catch (error) {
      logger.error(error);
      res.status(500).json({ mensaje: 'Error al obtener permisos' });
    }
  },

  getPermisosByRol: async (req, res) => {
    try {
      const { id } = req.params;
      const permisos = await permisoRepo.getKeysByRolId(id);
      res.json(permisos);
    } catch (error) {
      logger.error(error);
      res.status(500).json({ mensaje: 'Error al obtener permisos del rol' });
    }
  },

  asignarPermisos: async (req, res) => {
    try {
      const { id } = req.params;
      const { permisos } = req.body;
      await permisoRepo.asignarPermisos(id, permisos || []);
      
      // Emitir evento de socket para avisar a los clientes
      req.io.emit('permisos-actualizados', { id_rol: Number(id) });
      
      res.json({ mensaje: 'Matriz de permisos actualizada correctamente' });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ mensaje: 'Error al asignar permisos' });
    }
  },

  getMatrizPermisos: async (req, res) => {
    try {
      const allPermisos = await permisoRepo.getAll();
      
      const recursosMap = new Map();
      const accionesBasicas = ['ver', 'crear', 'editar', 'eliminar'];

      allPermisos.forEach(p => {
        if (!p.key.includes(':')) return;
        
        const [recKey, accKey] = p.key.split(':');
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
  },

  recargarCachePermisos: async (req, res) => {
    try {
      res.json({ mensaje: 'Caché de permisos recargada' });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ mensaje: 'Error al recargar caché de permisos' });
    }
  },

  seedPermisosAdmin: async (req, res) => {
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
  },
};

