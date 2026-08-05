-- ======================================================
-- MIGRACIÓN 015: Quitar admision:marcar_ausente al rol analista
-- El analista solo debe tener APS y Aseguradoras.
-- Puede marcar pacientes ausentes vía aps:marcar_ausente
-- (inyectado con la vista APS), no vía admision.
-- ======================================================

DELETE FROM "Roles_Recursos_Acciones" rra
USING "Roles" r, "Recursos" rec, "Acciones" acc
WHERE rra.id_rol = r.id_rol
  AND rra.id_recurso = rec.id_recurso
  AND rra.id_accion = acc.id_accion
  AND r.key = 'analista'
  AND rec.key = 'admision'
  AND acc.key = 'marcar_ausente';
