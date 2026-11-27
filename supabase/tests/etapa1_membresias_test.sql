-- SOLO LOCAL, después del fixture y de la migración, en la misma conexión.
begin;
create or replace function pg_temp.comprobar(ok boolean, mensaje text) returns void
language plpgsql as $$ begin
 if ok is distinct from true then raise exception 'FALLO: %',mensaje; end if;
 raise notice 'OK: %',mensaje;
end $$;
grant execute on function pg_temp.comprobar(boolean,text) to authenticated, anon;
create or replace function pg_temp.como(uid uuid) returns void language plpgsql as $$ begin
 perform set_config('request.jwt.claims',json_build_object('sub',uid,'role','authenticated')::text,true);
 perform set_config('role','authenticated',true);
end $$;
grant execute on function pg_temp.como(uuid) to authenticated;
-- Compara TODAS las filas de las 13 tablas existentes, no solo conteos.
do $$ declare r record; actual jsonb; begin
 for r in select * from etapa1_snapshot loop
  execute format('select coalesce(jsonb_agg((to_jsonb(t) - %L) order by t.id), ''[]''::jsonb) from public.%I t',
    case when r.tabla='espacios' then 'tipo' else '__sin_cambios__' end,r.tabla) into actual;
  perform pg_temp.comprobar(actual=r.filas,'filas intactas: ' || r.tabla);
 end loop;
end $$;
select pg_temp.comprobar(not exists(select 1 from public.espacios where tipo <> 'hogar'),'todos los espacios existentes son hogares');
select pg_temp.comprobar((select count(*) from public.espacio_miembros)=3,'backfill incluye exactamente los tres perfiles con espacio');
select pg_temp.comprobar(not exists (
 select 1 from public.espacios e where
 (select count(*) from public.perfiles p where p.espacio_id=e.id) <>
 (select count(*) from public.espacio_miembros m where m.espacio_id=e.id and activo)
),'conteos por espacio iguales, incluido hogar vacío');
select pg_temp.comprobar((select rol_plantilla='admin' from public.espacio_miembros where usuario_id='e1000000-0000-4000-8000-000000000001'),'admin_hogar se mapea a admin');
select pg_temp.comprobar((select rol_plantilla='miembro' from public.espacio_miembros where usuario_id='e1000000-0000-4000-8000-000000000003'),'superadmin no obtiene admin de hogar');
create temporary table miembros_antes as select * from public.espacio_miembros;
insert into public.espacio_miembros (espacio_id,usuario_id,rol_plantilla)
select espacio_id,id,case when rol='admin_hogar' then 'admin' else 'miembro' end
from public.perfiles where espacio_id is not null on conflict (espacio_id,usuario_id) do nothing;
select pg_temp.comprobar(not exists ((select * from miembros_antes except select * from public.espacio_miembros) union all
 (select * from public.espacio_miembros except select * from miembros_antes)),'repetir backfill conserva IDs, roles, fechas y conteos');
-- Preservar hogares históricos sobre límite sin romper backfill repetido.
update public.espacios set limite_usuarios=1 where id='e2000000-0000-4000-8000-000000000001';
insert into public.espacio_miembros (espacio_id,usuario_id,rol_plantilla)
select espacio_id,id,case when rol='admin_hogar' then 'admin' else 'miembro' end
from public.perfiles where espacio_id is not null on conflict (espacio_id,usuario_id) do nothing;
select pg_temp.comprobar((select count(*) from public.espacio_miembros)=3,'backfill repetido preserva incluso hogares sobre límite');
update public.espacios set limite_usuarios=2 where id='e2000000-0000-4000-8000-000000000001';
select pg_temp.comprobar(not has_table_privilege('anon','public.espacio_miembros','SELECT')
 and not has_table_privilege('authenticated','public.espacio_miembros','INSERT')
 and not has_table_privilege('authenticated','public.espacio_miembros','UPDATE')
 and not has_table_privilege('authenticated','public.espacio_miembros','DELETE')
 and not has_table_privilege('authenticated','public.espacio_miembros','TRUNCATE'),'grants mínimos de membresías');
select pg_temp.comprobar(not exists (
 select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
 and (has_function_privilege('anon',p.oid,'EXECUTE') or
 (p.proname in ('sincronizar_membresia_perfil','validar_membresia_compatible') and has_function_privilege('authenticated',p.oid,'EXECUTE')))
),'funciones no expuestas a anon ni triggers a authenticated');
select pg_temp.como('e1000000-0000-4000-8000-000000000002');
select pg_temp.comprobar((select count(*) from public.espacio_miembros)=1,'RLS solo muestra membresía propia');
select pg_temp.comprobar((select count(*) from public.gastos)=2 and (select count(*) from public.ingresos_mensuales)=2,'familia conserva datos y aislamiento');
select pg_temp.comprobar(public.mi_espacio_id()='e2000000-0000-4000-8000-000000000001','helper legado intacto');
select pg_temp.comprobar(public.unirse_a_espacio('etapa1a')=public.mi_espacio_id(),'RPC unirse idempotente aun con hogar lleno');
update public.perfiles set espacio_id=null where id=auth.uid();
select pg_temp.comprobar((select count(*) from public.gastos)=0 and
 (select count(*) from public.espacio_miembros where activo)=0,'salir revoca acceso y desactiva membresía');
select public.unirse_a_espacio('ETAPA1A');
select pg_temp.comprobar((select count(*) from public.espacio_miembros)=1 and
 (select bool_and(activo) from public.espacio_miembros),'reingreso reactiva sin duplicar');
reset role;
-- P0001 exige una bandera fuera del handler: no confundir el fallo de la prueba con el esperado.
select pg_temp.como('e1000000-0000-4000-8000-000000000004');
do $$ declare rechazado boolean := false; begin
 begin perform public.unirse_a_espacio('ETAPA1A'); exception when raise_exception then
  if sqlerrm not like 'Límite de usuarios alcanzado%' then raise; end if; rechazado:=true;
 end;
 perform pg_temp.comprobar(rechazado,'límite por RPC');
end $$;
select public.unirse_a_espacio('ETAPA1B');
select pg_temp.comprobar((select rol_plantilla='miembro' from public.espacio_miembros),'unirse escribe membresía');
reset role;
-- Cambios administrativos de perfil se reflejan; borrado de perfil limpia por FK.
update public.perfiles set rol='admin_hogar' where id='e1000000-0000-4000-8000-000000000004';
select pg_temp.comprobar((select rol_plantilla='admin' from public.espacio_miembros where usuario_id='e1000000-0000-4000-8000-000000000004'),'sincroniza cambios administrativos de rol');
update public.perfiles set espacio_id='e2000000-0000-4000-8000-000000000003' where id='e1000000-0000-4000-8000-000000000004';
select pg_temp.comprobar((select count(*)=1 from public.espacio_miembros where usuario_id='e1000000-0000-4000-8000-000000000004' and activo),'cambio administrativo deja una sola activa');
select pg_temp.como('e1000000-0000-4000-8000-000000000005');
select public.crear_espacio('Hogar nuevo','Creador');
select pg_temp.comprobar((select rol_plantilla='admin' and activo from public.espacio_miembros),'crear escribe membresía admin');
reset role;
-- El límite se basa en activas aunque una membresía inactiva permanezca.
select pg_temp.como('e1000000-0000-4000-8000-000000000004');
update public.perfiles set espacio_id=null where id=auth.uid();
reset role;
select pg_temp.como('e1000000-0000-4000-8000-000000000006');
select public.unirse_a_espacio('ETAPA1C');
select pg_temp.comprobar(not public.verificar_espacio_disponible(public.mi_espacio_id()),'inactiva no consume cupo; activa llena hogar de uno');
reset role;
-- Defensa contra organizaciones y tipos inválidos; aún no hay circuito empresarial.
insert into public.espacios (id,nombre_familia,codigo_invitacion,tipo)
values ('e2000000-0000-4000-8000-000000000009','Reservado futuro','ETAPA1O','organizacion');
select pg_temp.como('e1000000-0000-4000-8000-000000000007');
do $$ begin
 begin perform public.unirse_a_espacio('ETAPA1O');
 exception when insufficient_privilege then
  raise notice 'OK: organización rechazada por RPC familiar'; return;
 end;
 raise exception 'FALLO: organización aceptada';
end $$;
reset role;
do $$ begin
 begin insert into public.espacio_miembros (espacio_id,usuario_id)
 values ('e2000000-0000-4000-8000-000000000002','e1000000-0000-4000-8000-000000000002');
 exception when check_violation or unique_violation then
  raise notice 'OK: segunda membresía activa rechazada incluso por servidor'; return;
 end;
 raise exception 'FALLO: segunda membresía aceptada';
end $$;
delete from public.perfiles where id='e1000000-0000-4000-8000-000000000002';
select pg_temp.comprobar(not exists(select 1 from public.espacio_miembros where usuario_id='e1000000-0000-4000-8000-000000000002'),'borrado legado de perfil no deja membresía huérfana');
rollback;
