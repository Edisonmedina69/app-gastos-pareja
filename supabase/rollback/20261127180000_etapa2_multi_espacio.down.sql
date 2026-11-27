-- Rollback funcional: cerrar altas empresariales y conservar contexto, membresías,
-- permisos y todos los datos. NUNCA reinstalar mi_espacio_id basado en perfiles.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';
revoke execute on function public.crear_organizacion(text,integer),
  public.crear_invitacion_org(uuid,text,integer), public.aceptar_invitacion_org(text,integer)
  from authenticated;
-- Mantener cliente compatible/selector para cuentas que ya tienen varios espacios.
-- Rehabilitar solo con autorización: GRANT EXECUTE de estas tres firmas.
commit;
