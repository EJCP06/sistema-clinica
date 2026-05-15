-- 1. LIMPIEZA TOTAL
TRUNCATE TABLE "Historial_Atencion" RESTART IDENTITY CASCADE;
TRUNCATE TABLE "Atencion" RESTART IDENTITY CASCADE;
TRUNCATE TABLE "Pacientes" RESTART IDENTITY CASCADE;
TRUNCATE TABLE "Consultorios" RESTART IDENTITY CASCADE;
TRUNCATE TABLE "Servicio" RESTART IDENTITY CASCADE;
TRUNCATE TABLE "Responsable_Pago" RESTART IDENTITY CASCADE;
TRUNCATE TABLE "Estado" RESTART IDENTITY CASCADE;
TRUNCATE TABLE "Usuarios" RESTART IDENTITY CASCADE;

-- 2. CARGA DE ESTADOS
INSERT INTO "Estado" (nombre_estado) VALUES 
('Registro'),
('Sala de Espera'),
('Llamado'),
('En Atención'),
('Atendido'),
('Cancelado');

-- 3. CARGA DE SERVICIOS
INSERT INTO "Servicio" (nombre_servicio) VALUES 
('Medicina General'),
('Pediatría'),
('Ginecología'),
('Traumatología'),
('Odontología');

-- 4. CARGA DE RESPONSABLES DE PAGO
INSERT INTO "Responsable_Pago" (nombre) VALUES 
('Particular'),
('Seguro Humano'),
('Seguro Reservas'),
('Seguro Universal');

-- 5. CARGA DE CONSULTORIOS
INSERT INTO "Consultorios" (nombre, id_servicio) VALUES 
('Consultorio 101', 1),
('Consultorio 102', 1),
('Consultorio 201', 2),
('Consultorio 202', 3);

-- 6. CARGA DE USUARIOS (Password '123456' para todos)
-- Hash generado para '123456': $2b$10$Gf.v1Y8IuM3jQ9W9vF.O4uH2mS7zL/K1i6x8tG5vD3lB2nN7mY9W6
INSERT INTO "Usuarios" (username, password_hash, nombre, apellido, rol, status) 
VALUES ('admin', '$2b$10$Gf.v1Y8IuM3jQ9W9vF.O4uH2mS7zL/K1i6x8tG5vD3lB2nN7mY9W6', 'Admin', 'SisCol', 'admin', true);

INSERT INTO "Usuarios" (username, password_hash, nombre, apellido, rol, status) 
VALUES ('recepcion', '$2b$10$Gf.v1Y8IuM3jQ9W9vF.O4uH2mS7zL/K1i6x8tG5vD3lB2nN7mY9W6', 'Maria', 'Recepcion', 'recepcionista', true);

INSERT INTO "Usuarios" (username, password_hash, nombre, apellido, rol, status, servicio_id, consultorio_id) 
VALUES ('medico1', '$2b$10$Gf.v1Y8IuM3jQ9W9vF.O4uH2mS7zL/K1i6x8tG5vD3lB2nN7mY9W6', 'Dr. Juan', 'Perez', 'medico', true, 1, 1);
