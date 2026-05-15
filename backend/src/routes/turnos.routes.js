const express = require('express');
const { body, validationResult } = require('express-validator');
const router = express.Router();
const turnosController = require('../controllers/turnos.controller');
const authMiddleware = require('../middleware/auth');
const roleMiddleware = require('../middleware/roles');

// Rutas de Recepción
// POST /api/turnos (recepcionista, admin)
router.post(
  '/',
  authMiddleware,
  roleMiddleware('recepcionista', 'admin'),
  [
    body('nombre_paciente').isString().notEmpty().withMessage('El nombre del paciente es obligatorio'),
    body('documento_paciente').isString().notEmpty().withMessage('El documento del paciente es obligatorio'),
    body('telefono_paciente').optional().isString(),
    body('servicio_id').isInt().withMessage('El servicio es obligatorio'),
    body('notificar').optional().isBoolean(),
  ],
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errores: errors.array() });
    }
    return turnosController.crearTurno(req, res, next);
  }
);

// Obtener lista de turnos (Historial)
router.get('/', authMiddleware, roleMiddleware('medico', 'admin'), turnosController.getTodosLosTurnos);

// Rutas adicionales de turnos (para uso del médico)
router.put('/:id/pausar', authMiddleware, roleMiddleware('medico'), turnosController.pausarAtencion);
router.put('/:id/reanudar', authMiddleware, roleMiddleware('medico'), turnosController.reanudarAtencion);
router.post('/:id/transferir', authMiddleware, roleMiddleware('medico'), turnosController.transferirPaciente);
router.put('/:id/ausente', authMiddleware, roleMiddleware('medico'), turnosController.marcarAusente);

module.exports = router;
