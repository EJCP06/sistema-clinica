/**
 * Documentación Swagger/OpenAPI de la API.
 *
 * Genera la especificación a partir de los comentarios JSDoc presentes en
 * backend/src/routes/*.js y backend/src/controllers/*.js. La interfaz web
 * (swagger-ui-express) se expone en GET /api-docs (ver backend/index.js).
 *
 * Para documentar un endpoint nuevo basta con escribir su JSDoc @swagger
 * en la ruta o el controlador correspondiente.
 */
const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Clínica Nueva Caracas - API',
      version: '1.0.0',
      description: 'API del sistema de gestión de turnos y atenciones médicas',
    },
    servers: [
      { url: '/api', description: 'API base path' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    // Por defecto todos los endpoints requieren token JWT (se puede sobrescribir por operación).
    security: [{ bearerAuth: [] }],
  },
  apis: ['./src/routes/*.js', './src/controllers/*.js'],
};

module.exports = swaggerJsdoc(options);
