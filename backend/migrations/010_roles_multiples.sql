-- Migración: Roles múltiples por usuario
-- Cada usuario puede tener varios roles y elegir con cuál entrar al sistema.

-- 1. Crear tabla de relación muchos a muchos
CREATE TABLE IF NOT EXISTS "Usuario_Rol" (
  id_usuario INTEGER NOT NULL REFERENCES "Usuarios"("id_usuario") ON DELETE CASCADE,
  id_rol INTEGER NOT NULL REFERENCES "Roles"("id_rol") ON DELETE CASCADE,
  PRIMARY KEY (id_usuario, id_rol)
);

-- 2. Migrar el id_rol actual de cada usuario a la nueva tabla
INSERT INTO "Usuario_Rol" (id_usuario, id_rol)
SELECT id_usuario, id_rol
FROM "Usuarios"
WHERE id_rol IS NOT NULL
ON CONFLICT DO NOTHING;

-- 3. Crear índice para búsquedas rápidas por usuario
CREATE INDEX IF NOT EXISTS idx_usuario_rol_usuario ON "Usuario_Rol"(id_usuario);

-- 4. (Opcional) Crear índice por rol paraadmin queries
CREATE INDEX IF NOT EXISTS idx_usuario_rol_rol ON "Usuario_Rol"(id_rol);
