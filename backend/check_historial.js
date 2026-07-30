const pool = require('./src/config/db');
pool.query(`
  SELECT a.id_atencion, a.id_estado_actual, e.nombre_estado, a.hora_salida,
    h7.fecha_hora as h_ausente, h9.fecha_hora as h_retirado, h6.fecha_hora as h_fin
  FROM "Atencion" a
  JOIN "Estado" e ON a.id_estado_actual = e.id_estado
  LEFT JOIN "Historial_Atencion" h7 ON h7.id_atencion = a.id_atencion AND h7.id_estado = 7
  LEFT JOIN "Historial_Atencion" h9 ON h9.id_atencion = a.id_atencion AND h9.id_estado = 9
  LEFT JOIN "Historial_Atencion" h6 ON h6.id_atencion = a.id_atencion AND h6.id_estado = 6
  WHERE a.id_sede = 1 AND a.hora_llegada >= CURRENT_DATE
  ORDER BY a.hora_llegada DESC
  LIMIT 10
`).then(r => console.table(r.rows)).catch(e => console.error(e)).finally(() => pool.end());