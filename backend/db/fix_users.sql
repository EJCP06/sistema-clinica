-- 1. Limpiar usuarios para evitar conflictos
TRUNCATE TABLE "Usuarios" RESTART IDENTITY CASCADE;

-- 2. Insertar Admin (Password: 123456)
-- El hash es compatible con bcryptjs
INSERT INTO "Usuarios" ("username", "password_hash", "rol", "nombre", "apellido", "cedula", "status") 
VALUES ('admin', '$2b$10$aRyd7WylR8Lxq.lQJFViGuFMf2QK.SxxY2iPLr9XHz5HEvv96jPou', 'admin', 'Admin', 'Sistema', '00000000', true);

-- 3. Insertar Recepcionista
INSERT INTO "Usuarios" ("username", "password_hash", "rol", "nombre", "apellido", "cedula", "status") 
VALUES ('recepcion', '$2b$10$aRyd7WylR8Lxq.lQJFViGuFMf2QK.SxxY2iPLr9XHz5HEvv96jPou', 'recepcionista', 'Maria', 'Lopez', '11111111', true);

-- 4. Insertar Médico (Sin id_servicio porque no está en la tabla Usuarios según init.sql)
INSERT INTO "Usuarios" ("username", "password_hash", "rol", "nombre", "apellido", "cedula", "status") 
VALUES ('medico1', '$2b$10$aRyd7WylR8Lxq.lQJFViGuFMf2QK.SxxY2iPLr9XHz5HEvv96jPou', 'medico', 'Dr. Juan', 'Perez', '22222222', true);
