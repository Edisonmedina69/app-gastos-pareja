-- Después de la corrección: la organización existente sigue operando igual.
begin;
create function pg_temp.check(ok boolean,msg text) returns void language plpgsql as $$
begin if ok is not true then raise exception 'FALLO %',msg; end if; raise notice 'OK %',msg; end $$;
grant execute on function pg_temp.check(boolean,text) to authenticated;
select id as org from public.espacios where nombre_familia = 'CaninDevs (prueba)' \gset
select pg_temp.check((select activo and rol_plantilla='admin' and desactivado_at is null from public.espacio_miembros
  where espacio_id=:'org' and usuario_id='50000000-0000-4000-8000-000000000001'),'org existente: dueño sigue admin activo sin sello de baja');
select set_config('request.jwt.claims','{"sub":"50000000-0000-4000-8000-000000000001","session_id":"50000000-0000-4000-8000-000000000001","role":"authenticated"}',true),
       set_config('request.headers','{"x-app-version":"2"}',true), set_config('role','authenticated',true);
select pg_temp.check(public.mi_espacio_id() = :'org','org existente: el contexto de sesión se conserva');
select pg_temp.check(public.es_admin_espacio(:'org') and public.tiene_permiso(:'org','integrantes','invitar'),'org existente: permisos de admin intactos');
select token from public.crear_invitacion_org(:'org','miembro',1) \gset inv_
select pg_temp.check((select count(*) from public.listar_integrantes_org(:'org')) = 1,'org existente: listado de integrantes');
reset role;
select set_config('request.jwt.claims','{"sub":"50000000-0000-4000-8000-000000000002","session_id":"50000000-0000-4000-8000-000000000002","role":"authenticated"}',true),
       set_config('request.headers','{"x-app-version":"2"}',true), set_config('role','authenticated',true);
select pg_temp.check(public.aceptar_invitacion_org(:'inv_token',2)->>'espacio_id' = :'org','org existente: invitación nueva funciona');
reset role;
rollback;
