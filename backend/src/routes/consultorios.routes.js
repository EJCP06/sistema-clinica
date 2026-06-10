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
router.get('/mi-estado', roleMiddleware('medico', 'administrador', 'laboratorio', 'imagenes'), consultoriosController.obtenerMiEstado);
router.post('/llamar-siguiente', roleMiddleware('medico', 'administrador', 'laboratorio', 'imagenes'), consultoriosController.llamarSiguiente);
router.post('/iniciar-atencion', roleMiddleware('medico', 'administrador', 'laboratorio', 'imagenes'), consultoriosController.iniciarAtencion);
router.post('/finalizar-atencion', roleMiddleware('medico', 'administrador', 'laboratorio', 'imagenes'), consultoriosController.finalizarAtencion);
router.post('/liberar-consultorio', roleMiddleware('medico', 'administrador', 'laboratorio', 'imagenes'), consultoriosController.liberarConsultorio);

// --- Rutas CRUD admin (requieren rol admin) ---
router.get('/', roleMiddleware('administrador', 'medico', 'recepcionista'), adminController.getConsultorios);
router.post(
  '/',
  roleMiddleware('administrador'),
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
router.put('/:id', roleMiddleware('administrador'), adminController.actualizarConsultorio);
router.delete('/:id', roleMiddleware('administrador'), adminController.eliminarConsultorio);

module.exports = router;
