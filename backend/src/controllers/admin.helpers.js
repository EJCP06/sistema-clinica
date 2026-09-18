const getSede = (req, res) => {
  const sede = req.usuario?.id_sede;
  if (sede === undefined || sede === null) {
    res.status(401).json({ mensaje: 'Token inválido o sin sede' });
    return null;
  }
  return Number(sede);
};

const getUserId = (req) => req.usuario?.id;

const VISIBLES_ADMIN = new Set([
  'admision', 'aps', 'laboratorio', 'imagenes', 'atencion_medica', 'aseguradoras', 'especialidades'
]);

const INMUTABLES_ADMIN = ['personal', 'roles', 'permisologia', 'reportes', 'llamado'];

module.exports = { getSede, getUserId, VISIBLES_ADMIN, INMUTABLES_ADMIN };
