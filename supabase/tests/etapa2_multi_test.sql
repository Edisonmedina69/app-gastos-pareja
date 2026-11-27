-- Solo datos sintéticos. Sesiones reales en auth.sessions, JWT simulado como PostgREST.
begin;
insert into auth.users(id,email)
 select ('20000000-0000-4000-8000-' || lpad(i::text,12,'0'))::uuid, 'etapa2-'||i||'@example.invalid' from generate_series(1,15) i;
insert into auth.sessions(id,user_id) select id,id from auth.users where email like 'etapa2-%@example.invalid';
insert into auth.sessions(id,user_id) values('29999999-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001');
insert into public.org_piloto_usuarios values('20000000-0000-4000-8000-000000000001');
create function pg_temp.como(i integer, sid uuid default null) returns void language plpgsql as $$
begin
 perform set_config('request.jwt.claims',jsonb_build_object('sub',('20000000-0000-4000-8000-'||lpad(i::text,12,'0')),'session_id',coalesce(sid,('20000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid),'role','authenticated')::text,true);
 perform set_config('request.headers','{"x-app-version":"2"}',true);
 perform set_config('role','authenticated',true);
end $$;
create function pg_temp.check(ok boolean,msg text) returns void language plpgsql as $$
begin if ok is not true then raise exception 'FALLO %',msg; end if; raise notice 'OK %',msg; end $$;
grant execute on function pg_temp.como(integer,uuid),pg_temp.check(boolean,text) to authenticated,anon;
select pg_temp.como(1);
select public.crear_espacio('Hogar QA','Ana') as hogar \gset
select pg_temp.check(public.mi_espacio_id() = :'hogar', 'un solo hogar entra directo sin contexto');
select public.crear_organizacion('CaninDevs (QA)',2) as org \gset
select pg_temp.check(public.mi_espacio_id() is null,'varios espacios sin selección deniega acceso');
select pg_temp.check((select count(*) from public.listar_mis_espacios()) = 2,'misma identidad conserva hogar y organización');
select pg_temp.check((select espacio_id from public.perfiles where id=auth.uid()) = :'hogar','organización no cambia legado del hogar');
select public.seleccionar_espacio(:'org');
select pg_temp.check(public.mi_espacio_id() = :'org','selección de organización validada');
select pg_temp.check(public.tiene_permiso(:'org','gastos','pagar'),'admin tiene filas efectivas de pagar');
select pg_temp.check(not public.tiene_permiso(:'org','inventado','ver'),'permiso inexistente denegado por defecto');
select pg_temp.check((select count(*) from public.gastos) = 0,'organización no lee gastos familiares');
do $$ begin
 insert into public.gastos(espacio_id,concepto,monto,moneda) values(public.mi_espacio_id(),'familiar indebido',1,'PYG');
 raise exception 'FALLO insertar finanzas familiares en org';
exception when insufficient_privilege then raise notice 'OK tipo organización bloqueado por guarda familiar'; end $$;
select id,token from public.crear_invitacion_org(:'org','miembro',9) \gset inv_
select id,token from public.crear_invitacion_org(:'org','lectura',1) \gset rev_
select public.revocar_invitacion_org(:'org',:'rev_id');
select id,token from public.crear_invitacion_org(:'org','lectura',1) \gset venc_
select id from public.espacio_miembros where usuario_id=auth.uid() and espacio_id=:'org' \gset admin_
reset role;
update public.org_invitaciones set vence_at=now()-interval '1 second' where id=:'venc_id';
-- Cinco integrantes adicionales: la API y UI prueban por código y por link.
select pg_temp.como(2);
select pg_temp.check(public.aceptar_invitacion_org(:'rev_token',2) ? 'error','token revocado rechazado');
select pg_temp.check(public.aceptar_invitacion_org(:'venc_token',2) ? 'error','token vencido rechazado');
select pg_temp.check(public.aceptar_invitacion_org('incorrecto',2) ? 'error','token inexistente rechazado');
select pg_temp.check(public.aceptar_invitacion_org(:'inv_token',2)->>'espacio_id' = :'org','integrante 2 acepta código');
select pg_temp.check(public.aceptar_invitacion_org(:'inv_token',2)->>'espacio_id' = :'org','reintento idempotente no duplica');
select public.seleccionar_espacio(:'org');
select pg_temp.check(public.tiene_permiso(:'org','ingresos','cobrar'),'miembro puede cobrar');
do $$ begin
 perform public.crear_invitacion_org(public.mi_espacio_id(),'admin',1);
 raise exception 'FALLO miembro invitó admin';
exception when insufficient_privilege then raise notice 'OK miembro no invita ni promueve admins'; end $$;
reset role;
select id from public.espacio_miembros where usuario_id='20000000-0000-4000-8000-000000000002' and espacio_id=:'org' \gset m2_
select pg_temp.como(3);
select public.aceptar_invitacion_org(:'inv_token',2)->>'espacio_id' as joined \gset
reset role;
select pg_temp.como(4);
select public.aceptar_invitacion_org(:'inv_token',2)->>'espacio_id' as joined \gset
reset role;
select pg_temp.como(5);
select public.aceptar_invitacion_org(:'inv_token',2)->>'espacio_id' as joined \gset
reset role;
select pg_temp.como(6);
select public.aceptar_invitacion_org(:'inv_token',2)->>'espacio_id' as joined \gset
reset role;
select pg_temp.check((select count(*) from public.espacio_miembros where espacio_id=:'org' and activo)=6,'sexto integrante permitido; 5 altas sin pareja');
select pg_temp.check((select usos from public.org_invitaciones where id=:'inv_id')=5,'reintento no consume segundo uso');
select pg_temp.check(not exists(select 1 from public.org_invitaciones where token_hash=:'inv_token'),'solo hash del token almacenado');
select pg_temp.como(1);
select public.actualizar_permisos_miembro(:'org',:'m2_id','[{"recurso":"gastos","accion":"pagar","permitido":false},{"recurso":"integrantes","accion":"invitar","permitido":true}]');
do $$ begin
 perform public.actualizar_permisos_miembro(public.mi_espacio_id(),(select id from public.espacio_miembros where usuario_id=auth.uid() and espacio_id=public.mi_espacio_id()),'[]','lectura');
 raise exception 'FALLO degradó último admin';
exception when check_violation then raise notice 'OK último admin protegido'; end $$;
reset role;
select pg_temp.como(2);
select pg_temp.check(not public.tiene_permiso(:'org','gastos','pagar') and public.tiene_permiso(:'org','ingresos','cobrar'),'quitar pagar conserva cobrar sin refrescar JWT');
select id,token from public.crear_invitacion_org(:'org','lectura',1) \gset deleg_
do $$ begin
 perform public.crear_invitacion_org(public.mi_espacio_id(),'miembro',1);
 raise exception 'FALLO invitación delegada otorgó miembro';
exception when insufficient_privilege then raise notice 'OK invitación delegada solo concede lectura'; end $$;
do $$ begin
 perform public.actualizar_permisos_miembro(public.mi_espacio_id(),(select id from public.espacio_miembros where usuario_id=auth.uid()),'[]','admin');
 raise exception 'FALLO auto promoción';
exception when insufficient_privilege then raise notice 'OK no admin no gestiona permisos'; end $$;
reset role;
select pg_temp.como(7);
select public.aceptar_invitacion_org(:'deleg_token',2)->>'espacio_id' as joined \gset
select public.seleccionar_espacio(:'org');
select pg_temp.check(public.tiene_permiso(:'org','finanzas','ver') and not public.tiene_permiso(:'org','gastos','pagar'),'lectura recibe ver y no pagar');
reset role;
select pg_temp.como(1);
select public.actualizar_permisos_miembro(:'org',:'m2_id','[]',null,false);
reset role;
select pg_temp.como(2);
select pg_temp.check(public.mi_espacio_id() is null,'baja invalida contexto inmediatamente');
select pg_temp.check((select count(*) from public.listar_mis_espacios())=0,'baja no lista organización');
reset role;
-- Dos sesiones independientes, misma identidad.
select pg_temp.como(1,'29999999-0000-4000-8000-000000000001');
select pg_temp.check(public.mi_espacio_id() is null,'login nuevo con varios no hereda selección');
select public.seleccionar_espacio(:'hogar');
select pg_temp.check(public.mi_espacio_id()=:'hogar','segundo dispositivo selecciona hogar');
reset role;
select pg_temp.como(1);
select pg_temp.check(public.mi_espacio_id()=:'org','primer dispositivo conserva organización');
do $$ begin
 perform public.seleccionar_espacio('ffffffff-ffff-4fff-8fff-ffffffffffff');
 raise exception 'FALLO forzó espacio ajeno';
exception when insufficient_privilege then raise notice 'OK seleccionar espacio ajeno rechazado'; end $$;
do $$ begin
 insert into public.sesiones_espacio(session_id,usuario_id,espacio_id) values(gen_random_uuid(),auth.uid(),public.mi_espacio_id());
 raise exception 'FALLO escritura directa contexto';
exception when insufficient_privilege then raise notice 'OK contexto inaccesible a escritura directa'; end $$;
do $$ begin
 update public.espacio_miembros set rol_plantilla='admin' where usuario_id=auth.uid();
 raise exception 'FALLO escritura membresía';
exception when insufficient_privilege then raise notice 'OK membresías solo por RPC'; end $$;
do $$ begin
 insert into public.miembro_permisos(espacio_id,miembro_id,recurso,accion,permitido) values(public.mi_espacio_id(),gen_random_uuid(),'gastos','pagar',true);
 raise exception 'FALLO escritura permisos';
exception when insufficient_privilege then raise notice 'OK permisos solo por RPC'; end $$;
select public.seleccionar_espacio(:'hogar');
do $$ begin
 insert into public.gastos(espacio_id,concepto,monto,moneda) values(public.mi_espacio_id(),'viejo',1,'PYG');
 raise exception 'FALLO cliente viejo multi escribe sin esperado';
exception when insufficient_privilege then raise notice 'OK cliente viejo multi debe recargar'; end $$;
select set_config('request.headers',jsonb_build_object('x-app-version','2','x-espacio-id-esperado',:'hogar')::text,true);
insert into public.gastos(espacio_id,concepto,monto,moneda) values(:'hogar','Hogar preservado',1,'PYG');
select pg_temp.check((select count(*) from public.gastos)=1,'hogar opera con contexto esperado');
select set_config('request.headers',jsonb_build_object('x-app-version','2','x-espacio-id-esperado',:'org')::text,true);
do $$ begin
 update public.gastos set monto=2 where concepto='Hogar preservado';
 raise exception 'FALLO mutación atrasada de contexto';
exception when insufficient_privilege then raise notice 'OK mutación con contexto obsoleto rechazada'; end $$;
reset role;
-- Cerrar sesión Auth revoca incluso JWT aún firmado/no vencido.
delete from auth.sessions where id='20000000-0000-4000-8000-000000000001';
select pg_temp.como(1);
select pg_temp.check(public.mi_espacio_id() is null and (select count(*) from public.listar_mis_espacios())=0,'sesión cerrada deniega incluso fallback');
reset role;
select pg_temp.como(1,'20000000-0000-4000-8000-000000000003');
select pg_temp.check(public.mi_espacio_id() is null,'session_id de otra persona no autoriza');
reset role;
select set_config('request.jwt.claims','{"sub":"20000000-0000-4000-8000-000000000001","role":"authenticated","session_id":"roto"}',true);
set local role authenticated;
select pg_temp.check(public.mi_espacio_id() is null,'claim malformado deniega sin lanzar cast');
reset role;
select pg_temp.check(not has_function_privilege('anon','public.aceptar_invitacion_org(text,integer)','execute'),'anon no ejecuta invitaciones');
select pg_temp.check(not has_function_privilege('authenticated','public.aplicar_plantilla_miembro(uuid,text)','execute'),'helper interno sin ejecución cliente');
rollback;
