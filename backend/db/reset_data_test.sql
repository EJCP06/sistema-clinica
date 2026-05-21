-- ======================================================
-- SCRIPT DE REESTABLECIMIENTO TOTAL Y DATOS DE PRUEBA
-- ======================================================

-- 1. LIMPIEZA TOTAL
TRUNCATE TABLE "Historial_Atencion" RESTART IDENTITY CASCADE;
TRUNCATE TABLE "Atencion" RESTART IDENTITY CASCADE;
TRUNCATE TABLE "Pacientes" RESTART IDENTITY CASCADE;
TRUNCATE TABLE "Usuarios" RESTART IDENTITY CASCADE;
TRUNCATE TABLE "Consultorios" RESTART IDENTITY CASCADE;
TRUNCATE TABLE "Servicio" RESTART IDENTITY CASCADE;
TRUNCATE TABLE "Sedes" RESTART IDENTITY CASCADE;
TRUNCATE TABLE "cliente" RESTART IDENTITY CASCADE;
TRUNCATE TABLE "Responsable_Pago" RESTART IDENTITY CASCADE;

-- 2. INSERTAR SEDES
INSERT INTO "Sedes" (id_sede, nombre, direccion) VALUES
(1, 'SANTA MÓNICA', 'AV. PRINCIPAL SANTA MONICA'),
(2, 'PLAZA SUCRE', 'PLAZA SUCRE, CATIA')
ON CONFLICT (id_sede) DO UPDATE SET nombre = EXCLUDED.nombre;

-- 3. INSERTAR SERVICIOS BÁSICOS (Necesarios para médicos)
INSERT INTO "Servicio" (id_servicio, id_sede, nombre_servicio, prefijo, piso) VALUES
(1, 1, 'MEDICINA GENERAL', 'MED', '1'),
(2, 2, 'PEDIATRÍA', 'PED', '1');

-- 4. INSERTAR USUARIOS DE PRUEBA (Passwords: admin123, recep123, doc123)
-- Hashes generados con bcrypt (10 rounds)

-- Sede 1: Santa Mónica
INSERT INTO "Usuarios" (id_sede, cedula, username, password_hash, rol, nombre, apellido, status, id_servicio) VALUES 
(1, 'admin', 'admin', '$2b$10$.hSY6GV6J2TWtYfuMegtt.ybEfQLtmFFPwntZCRaJLCdNDNMuaHTu', 'admin', 'ADMIN', 'SANTA MONICA', true, NULL),
(1, '20000001', '20000001', '$2b$10$aSQUh5/vqRuNbb5zhjJzoucoXxW1y6sR6CQCjS12uxDPyRFdd1Nha', 'recepcionista', 'RECEPCIONISTA', 'S1', true, NULL),
(1, '10000001', '10000001', '$2b$10$5fTuObaQBKiB.Hu6KO/ed.sA/26AQtEqXbsMD3Z.sT89Tj2j9UTFu', 'medico', 'DR. SANTA', 'MONICA', true, 1),
(1, '30000001', '30000001', '$2b$10$5fTuObaQBKiB.Hu6KO/ed.sA/26AQtEqXbsMD3Z.sT89Tj2j9UTFu', 'aps', 'CAJA', 'APS S1', true, NULL);

-- Sede 2: Plaza Sucre
INSERT INTO "Usuarios" (id_sede, cedula, username, password_hash, rol, nombre, apellido, status, id_servicio) VALUES 
(2, 'admin_ps', 'admin_ps', '$2b$10$.hSY6GV6J2TWtYfuMegtt.ybEfQLtmFFPwntZCRaJLCdNDNMuaHTu', 'admin', 'ADMIN', 'PLAZA SUCRE', true, NULL),
(2, '20000002', '20000002', '$2b$10$aSQUh5/vqRuNbb5zhjJzoucoXxW1y6sR6CQCjS12uxDPyRFdd1Nha', 'recepcionista', 'RECEPCIONISTA', 'S2', true, NULL),
(2, '10000002', '10000002', '$2b$10$5fTuObaQBKiB.Hu6KO/ed.sA/26AQtEqXbsMD3Z.sT89Tj2j9UTFu', 'medico', 'DR. PLAZA', 'SUCRE', true, 2);

-- 5. CONFIGURACIÓN INICIAL (ESTADOS Y RESPONSABLES)
-- (Asumiendo que ya existen por el init.sql, pero aseguramos responsables)
INSERT INTO "Responsable_Pago" (id_responsable, nombre, status) VALUES
(1, 'PARTICULAR', true),
(2, 'ASEGURADORA', true)
ON CONFLICT DO NOTHING;
