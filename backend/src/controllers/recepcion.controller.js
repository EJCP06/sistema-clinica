const buscarPaciente = async (req, res) => {
  try {
    res.json({ ok: true, mensaje: 'buscar paciente' });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
};

const crearPaciente = async (req, res) => {
  try {
    res.json({ ok: true, mensaje: 'crear paciente' });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
};

module.exports = {
  buscarPaciente,
  crearPaciente,
};
