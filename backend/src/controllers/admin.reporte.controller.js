const logger = require('../config/logger');
const atencionRepo = require('../repositories/atencion.repository');
const { getSede } = require('./admin.helpers');

const getReporteDiario = async (req, res) => {
  const sede = getSede(req, res);
  if (!sede) return;

  try {
    const { fecha_desde, fecha_hasta } = req.query;
    const rows = await atencionRepo.getReporteDiario(sede, fecha_desde || null, fecha_hasta || null);

    const turnos = rows.map((r) => ({
      id: r.id,
      numero: r.numero,
      estado: r.estado,
      id_estado_actual: r.id_estado_actual,
      hora_llegada: r.hora_llegada,
      hora_fin: r.hora_fin,
      servicio_nombre: r.servicio,
      especialidad: r.especialidad,
      consultorio: r.consultorio,
      medico_nombre: r.medico_nombre,
      medico_apellido: r.medico_apellido,
      hora_inicio_atencion: r.hora_inicio_atencion,
      hora_fin_atencion: r.hora_fin_atencion,
      hora_marcado_ausente: r.hora_marcado_ausente,
      hora_retirado: r.hora_retirado,
      id_sede: r.id_sede,
      paciente: {
        nombre: [r.primer_nombre, r.segundo_nombre].filter(Boolean).join(' '),
        apellido: [r.primer_apellido, r.segundo_apellido].filter(Boolean).join(' '),
        documento: r.paciente_documento,
        telefono: r.paciente_telefono,
      },
    }));

    const atendidos = turnos.filter((t) => t.estado === 'Atendido');
    const ausentes = turnos.filter((t) => t.estado === 'Ausente');
    const enEspera = turnos.filter(
      (t) => t.estado === 'Sala de Espera' || t.estado === 'Llamado',
    );
    const enAtencion = turnos.filter((t) => t.estado === 'En Atencion');
    const registrados = turnos.filter((t) => t.estado === 'Registrado');

    const turnosConEspera = turnos.filter(t => t.hora_inicio_atencion && t.hora_llegada);
    const tiempoPromedioEspera = turnosConEspera.length > 0
      ? Math.round(turnosConEspera.reduce((sum, t) => {
          const inicio = new Date(t.hora_inicio_atencion);
          const llegada = new Date(t.hora_llegada);
          return sum + (inicio - llegada) / 60000;
        }, 0) / turnosConEspera.length)
      : 0;

    const turnosConAtencion = turnos.filter(t => t.hora_fin_atencion && t.hora_inicio_atencion);
    const tiempoPromedioAtencion = turnosConAtencion.length > 0
      ? Math.round(turnosConAtencion.reduce((sum, t) => {
          const fin = new Date(t.hora_fin_atencion);
          const inicio = new Date(t.hora_inicio_atencion);
          return sum + (fin - inicio) / 60000;
        }, 0) / turnosConAtencion.length)
      : 0;

    const porServicio = {};
    turnos.forEach(t => {
      const key = t.servicio_nombre;
      if (!porServicio[key]) {
        porServicio[key] = { servicio: key, total: 0, atendidos: 0, retirados: 0, en_espera: 0, en_atencion: 0, registrados: 0 };
      }
      porServicio[key].total++;
      if (t.estado === 'Atendido') porServicio[key].atendidos++;
      else if (t.estado === 'Retirado') porServicio[key].retirados++;
      else if (t.estado === 'Sala de Espera' || t.estado === 'Llamado') porServicio[key].en_espera++;
      else if (t.estado === 'En Atencion') porServicio[key].en_atencion++;
      else if (t.estado === 'Registrado') porServicio[key].registrados++;
    });

    const listaAusentes = ausentes.map(t => ({
      numero: t.numero,
      paciente_nombre: t.paciente.nombre,
      paciente_apellido: t.paciente.apellido,
      paciente_documento: t.paciente.documento,
      servicio: t.servicio_nombre,
      especialidad: t.especialidad,
      hora_llegada: t.hora_llegada,
    }));

    res.json({
      total: turnos.length,
      turnos,
      estadisticas: {
        atendidos: atendidos.length,
        ausentes: ausentes.length,
        en_espera: enEspera.length,
        en_atencion: enAtencion.length,
        registrados: registrados.length,
      },
      kpis: {
        tiempo_promedio_espera_min: tiempoPromedioEspera,
        tiempo_promedio_atencion_min: tiempoPromedioAtencion,
        ausentismo_porcentaje: turnos.length > 0 ? Math.round((ausentes.length / turnos.length) * 100) : 0,
      },
      por_servicio: Object.values(porServicio),
      ausentes: listaAusentes,
    });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ mensaje: 'Error interno al generar el reporte diario' });
  }
};

module.exports = { getReporteDiario };
