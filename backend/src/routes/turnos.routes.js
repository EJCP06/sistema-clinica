const express = require('express');
const router = express.Router();

const turnosController = require('../controllers/turnos.controller');

console.log('TURNOS CONTROLLER:', turnosController);

// SOLO FUNCIONES (SIN PARENTESIS)
router.get('/todos', turnosController.getTodosLosTurnos);

router.post('/crear', turnosController.crearTurno);

router.put('/ausente/:id', turnosController.marcarAusente);

router.put('/transferir/:id', turnosController.transferirPaciente);

router.put('/pausar/:id', turnosController.pausarAtencion);

router.put('/reanudar/:id', turnosController.reanudarAtencion);

module.exports = router;
