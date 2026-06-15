const logger = require('../config/logger');
const pool = require('../config/db');
const permissionSets = require('../config/permission-sets');

const LEGACY_KEY_MAP = {
  // ... (mantener LEGACY_KEY_MAP existente)
  admin_panel: 'admin:panel',
  ver_reportes: 'reportes:ver',
  admision_crear: 'admision:crear',
  admision_editar: 'admision:editar',
  admision_eliminar: 'admision:eliminar',
  admision_asignar_turno: 'admision:asignar_turno',
  aps_enviar_presupuesto: 'aps:enviar_presupuesto',
  aps_solicitar_clave: 'aps:solicitar_clave',
  aps_enviar_sala_espera: 'aps:enviar_sala_espera',
  aps_aprobar_clave: 'aps:aprobar_clave',
  aps_reincorporar: 'aps:reincorporar',
  laboratorio_registrar_caja: 'laboratorio:registrar_caja',
  laboratorio_pasar_sala_espera: 'laboratorio:pasar_sala_espera',
  laboratorio_marcar_ausente: 'laboratorio:marcar_ausente',
  laboratorio_reincorporar: 'laboratorio:reincorporar',
  imagenes_registrar_caja: 'imagenes:registrar_caja',
  imagenes_pasar_sala_espera: 'imagenes:pasar_sala_espera',
  imagenes_marcar_ausente: 'imagenes:marcar_ausente',
  imagenes_reincorporar: 'imagenes:reincorporar',
  llamado_laboratorio: 'llamado:laboratorio',
  llamado_imagenes: 'llamado:imagenes',
  aseguradoras_crear: 'aseguradoras:crear',
  aseguradoras_editar: 'aseguradoras:editar',
  aseguradoras_eliminar: 'aseguradoras:eliminar',
  aseguradoras_importar_excel: 'aseguradoras:importar_excel',
  atencion_medica_llamar_siguiente: 'atencion_medica:llamar_siguiente',
  atencion_medica_liberar_consultorio: 'atencion_medica:liberar_consultorio',
  atencion_medica_iniciar: 'atencion_medica:iniciar',
  atencion_medica_marcar_ausente: 'atencion_medica:marcar_ausente',
  atencion_medica_finalizar: 'atencion_medica:finalizar',
  especialidades_crear: 'especialidades:crear',
  especialidades_editar: 'especialidades:editar',
  especialidades_eliminar: 'especialidades:eliminar',
  personal_crear: 'personal:crear',
  personal_editar: 'personal:editar',
  personal_eliminar: 'personal:eliminar',
  roles_crear: 'roles:crear',
  roles_editar: 'roles:editar',
  roles_eliminar: 'roles:eliminar',
  gestionar_permisos: 'permisologia:gestionar_permisos',
  gestionar_sedes: 'sedes:gestionar',
  gestionar_servicios: 'servicios:gestionar',
  
  admision: 'admision:*',
  ver_aps: 'aps:ver',
  ver_aseguradoras: 'aseguradoras:ver',
  laboratorio: 'laboratorio:*',
  imagenes: 'imagenes:*',
  atencion_medica: 'atencion_medica:*',
  llamar_siguiente: 'atencion_medica:llamar_siguiente',
  liberar_consultorio: 'atencion_medica:liberar_consultorio',
  marcar_ausente: '*:marcar_ausente',
  reincorporar: '*:reincorporar'
};

const permissionMiddleware = (...permisosRequeridos) => {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({ mensaje: 'No hay usuario autenticado' });
    }
    
    const permisosUsuario = req.usuario.permisos || [];
    
    // Administrador tiene acceso completo
    if (req.usuario.rol === 'administrador') return next();
    
    // Si el usuario tiene el permiso maestro, permitir todo
    if (permisosUsuario.includes('*:*')) return next();

    // Expandir conjuntos de permisos si existen en permissionSets
    const permisosExpandidos = permisosRequeridos.flatMap(p => 
      permissionSets[p] ? permissionSets[p] : p
    );

    const tienePermiso = permisosExpandidos.some(p => {
      // 1. Mapear clave legada si existe
      const mapped = LEGACY_KEY_MAP[p] || p;
      
      // 2. Si el permiso tiene formato recurso:accion
      if (mapped.includes(':')) {
        const [recReq, accReq] = mapped.split(':');
        
        return permisosUsuario.some(pUser => {
          // Si el permiso del usuario es modular (ej. 'laboratorio:reincorporar')
          if (pUser.includes(':')) {
            const [recUser, accUser] = pUser.split(':');
            
            const recMatch = (recReq === '*' || recUser === '*' || recUser === recReq);
            const accMatch = (accReq === '*' || accUser === '*' || accUser === accReq);
            
            return recMatch && accMatch;
          }
          
          // Si el permiso del usuario es legado, intentar mapearlo para comparar
          const pUserMapped = LEGACY_KEY_MAP[pUser] || pUser;

          if (pUserMapped.includes(':')) {
            const [recUser, accUser] = pUserMapped.split(':');
            const recMatch = (recReq === '*' || recUser === '*' || recUser === recReq);
            const accMatch = (accReq === '*' || accUser === '*' || accUser === accReq);
            return recMatch && accMatch;
          }
          
          return pUserMapped === mapped;
        });
      }
      
      // 3. Verificación directa para claves que no siguen el formato modular
      return permisosUsuario.includes(p) || permisosUsuario.includes(mapped);
    });

    if (!tienePermiso) {
      logger.warn(`Acceso denegado. Usuario: ${req.usuario.cedula}. Requerido: ${permisosExpandidos.join(', ')}`);
      return res.status(403).json({ mensaje: 'No tienes permisos para realizar esta acción' });
    }
    next();
  };
};

module.exports = { permissionMiddleware };