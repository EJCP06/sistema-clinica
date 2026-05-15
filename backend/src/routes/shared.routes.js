const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');

router.get('/servicios', adminController.getServicios);
router.get('/consultorios', adminController.getConsultorios);

module.exports = router;
