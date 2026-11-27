-- Regresiones de docs/REVIEW_ETAPA2.md. Solo datos sintéticos; termina en rollback.
begin;
insert into auth.users(id,email)
 select ('40000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'rev2-'||i||'@example.invalid' from generate_series(1,9) i;
insert into auth.sessions(id,user_id) select id,id from auth.users where email like 'rev2-%@example.invalid';
insert into public.org_piloto_usuarios values('40000000-0000-4000-8000-000000000001');
create function pg_temp.como(i integer) returns void language plpgsql as $$
begin
 perform set_config('request.jwt.claims',jsonb_build_object('sub',('40000000-0000-4000-8000-'||lpad(i::text,12,'0')),'session_id',('40000000-0000-4000-8000-'||lpad(i::text,12,'0')),'role','authenticated')::text,true);
 perform set_config('request.headers','{"x-app-version":"2"}',true);
 perform set_config('role','authenticated',true);
end $$;
create function pg_temp.check(ok boolean,msg text) returns void language plpgsql as $$
begin if ok is not true then raise exception 'FALLO %',msg; end if; raise notice 'OK %',msg; end $$;
grant execute on function pg_temp.como(integer),pg_temp.check(boolean,text) to authenticated;
create function pg_temp.miembro(u integer, e uuid) returns uuid language sql as $$
 select id from public.espacio_miembros where usuario_id=('40000000-0000-4000-8000-'||lpad(u::text,12,'0'))::uuid and espacio_id=e $$;

-- Organización con dos admins (1 y 2).
select pg_temp.como(1);
select public.crear_organizacion('Org revisión',2) as org \gset
select public.seleccionar_espacio(:'org');
select token from public.crear_invitacion_org(:'org','admin',10) \gset adm_
select token from public.crear_invitacion_org(:'org','lectura',5) \gset lec_
reset role; select pg_temp.como(2);
select pg_temp.check(public.aceptar_invitacion_org(:'adm_token',2)->>'espacio_id' = :'org','invitación de admin vigente funciona');
select public.seleccionar_espacio(:'org');
reset role;
select pg_temp.miembro(1,:'org') as a_id, pg_temp.miembro(2,:'org') as b_id \gset

-- 1. El admin 1 es dado de baja: sus links dejan de servir, también para él.
select pg_temp.como(2);
select public.actualizar_permisos_miembro(:'org',:'a_id','[]',null,false);
reset role;
select pg_temp.check((select count(*) from public.org_invitaciones where espacio_id=:'org' and creada_por='40000000-0000-4000-8000-000000000001' and revocada_at is null) = 0,'baja revoca invitaciones pendientes del creador');
select pg_temp.como(1);
select pg_temp.check(public.aceptar_invitacion_org(:'adm_token',2) ? 'error','admin dado de baja no reingresa con su propio link');
reset role; select pg_temp.como(3);
select pg_temp.check(public.aceptar_invitacion_org(:'lec_token',2) ? 'error','link de lectura del admin dado de baja tampoco sirve');
reset role;
select pg_temp.check((select activo and rol_plantilla='admin' from public.espacio_miembros where id=:'b_id'),'admin restante conserva el control');

-- 2. Invitación vigente aunque el trigger no la haya revocado: se revalida al aceptar.
reset role;
alter table public.espacio_miembros disable trigger tr_revocar_invitaciones_de_baja;
select pg_temp.como(2);
select token from public.crear_invitacion_org(:'org','miembro',3) \gset m_
reset role; select pg_temp.como(4);
select public.aceptar_invitacion_org(:'m_token',2)->>'espacio_id' as unido4 \gset
select public.seleccionar_espacio(:'org');
reset role;
select pg_temp.miembro(4,:'org') as d_id \gset
-- 4 recibe permiso delegado y emite lectura; luego se le quita el permiso.
select pg_temp.como(2);
select public.actualizar_permisos_miembro(:'org',:'d_id','[{"recurso":"integrantes","accion":"invitar","permitido":true}]');
reset role; select pg_temp.como(4);
select token from public.crear_invitacion_org(:'org','lectura',2) \gset del_
reset role; select pg_temp.como(2);
select public.actualizar_permisos_miembro(:'org',:'d_id','[{"recurso":"integrantes","accion":"invitar","permitido":false}]');
reset role; select pg_temp.como(5);
select pg_temp.check(public.aceptar_invitacion_org(:'del_token',2) ? 'error','permiso delegado retirado invalida su invitación');
reset role;
select pg_temp.check((select revocada_at is not null from public.org_invitaciones where creada_por='40000000-0000-4000-8000-000000000004'),'invitación inválida queda marcada como revocada');
alter table public.espacio_miembros enable trigger tr_revocar_invitaciones_de_baja;

-- 3. Degradar a un admin revoca sus invitaciones que no son de lectura.
select pg_temp.como(2);
select public.actualizar_permisos_miembro(:'org',:'d_id','[]','admin');
reset role; select pg_temp.como(4);
select public.seleccionar_espacio(:'org');
select token from public.crear_invitacion_org(:'org','contador',1) \gset cont_
reset role; select pg_temp.como(2);
select public.actualizar_permisos_miembro(:'org',:'d_id','[]','miembro');
reset role;
select pg_temp.check((select revocada_at is not null from public.org_invitaciones where creada_por='40000000-0000-4000-8000-000000000004' and rol='contador'),'degradar admin revoca invitaciones privilegiadas');

-- M6. Baja + link multiuso ajeno vigente: no reabre; reactivar o invitación nueva sí.
select pg_temp.como(2);
select token from public.crear_invitacion_org(:'org','lectura',5) \gset multi_
reset role; select pg_temp.como(9);
select pg_temp.check(public.aceptar_invitacion_org(:'multi_token',2)->>'espacio_id' = :'org','integrante 9 entra con link multiuso');
reset role;
select pg_temp.miembro(9,:'org') as i_id \gset
select pg_temp.check((select desactivado_at is null from public.espacio_miembros where id=:'i_id'),'membresía activa sin sello de baja');
select pg_temp.como(2);
select public.actualizar_permisos_miembro(:'org',:'i_id','[]',null,false);
reset role;
select pg_temp.check((select desactivado_at is not null from public.espacio_miembros where id=:'i_id'),'la baja queda sellada');
select pg_temp.check((select revocada_at is null from public.org_invitaciones where id=(select id from public.org_invitaciones where creada_por='40000000-0000-4000-8000-000000000002' and rol='lectura' and max_usos=5)),'el link del admin que dio la baja sigue vigente para otros');
select pg_temp.como(9);
select pg_temp.check(public.aceptar_invitacion_org(:'multi_token',2) ? 'error','dado de baja no reingresa con link multiuso previo');
reset role;
select pg_temp.check((select not activo from public.espacio_miembros where id=:'i_id'),'sigue dado de baja');
select pg_temp.check((select usos from public.org_invitaciones where creada_por='40000000-0000-4000-8000-000000000002' and rol='lectura' and max_usos=5) = 1,'intento rechazado no consume usos');
-- Invitación nueva, emitida después de la baja: sí.
select pg_temp.como(2);
select token from public.crear_invitacion_org(:'org','lectura',1) \gset nueva_
reset role; select pg_temp.como(9);
select pg_temp.check(public.aceptar_invitacion_org(:'nueva_token',2)->>'espacio_id' = :'org','invitación nueva posterior a la baja permite volver');
reset role;
select pg_temp.check((select activo from public.espacio_miembros where id=:'i_id'),'integrante reactivado por invitación nueva');
-- Otra baja y reactivación directa por admin: sí.
select pg_temp.como(2);
select public.actualizar_permisos_miembro(:'org',:'i_id','[]',null,false);
select public.actualizar_permisos_miembro(:'org',:'i_id','[]',null,true);
reset role;
select pg_temp.check((select activo from public.espacio_miembros where id=:'i_id'),'admin puede reactivar directamente');
select pg_temp.como(9);
do $$ begin
 update public.espacio_miembros set desactivado_at = null;
 raise exception 'FALLO cliente editó sello de baja';
exception when insufficient_privilege then raise notice 'OK cliente no puede borrar su sello de baja'; end $$;
reset role;

-- 4. Salir de un hogar y crear otro no deja la sesión sin espacio.
select pg_temp.como(6);
select public.crear_espacio('Hogar viejo','Ana') as h_viejo \gset
select public.salir_de_espacio(:'h_viejo');
select public.crear_espacio('Hogar nuevo','Ana') as h_nuevo \gset
select pg_temp.check(public.mi_espacio_id() = :'h_nuevo','tras salir, el hogar nuevo entra directo');
insert into public.gastos(espacio_id,concepto,monto,moneda) values(:'h_nuevo','luz',1,'PYG');
reset role;

-- 5. Superadmin borra un hogar con datos; los usuarios comunes siguen sin poder borrar ajenos.
select pg_temp.como(7);
select public.crear_espacio('Hogar a borrar','Beto') as h_borrar \gset
insert into public.gastos(espacio_id,concepto,monto,moneda) values(:'h_borrar','agua',1,'PYG');
reset role; select pg_temp.como(6);
select pg_temp.check((select count(*) from public.gastos where espacio_id=:'h_borrar') = 0,'otro hogar no ve gastos ajenos');
delete from public.gastos where espacio_id = :'h_borrar';
reset role;
select pg_temp.check((select count(*) from public.gastos where espacio_id=:'h_borrar') = 1,'otro hogar no borra gastos ajenos');
insert into public.perfiles(id,nombre,rol) values('40000000-0000-4000-8000-000000000008','SA','superadmin');
select pg_temp.como(8);
delete from public.espacios where id = :'h_borrar';
reset role;
select pg_temp.check(not exists(select 1 from public.espacios where id=:'h_borrar') and not exists(select 1 from public.gastos where espacio_id=:'h_borrar'),'superadmin borra hogar con datos en cascada');
rollback;
