-- Rollback funcional de M6: apaga aceptación sin reabrir links previos a bajas.
-- Conserva sellos y trigger para no perder evidencia de seguridad.
-- Para reactivar tras resolver la incidencia: GRANT EXECUTE sobre esta firma
-- a authenticated, solo después de verificar que la definición M6 sigue vigente.
begin;
set local lock_timeout = '5s';
revoke execute on function public.aceptar_invitacion_org(text,integer) from public, anon, authenticated;
commit;
