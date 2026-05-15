const express = require('express');
const { body, validationResult } = require('express-validator');
const router = express.Router();
const consultoriosController = require('../controllers/consultorios.controller');
const authMiddleware = require('../middleware/auth');
const roleMiddleware = require('../middleware/roles');
const adminController = require('../controllers/admin.controller');

// Todas las rutas requieren autenticación
router.use(authMiddleware);

// --- Rutas médico (requieren rol medico o admin) ---
router.get('/mi-estado', roleMiddleware('medico', 'admin'), consultoriosController.obtenerMiEstado);
router.post('/llamar-siguiente', roleMiddleware('medico', 'admin'), consultoriosController.llamarSiguiente);
router.post('/iniciar-atencion', roleMiddleware('medico', 'admin'), consultoriosController.iniciarAtencion);
router.post('/finalizar-atencion', roleMiddleware('medico', 'admin'), consultoriosController.finalizarAtencion);

router.put('/pausar', roleMiddleware('medico', 'admin'), (req, res, next) => {
  if (!req.usuario.consultorio_id) {
    return res.status(400).json({ mensaje: 'No tiene consultorio asignado' });
  }
  req.params.id = req.usuario.consultorio_id;
  next();
}, consultoriosController.pausarConsultorio);

router.put('/reanudar', roleMiddleware('medico', 'admin'), (req, res, next) => {
  if (!req.usuario.consultorio_id) {
    return res.status(400).json({ mensaje: 'No tiene consultorio asignado' });
  }
  req.params.id = req.usuario.consultorio_id;
  next();
}, consultoriosController.reanudarConsultorio);

// --- Rutas CRUD admin (requieren rol admin) ---
router.get('/', roleMiddleware('admin', 'medico', 'recepcionista'), adminController.getConsultorios);
router.post(
  '/',
  roleMiddleware('admin'),
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
router.put('/:id', roleMiddleware('admin'), adminController.actualizarConsultorio);
router.delete('/:id', roleMiddleware('admin'), adminController.eliminarConsultorio);

module.exports = router;
