const getUserId = (req) => req.usuario?.id;

const getSede = (req, res) => {
  const sede = req.usuario?.id_sede;
  const rol = req.usuario?.rol;
  if (sede === undefined || sede === null) {
    if (res) res.status(401).json({ mensaje: 'Token inválido o sin sede' });
    return null;
  }
  return Number(sede);
};

module.exports = { getUserId, getSede };
