const express = require('express');
const router = express.Router();

const recepcionController = require('../controllers/recepcion.controller');

console.log('RECEPCION CONTROLLER:', recepcionController);

router.get('/buscar/:cedula', recepcionController.buscarPaciente);

router.post('/crear', recepcionController.crearPaciente);

module.exports = router;