-- Insertar médico de prueba CI: 12345 Pass: 123456
-- Usamos el hash de 123456: $2b$10$Gf.v1Y8IuM3jQ9W9vF.O4uH2mS7zL/K1i6x8tG5vD3lB2nN7mY9W6
INSERT INTO "Usuarios" (cedula, password_hash, nombre, apellido, rol, status, id_servicio, id_consultorio) 
VALUES ('12345', '$2b$10$Gf.v1Y8IuM3jQ9W9vF.O4uH2mS7zL/K1i6x8tG5vD3lB2nN7mY9W6', 'Dr. Prueba', 'Gomez', 'medico', true, 1, 1);
