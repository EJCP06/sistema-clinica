const getTodosLosTurnos = async (req, res) => {
  try {
    res.json({ ok: true, mensaje: 'listar turnos' });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
};

const crearTurno = async (req, res) => {
  try {
    res.json({ ok: true, mensaje: 'crear turno' });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
};

const marcarAusente = async (req, res) => {
  try {
    res.json({ ok: true, mensaje: 'marcar ausente' });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
};

const transferirPaciente = async (req, res) => {
  try {
    res.json({ ok: true, mensaje: 'transferir paciente' });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
};

const pausarAtencion = async (req, res) => {
  try {
    res.json({ ok: true, mensaje: 'pausar atención' });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
};

const reanudarAtencion = async (req, res) => {
  try {
    res.json({ ok: true, mensaje: 'reanudar atención' });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
};

module.exports = {
  getTodosLosTurnos,
  crearTurno,
  marcarAusente,
  transferirPaciente,
  pausarAtencion,
  reanudarAtencion,
};
