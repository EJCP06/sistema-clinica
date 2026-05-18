-- 1. LIMPIEZA TOTAL
TRUNCATE TABLE "Historial_Atencion" RESTART IDENTITY CASCADE;
TRUNCATE TABLE "Atencion" RESTART IDENTITY CASCADE;
TRUNCATE TABLE "Pacientes" RESTART IDENTITY CASCADE;
TRUNCATE TABLE "Usuarios" RESTART IDENTITY CASCADE;
TRUNCATE TABLE "Consultorios" RESTART IDENTITY CASCADE;
TRUNCATE TABLE "Servicio" RESTART IDENTITY CASCADE;
TRUNCATE TABLE "Responsable_Pago" RESTART IDENTITY CASCADE;
TRUNCATE TABLE "Estado" RESTART IDENTITY CASCADE;
TRUNCATE TABLE "Sedes" RESTART IDENTITY CASCADE;
TRUNCATE TABLE "configuraciones" CASCADE;

-- 2. CARGA DE SEDES
INSERT INTO "Sedes" (id_sede, nombre) VALUES 
(1, 'Santa Mónica'),
(2, 'Plaza Sucre');

-- 3. CARGA DE ESTADOS
INSERT INTO "Estado" (nombre_estado) VALUES 
('Registro'),       -- id 1
('Sala de Espera'), -- id 2
('Llamado'),        -- id 3
('En Atención'),    -- id 4
('Atendido'),       -- id 5
('Cancelado');      -- id 6

-- 4. CARGA DE SERVICIOS (Diferenciados por Sede)
-- Servicios Sede 1 (Santa Mónica)
INSERT INTO "Servicio" (nombre_servicio, id_sede) VALUES 
('Medicina General', 1), -- id 1
('Pediatría', 1),        -- id 2
('Ginecología', 1);       -- id 3

-- Servicios Sede 2 (Plaza Sucre)
INSERT INTO "Servicio" (nombre_servicio, id_sede) VALUES 
('Medicina General', 2), -- id 4
('Cardiología', 2),       -- id 5
('Odontología', 2);       -- id 6

-- 5. CARGA DE RESPONSABLES DE PAGO
INSERT INTO "Responsable_Pago" (nombre) VALUES 
('Particular'),
('Seguro Humano'),
('Seguro Reservas'),
('Seguro Universal');

-- 6. CARGA DE CONSULTORIOS (Diferenciados por Sede)
-- Consultorios Sede 1 (Santa Mónica)
INSERT INTO "Consultorios" (nombre, id_servicio, id_sede) VALUES 
('Consultorio 101', 1, 1),
('Consultorio 102', 1, 1),
('Consultorio 201', 2, 1);

-- Consultorios Sede 2 (Plaza Sucre)
INSERT INTO "Consultorios" (nombre, id_servicio, id_sede) VALUES 
('Consultorio A-101', 4, 2),
('Consultorio A-102', 5, 2);

-- 7. CARGA DE USUARIOS (Contraseña '123456' para todos)
-- Hash generado de forma segura en Node.js para '123456': $2b$10$NyGIcK6PGYTz/uV2rigXEe6SRB0DEGuRxuA3.iA0bRw7YzvJDhFXa

-- Usuarios Sede 1 (Santa Mónica)
INSERT INTO "Usuarios" (cedula, password_hash, nombre, apellido, rol, status, id_sede) 
VALUES ('11', '$2b$10$NyGIcK6PGYTz/uV2rigXEe6SRB0DEGuRxuA3.iA0bRw7YzvJDhFXa', 'ADMIN', 'SANTA MONICA', 'admin', true, 1); -- id_usuario 1

INSERT INTO "Usuarios" (cedula, password_hash, nombre, apellido, rol, status, id_sede) 
VALUES ('21', '$2b$10$NyGIcK6PGYTz/uV2rigXEe6SRB0DEGuRxuA3.iA0bRw7YzvJDhFXa', 'MARIA', 'RECEPCION', 'recepcionista', true, 1); -- id_usuario 2

INSERT INTO "Usuarios" (cedula, password_hash, nombre, apellido, rol, status, id_servicio, id_consultorio, id_sede) 
VALUES ('31', '$2b$10$NyGIcK6PGYTz/uV2rigXEe6SRB0DEGuRxuA3.iA0bRw7YzvJDhFXa', 'DR. JUAN', 'PEREZ', 'medico', true, 1, 1, 1); -- id_usuario 3

-- Usuarios Sede 2 (Plaza Sucre)
INSERT INTO "Usuarios" (cedula, password_hash, nombre, apellido, rol, status, id_sede) 
VALUES ('12', '$2b$10$NyGIcK6PGYTz/uV2rigXEe6SRB0DEGuRxuA3.iA0bRw7YzvJDhFXa', 'ADMIN', 'PLAZA SUCRE', 'admin', true, 2); -- id_usuario 4

INSERT INTO "Usuarios" (cedula, password_hash, nombre, apellido, rol, status, id_sede) 
VALUES ('22', '$2b$10$NyGIcK6PGYTz/uV2rigXEe6SRB0DEGuRxuA3.iA0bRw7YzvJDhFXa', 'ANA', 'RECEPCION', 'recepcionista', true, 2); -- id_usuario 5

INSERT INTO "Usuarios" (cedula, password_hash, nombre, apellido, rol, status, id_servicio, id_consultorio, id_sede) 
VALUES ('32', '$2b$10$NyGIcK6PGYTz/uV2rigXEe6SRB0DEGuRxuA3.iA0bRw7YzvJDhFXa', 'DR. CARLOS', 'GOMEZ', 'medico', true, 4, 4, 2); -- id_usuario 6

-- 8. CARGA DE PACIENTES DE PRUEBA (Diferenciados por Sede)
-- Pacientes Sede 1 (Santa Mónica)
INSERT INTO "Pacientes" (cedula, nombre, apellido, telefono, email, id_sede) VALUES
('41', 'JUAN', 'PEREZ', '809-555-1234', 'juan.perez@email.com', 1), -- id_paciente 1
('42', 'MARIA', 'GOMEZ', '809-555-5678', 'maria.gomez@email.com', 1); -- id_paciente 2

-- Pacientes Sede 2 (Plaza Sucre)
INSERT INTO "Pacientes" (cedula, nombre, apellido, telefono, email, id_sede) VALUES
('51', 'CARLOS', 'RODRIGUEZ', '809-555-9012', 'carlos.rod@email.com', 2), -- id_paciente 3
('52', 'PATRICIA', 'SANCHEZ', '809-555-4321', 'patricia.sanchez@email.com', 2); -- id_paciente 4

-- 9. CARGA DE TICKETS DE ATENCION EN COLA (SALA DE ESPERA - Diferenciados por Sede)
-- Tickets Sede 1 (Santa Mónica)
INSERT INTO "Atencion" (id_paciente, id_servicio, id_responsable, id_estado_actual, id_sede, id_usuario_registro) VALUES
(1, 1, 1, 2, 1, 2), -- Juan Pérez en Medicina General esperando en Sede 1
(2, 2, 2, 2, 1, 2); -- María Gómez en Pediatría esperando en Sede 1

-- Tickets Sede 2 (Plaza Sucre)
INSERT INTO "Atencion" (id_paciente, id_servicio, id_responsable, id_estado_actual, id_sede, id_usuario_registro) VALUES
(3, 4, 1, 2, 2, 5), -- Carlos Rodríguez en Medicina General esperando en Sede 2
(4, 5, 3, 2, 2, 5); -- Patricia Sánchez en Cardiología esperando en Sede 2
