-- Agregar estado 9 = Retirado para pacientes retirados por coordinador/admin
INSERT INTO "Estado" ("id_estado", "nombre_estado")
SELECT 9, 'Retirado'
WHERE NOT EXISTS (SELECT 1 FROM "Estado" WHERE id_estado = 9);
