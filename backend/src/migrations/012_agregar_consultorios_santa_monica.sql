-- ======================================================
-- MIGRACIÓN 012: Consultorios de Santa Mónica
-- ======================================================
-- Copiar los mismos consultorios para Santa Monica (id_sede = 2)
INSERT INTO "Consultorios" (nombre, piso, id_servicio, id_sede, estado_fisico)
SELECT c.nombre, c.piso, c.id_servicio, 2, c.estado_fisico
FROM "Consultorios" c
WHERE c.id_sede = 1
ORDER BY c.id_consultorio;
