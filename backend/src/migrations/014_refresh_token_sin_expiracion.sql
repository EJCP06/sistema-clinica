-- ======================================================
-- MIGRACIÓN 014: Refresh tokens sin expiración
-- ======================================================
-- Permitir que expira sea NULL (refresh token sin expiración)
ALTER TABLE "Refresh_Tokens" ALTER COLUMN "expira" DROP NOT NULL;

-- Limpiar tokens viejos ya expirados
DELETE FROM "Refresh_Tokens" WHERE expira < NOW() AND revocado = false;
