/**
 * Contexto del usuario autentificado para la AUDITORÍA de la base de datos.
 *
 * Cada petición HTTP entra aquí con `enContextoUsuario()` y el middleware de
 * autenticación guarda el nombre con `setUsuarioActual()`. El pool de base de
 * datos (ver config/db.js) lee ese nombre y lo fija en la sesión de PostgreSQL
 * con `set_config('app.usuario', ...)`, de modo que el trigger
 * `fn_auditoria_registro()` (backend/db/auditoria.sql) sabe quién creó o
 * modificó cada fila sin que los repositorios tengan que pasar el dato.
 *
 * AsyncLocalStorage garantiza que dos peticiones simultáneas nunca se mezclen:
 * cada request ve únicamente su propio usuario.
 */
const { AsyncLocalStorage } = require('async_hooks');

const contexto = new AsyncLocalStorage();

/**
 * Ejecuta una función dentro de un contexto de usuario (petición HTTP).
 * Si `nombre` es null se inicia sin usuario (las escrituras quedan como
 * 'SISTEMA' hasta que el middleware de autenticación lo complete).
 *
 * @param {string|null} nombre - Nombre del usuario (o null)
 * @param {Function} fn - Función a ejecutar dentro del contexto
 * @returns {*} El valor devuelto por `fn`
 */
const enContextoUsuario = (nombre, fn) => contexto.run({ nombre: nombre || '' }, fn);

/**
 * Guarda el usuario autenticado en el contexto de la petición en curso.
 * Fuera de un contexto (migraciones, trabajos automáticos, scripts) no hace
 * nada: esas escrituras quedan marcadas como 'SISTEMA'.
 *
 * @param {string} nombre - "primer_nombre primer_apellido" del usuario
 * @returns {void}
 */
const setUsuarioActual = (nombre) => {
  const store = contexto.getStore();
  if (store) {
    store.nombre = nombre || '';
  }
};

/**
 * Usuario actual del contexto (vacío si no hay ninguno).
 *
 * @returns {string} Nombre del usuario o cadena vacía
 */
const getUsuarioActual = () => contexto.getStore()?.nombre || '';

module.exports = { contexto, enContextoUsuario, setUsuarioActual, getUsuarioActual };
