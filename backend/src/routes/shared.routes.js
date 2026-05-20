const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

router.get('/servicios', adminController.getServicios);
router.get('/consultorios', adminController.getConsultorios);
router.get('/aseguradoras', adminController.getAseguradoras);
router.post('/aseguradoras', adminController.crearAseguradora);

module.exports = router;
