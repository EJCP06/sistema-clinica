const express = require('express');
const { body, validationResult } = require('express-validator');
const router = express.Router();
const consultoriosController = require('../controllers/consultorios.controller');
const authMiddleware = require('../middleware/auth');
const { permissionMiddleware: permMiddleware, soloAdministrador } = require('../middleware/permission');
const adminController = require('../controllers/admin.controller');

const validar = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errores: errors.array() });
  }
  next();
};

router.use(authMiddleware);

router.get('/mi-estado', permMiddleware(
  'atencion_medica:llamar_siguiente', 'atencion_medica:liberar_consultorio',
  'laboratorio:registrar_caja', 'laboratorio:pasar_sala_espera', 'laboratorio:marcar_ausente', 'laboratorio:reincorporar',
  'imagenes:registrar_caja', 'imagenes:pasar_sala_espera', 'imagenes:marcar_ausente', 'imagenes:reincorporar',
  '*:marcar_ausente', '*:reincorporar'
), consultoriosController.obtenerMiEstado);

router.post('/llamar-siguiente', permMiddleware(
  'atencion_medica:llamar_siguiente', 'llamado:laboratorio', 'llamado:imagenes',
  'laboratorio:*', 'imagenes:*'
), consultoriosController.llamarSiguiente);

router.post('/iniciar-atencion', permMiddleware(
  'atencion_medica:llamar_siguiente', 'atencion_medica:liberar_consultorio',
  'laboratorio:registrar_caja', 'laboratorio:pasar_sala_espera', 'laboratorio:marcar_ausente', 'laboratorio:reincorporar',
  'imagenes:registrar_caja', 'imagenes:pasar_sala_espera', 'imagenes:marcar_ausente', 'imagenes:reincorporar'
), consultoriosController.iniciarAtencion);

router.post('/finalizar-atencion', permMiddleware(
  'atencion_medica:llamar_siguiente', 'atencion_medica:liberar_consultorio',
  'laboratorio:registrar_caja', 'laboratorio:pasar_sala_espera', 'laboratorio:marcar_ausente', 'laboratorio:reincorporar',
  'imagenes:registrar_caja', 'imagenes:pasar_sala_espera', 'imagenes:marcar_ausente', 'imagenes:reincorporar'
), consultoriosController.finalizarAtencion);

router.post('/liberar-consultorio', permMiddleware('atencion_medica:liberar_consultorio'), consultoriosController.liberarConsultorio);

router.get('/', permMiddleware('admision:crear', 'admision:editar', 'admision:eliminar', 'admision:asignar_turno', 'especialidades:ver'), adminController.getConsultorios);
router.post(
  '/',
  soloAdministrador,
  [
    body('nombre').isString().notEmpty().withMessage('El nombre del consultorio es obligatorio'),
    body('servicio_id').isInt().withMessage('El servicio es obligatorio'),
  ],
  validar,
  adminController.crearConsultorio
);
router.put('/:id', soloAdministrador, adminController.actualizarConsultorio);
router.delete('/:id', soloAdministrador, adminController.eliminarConsultorio);

module.exports = router;
