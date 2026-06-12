const express = require('express');
const { body, validationResult } = require('express-validator');
const router = express.Router();
const consultoriosController = require('../controllers/consultorios.controller');
const authMiddleware = require('../middleware/auth');
const permMiddleware = require('../middleware/permission');
const adminController = require('../controllers/admin.controller');

// Todas las rutas requieren autenticación
router.use(authMiddleware);

// --- Rutas médico (requieren permiso de atención) ---
router.get('/mi-estado', permMiddleware('atencion_medica_llamar_siguiente', 'atencion_medica_liberar_consultorio', 'laboratorio_registrar_caja', 'laboratorio_pasar_sala_espera', 'laboratorio_marcar_ausente', 'laboratorio_reincorporar', 'imagenes_registrar_caja', 'imagenes_pasar_sala_espera', 'imagenes_marcar_ausente', 'imagenes_reincorporar'), consultoriosController.obtenerMiEstado);
router.post('/llamar-siguiente', permMiddleware('atencion_medica_llamar_siguiente', 'llamado_laboratorio', 'llamado_imagenes'), consultoriosController.llamarSiguiente);
router.post('/iniciar-atencion', permMiddleware('atencion_medica_llamar_siguiente', 'atencion_medica_liberar_consultorio', 'laboratorio_registrar_caja', 'laboratorio_pasar_sala_espera', 'laboratorio_marcar_ausente', 'laboratorio_reincorporar', 'imagenes_registrar_caja', 'imagenes_pasar_sala_espera', 'imagenes_marcar_ausente', 'imagenes_reincorporar'), consultoriosController.iniciarAtencion);
router.post('/finalizar-atencion', permMiddleware('atencion_medica_llamar_siguiente', 'atencion_medica_liberar_consultorio', 'laboratorio_registrar_caja', 'laboratorio_pasar_sala_espera', 'laboratorio_marcar_ausente', 'laboratorio_reincorporar', 'imagenes_registrar_caja', 'imagenes_pasar_sala_espera', 'imagenes_marcar_ausente', 'imagenes_reincorporar'), consultoriosController.finalizarAtencion);
router.post('/liberar-consultorio', permMiddleware('atencion_medica_liberar_consultorio'), consultoriosController.liberarConsultorio);

// --- Rutas CRUD admin ---
router.get('/', permMiddleware('gestionar_servicios', 'admision_crear', 'admision_editar', 'admision_eliminar', 'admision_asignar_turno'), adminController.getConsultorios);
router.post(
  '/',
  permMiddleware('gestionar_servicios'),
  [
    body('nombre').isString().notEmpty().withMessage('El nombre del consultorio es obligatorio'),
    body('servicio_id').isInt().withMessage('El servicio es obligatorio'),
  ],
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errores: errors.array() });
    }
    return adminController.crearConsultorio(req, res, next);
  }
);
router.put('/:id', permMiddleware('gestionar_servicios'), adminController.actualizarConsultorio);
router.delete('/:id', permMiddleware('gestionar_servicios'), adminController.eliminarConsultorio);

module.exports = router;
