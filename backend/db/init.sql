-- ======================================================
-- ESQUEMA DE BASE DE DATOS: SISTEMA CLÍNICO PROFESIONAL
-- Proyecto: Gestión de Colas y Admisión Multi-Sede
-- Motor: PostgreSQL | Versión: 2.0 (Estandarizada)
-- ======================================================

-- 1. LIMPIEZA DE ESTRUCTURA (ORDEN JERÁRQUICO)
-- ------------------------------------------------------
DROP TABLE IF EXISTS historial_atencion CASCADE;
DROP TABLE IF EXISTS atencion CASCADE;
DROP TABLE IF EXISTS pacientes CASCADE;
DROP TABLE IF EXISTS usuarios CASCADE;
DROP TABLE IF EXISTS consultorios CASCADE;
DROP TABLE IF EXISTS servicio CASCADE;
DROP TABLE IF EXISTS responsable_pago CASCADE;
DROP TABLE IF EXISTS estado CASCADE;
DROP TABLE IF EXISTS sedes CASCADE;

-- 2. TABLA: SEDES (CENTROS CLÍNICOS)
-- ------------------------------------------------------
CREATE TABLE sedes (
    id_sede SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    direccion TEXT,
    telefono VARCHAR(20),
    activo BOOLEAN DEFAULT true,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. TABLA: SERVICIOS / ESPECIALIDADES
-- ------------------------------------------------------
CREATE TABLE servicio (
    id_servicio SERIAL PRIMARY KEY,
    id_sede INTEGER REFERENCES sedes(id_sede) ON DELETE CASCADE,
    nombre_servicio VARCHAR(100) NOT NULL,
    prefijo VARCHAR(10) NOT NULL, -- Ej: 'PED' para Pediatría
    piso INTEGER,
    status BOOLEAN DEFAULT true,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. TABLA: ESTADOS DE ATENCIÓN
-- ------------------------------------------------------
CREATE TABLE estado (
    id_estado SERIAL PRIMARY KEY,
    nombre_estado VARCHAR(50) NOT NULL -- Registro, Espera, Llamado, Atendido, Cancelado
);

-- 5. TABLA: RESPONSABLES DE PAGO
-- ------------------------------------------------------
CREATE TABLE responsable_pago (
    id_responsable SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    activo BOOLEAN DEFAULT true
);

-- 6. TABLA: CONSULTORIOS
-- ------------------------------------------------------
CREATE TABLE consultorios (
    id_consultorio SERIAL PRIMARY KEY,
    id_sede INTEGER REFERENCES sedes(id_sede) ON DELETE CASCADE,
    id_servicio INTEGER REFERENCES servicio(id_servicio),
    nombre VARCHAR(50) NOT NULL, -- Ej: 'CONSULTORIO 10'
    piso INTEGER NOT NULL,
    estado_fisico VARCHAR(20) DEFAULT 'LIBRE' -- LIBRE, OCUPADO, MANTENIMIENTO
);

-- 7. TABLA: USUARIOS (PERSONAL CLÍNICO)
-- ------------------------------------------------------
CREATE TABLE usuarios (
    id_usuario SERIAL PRIMARY KEY,
    id_sede INTEGER REFERENCES sedes(id_sede) ON DELETE SET NULL,
    cedula VARCHAR(20) UNIQUE NOT NULL, -- Login ID
    password_hash VARCHAR(255) NOT NULL,
    rol VARCHAR(30) NOT NULL, -- admin, medico, recepcionista
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE,
    telefono VARCHAR(20),
    id_servicio INTEGER REFERENCES servicio(id_servicio), -- Especialidad (para médicos)
    id_consultorio INTEGER REFERENCES consultorios(id_consultorio),
    piso INTEGER,
    status BOOLEAN DEFAULT true,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 8. TABLA: PACIENTES
-- ------------------------------------------------------
CREATE TABLE pacientes (
    id_paciente SERIAL PRIMARY KEY,
    cedula VARCHAR(20) UNIQUE NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    telefono VARCHAR(20),
    email VARCHAR(100),
    notificaciones_sms BOOLEAN DEFAULT true,
    status BOOLEAN DEFAULT true,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 9. TABLA: ATENCIONES (COLA DE ESPERA)
-- ------------------------------------------------------
CREATE TABLE atencion (
    id_atencion SERIAL PRIMARY KEY,
    id_sede INTEGER REFERENCES sedes(id_sede) ON DELETE CASCADE,
    id_paciente INTEGER REFERENCES pacientes(id_paciente),
    id_servicio INTEGER REFERENCES servicio(id_servicio),
    id_responsable INTEGER REFERENCES responsable_pago(id_responsable),
    id_estado_actual INTEGER REFERENCES estado(id_estado),
    id_usuario_registro INTEGER REFERENCES usuarios(id_usuario),
    ticket_numero VARCHAR(20), -- Ej: 'PED-001'
    hora_llegada TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    hora_llamado TIMESTAMP,
    hora_salida TIMESTAMP
);

-- 10. TABLA: HISTORIAL DE ATENCIÓN (AUDITORÍA)
-- ------------------------------------------------------
CREATE TABLE historial_atencion (
    id_historial SERIAL PRIMARY KEY,
    id_atencion INTEGER REFERENCES atencion(id_atencion) ON DELETE CASCADE,
    id_estado INTEGER REFERENCES estado(id_estado),
    fecha_hora TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    observacion TEXT
);

-- 11. ÍNDICES DE RENDIMIENTO (BÚSQUEDAS RÁPIDAS)
-- ------------------------------------------------------
CREATE INDEX idx_paciente_cedula ON pacientes(cedula);
CREATE INDEX idx_usuario_cedula ON usuarios(cedula);
CREATE INDEX idx_atencion_estado ON atencion(id_estado_actual);
CREATE INDEX idx_atencion_sede ON atencion(id_sede);

-- ======================================================
-- DATOS SEMILLA (CONFIGURACIÓN INICIAL)
-- ======================================================

-- Sedes
INSERT INTO sedes (nombre, direccion) VALUES 
('CLÍNICA MATRIZ', 'AV. CENTRAL 123'),
('SEDE NORTE', 'CALLE NORTE 456');

-- Estados de la Cola
INSERT INTO estado (nombre_estado) VALUES 
('REGISTRO'), ('SALA DE ESPERA'), ('LLAMADO'), ('EN CONSULTA'), ('ATENDIDO'), ('CANCELADO');

-- Responsables de Pago
INSERT INTO responsable_pago (nombre) VALUES 
('PARTICULAR'), ('SEGURO CONTINENTAL'), ('SEGURO SALUD YA');

-- Servicios de Ejemplo para Sede Matriz (ID: 1)
INSERT INTO servicio (id_sede, nombre_servicio, prefijo, piso) VALUES 
(1, 'MEDICINA GENERAL', 'GEN', 1),
(1, 'CARDIOLOGÍA', 'CARD', 2),
(1, 'LABORATORIO', 'LAB', 1),
(1, 'IMÁGENES', 'IMG', 1);

-- Admin Inicial (Password: 123) - Login: 0000
INSERT INTO usuarios (id_sede, cedula, password_hash, rol, nombre, apellido) VALUES 
(1, '0000', '$2b$10$7TfEcOV1HssTSa7kHRa7VOwjK/08UzQnO8NjZTM3RLRa64qiajG5e', 'admin', 'ADMIN', 'SISTEMA');
