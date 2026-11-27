-- =============================================================================
-- Pruebas de la migración 20261126120000_p0_aislamiento_espacios.sql
--
-- SOLO PARA UNA BASE LOCAL O DE PRUEBA (`supabase start`). Inserta usuarios en
-- auth.users y lo deshace todo al final (ROLLBACK).
-- Simula cada request de PostgREST con `set local role authenticated` y el JWT
-- de cada cuenta en `request.jwt.claims`.
--
-- Uso: psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/p0_aislamiento_espacios_test.sql
-- Cada prueba imprime "OK ..." o aborta con "FALLO ...".
-- =============================================================================
begin;

-- ---------- Datos de prueba (como postgres) ----------
-- Espacio QA (límite 2): qa+1 admin, qa+2 miembro. qa+3 sin espacio.
-- Familia ajena: un miembro y un gasto.
delete from auth.users where email in ('qa.canindevs+1@example.com', 'qa.canindevs+2@example.com',
  'qa.canindevs+3@example.com', 'familia.ajena@example.com', 'otro.usuario@example.com', 'nuevo@example.com');
delete from public.espacios where codigo_invitacion in ('QACDEV', 'AJENA1', 'ABIER1', 'SUPER1');
insert into auth.users (id, email) values
  ('b81f68e9-01ee-4a15-9b7a-bcf39065d54c', 'qa.canindevs+1@example.com'),
  ('a788b905-c063-4f64-bc05-d1334b6d274c', 'qa.canindevs+2@example.com'),
  ('5e0f0b74-0828-4ba9-b34f-3ba45f1b0a6f', 'qa.canindevs+3@example.com'),
  ('00000000-0000-4000-8000-0000000000a1', 'familia.ajena@example.com'),
  ('00000000-0000-4000-8000-0000000000a2', 'otro.usuario@example.com');

insert into public.espacios (id, nombre_familia, codigo_invitacion, limite_usuarios) values
  ('1759040a-d53b-42d7-a0bd-37cb2f2312db', 'CaninDevs (QA)', 'QACDEV', 2),
  ('00000000-0000-4000-8000-00000000e5e1', 'Familia Ajena',  'AJENA1', 2),
  ('00000000-0000-4000-8000-00000000e5e2', 'Espacio Abierto', 'ABIER1', 3);

insert into public.perfiles (id, espacio_id, nombre, rol) values
  ('b81f68e9-01ee-4a15-9b7a-bcf39065d54c', '1759040a-d53b-42d7-a0bd-37cb2f2312db', 'Admin CaninDevs', 'admin_hogar'),
  ('a788b905-c063-4f64-bc05-d1334b6d274c', '1759040a-d53b-42d7-a0bd-37cb2f2312db', 'Dev 2', 'miembro'),
  ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000e5e1', 'Ajeno', 'admin_hogar');

insert into public.gastos (espacio_id, usuario_id, pagador_id, monto, moneda, concepto) values
  ('1759040a-d53b-42d7-a0bd-37cb2f2312db', 'b81f68e9-01ee-4a15-9b7a-bcf39065d54c', 'b81f68e9-01ee-4a15-9b7a-bcf39065d54c', 100000, 'PYG', 'Hosting QA'),
  ('00000000-0000-4000-8000-00000000e5e1', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000a1', 999999, 'PYG', 'Gasto privado ajeno');

insert into public.cuentas_maestras (espacio_id, titulo, monto_total, cantidad_cuotas) values
  ('00000000-0000-4000-8000-00000000e5e1', 'Cuenta ajena', 1000, 1);

-- Helper: actuar como un usuario (dentro de la transacción).
create or replace function pg_temp.como(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
grant execute on function pg_temp.como(uuid) to authenticated, anon;

create or replace function pg_temp.check(p_ok boolean, p_msg text) returns void language plpgsql as $$
begin
  if p_ok then raise notice 'OK    %', p_msg; else raise exception 'FALLO %', p_msg; end if;
end $$;
grant execute on function pg_temp.check(boolean, text) to authenticated, anon;

-- ============ 1. Usuario sin espacio (qa+3) no ve ningún espacio ============
select pg_temp.como('5e0f0b74-0828-4ba9-b34f-3ba45f1b0a6f');
select pg_temp.check((select count(*) from public.espacios) = 0, '1a qa+3 sin espacio no lista espacios');
select pg_temp.check((select count(*) from public.espacios where codigo_invitacion is not null) = 0, '1b qa+3 no ve códigos de invitación');
select pg_temp.check((select count(*) from public.gastos) = 0, '1c qa+3 no ve gastos');
select pg_temp.check((select count(*) from public.cuentas_maestras) = 0, '1d qa+3 no ve cuentas_maestras (antes using(true))');
select pg_temp.check((select count(*) from public.perfiles) = 0, '1e qa+3 no ve perfiles ajenos');
reset role;

-- anon tampoco ve nada y no recibe error (lo usa el keepalive de CI)
set local role anon;
select pg_temp.check((select count(*) from public.espacios) = 0, '1f anon: GET espacios devuelve 0 filas sin error');
reset role;

-- ============ 2. No puede ponerse un espacio_id ajeno ============
select pg_temp.como('5e0f0b74-0828-4ba9-b34f-3ba45f1b0a6f');
do $$ begin
  -- Exploit del reporte: POST /perfiles con Prefer: resolution=merge-duplicates
  insert into public.perfiles (id, espacio_id, nombre)
  values ('5e0f0b74-0828-4ba9-b34f-3ba45f1b0a6f', '1759040a-d53b-42d7-a0bd-37cb2f2312db', 'Dev 3')
  on conflict (id) do update set espacio_id = excluded.espacio_id;
  raise exception 'FALLO 2a upsert con espacio_id ajeno fue aceptado';
exception when insufficient_privilege then raise notice 'OK    2a upsert con espacio_id ajeno rechazado: %', sqlerrm;
end $$;

-- Perfil propio sin espacio sí se puede crear (flujo normal post-registro)
insert into public.perfiles (id, nombre) values ('5e0f0b74-0828-4ba9-b34f-3ba45f1b0a6f', 'Dev 3');
select pg_temp.check((select count(*) from public.perfiles) = 1, '2b qa+3 puede crear su perfil sin espacio');

do $$ begin
  update public.perfiles set espacio_id = '00000000-0000-4000-8000-00000000e5e1'
  where id = '5e0f0b74-0828-4ba9-b34f-3ba45f1b0a6f';
  raise exception 'FALLO 2c UPDATE de espacio_id aceptado';
exception when insufficient_privilege then raise notice 'OK    2c UPDATE de espacio_id rechazado';
end $$;

do $$ begin
  update public.perfiles set rol = 'superadmin' where id = '5e0f0b74-0828-4ba9-b34f-3ba45f1b0a6f';
  raise exception 'FALLO 2d autoasignarse superadmin aceptado';
exception when insufficient_privilege then raise notice 'OK    2d autoasignarse superadmin rechazado';
end $$;

do $$ begin
  insert into public.espacios (nombre_familia, codigo_invitacion) values ('Espacio pirata', 'PIRATA');
  raise exception 'FALLO 2e INSERT directo en espacios aceptado';
exception when insufficient_privilege then raise notice 'OK    2e INSERT directo en espacios rechazado (RLS)';
end $$;

do $$ begin
  insert into public.gastos (espacio_id, monto, moneda, concepto)
  values ('00000000-0000-4000-8000-00000000e5e1', 1, 'PYG', 'inyectado');
  raise exception 'FALLO 2f INSERT de gasto en espacio ajeno aceptado';
exception when insufficient_privilege then raise notice 'OK    2f INSERT de gasto en espacio ajeno rechazado';
end $$;
-- Cambiar el nombre propio sigue permitido
update public.perfiles set nombre = 'Dev Tres' where id = '5e0f0b74-0828-4ba9-b34f-3ba45f1b0a6f';
select pg_temp.check((select nombre from public.perfiles where id = '5e0f0b74-0828-4ba9-b34f-3ba45f1b0a6f') = 'Dev Tres', '2g editar el nombre propio sigue funcionando');
reset role;

-- ============ 3. Solo se une con un código válido ============
select pg_temp.como('5e0f0b74-0828-4ba9-b34f-3ba45f1b0a6f');
do $$ begin
  perform public.unirse_a_espacio('NOEXIS');
  raise exception 'FALLO 3a código inexistente aceptado';
exception when invalid_parameter_value then raise notice 'OK    3a código inexistente rechazado';
end $$;
do $$ begin
  perform public.unirse_a_espacio('');
  raise exception 'FALLO 3b código vacío aceptado';
exception when invalid_parameter_value then raise notice 'OK    3b código vacío rechazado';
end $$;
select pg_temp.check(public.unirse_a_espacio('abier1', 'Dev 3') = '00000000-0000-4000-8000-00000000e5e2', '3c código válido (sin distinguir mayúsculas) une al espacio');
select pg_temp.check((select rol from public.perfiles where id = auth.uid()) = 'miembro', '3d entra con rol miembro');
select pg_temp.check((select count(*) from public.espacios) = 1, '3e ahora ve solo su espacio');
select pg_temp.check(public.unirse_a_espacio('ABIER1') = '00000000-0000-4000-8000-00000000e5e2', '3f repetir el código es idempotente');
do $$ begin
  perform public.unirse_a_espacio('AJENA1');
  raise exception 'FALLO 3g cambiar de espacio con otro código aceptado';
exception when insufficient_privilege then raise notice 'OK    3g ya en un espacio: no puede saltar a otro';
end $$;
reset role;

-- anon no puede ejecutar las RPC
set local role anon;
do $$ begin
  perform public.unirse_a_espacio('QACDEV');
  raise exception 'FALLO 3h anon ejecutó unirse_a_espacio';
exception when insufficient_privilege then raise notice 'OK    3h anon no puede ejecutar unirse_a_espacio';
end $$;
reset role;

-- ============ 4. El límite se aplica (QA tiene límite 2 y ya 2 miembros) ============
select pg_temp.como('00000000-0000-4000-8000-0000000000a2');
do $$ begin
  perform public.unirse_a_espacio('QACDEV', 'Intruso');
  raise exception 'FALLO 4a tercer miembro aceptado con límite 2';
exception when raise_exception then raise notice 'OK    4a RPC: %', sqlerrm;
end $$;
reset role;
-- El trigger también lo aplica aunque la escritura venga de un superadmin o del servidor
do $$ begin
  insert into public.perfiles (id, espacio_id, nombre)
  values ('00000000-0000-4000-8000-0000000000a2', '1759040a-d53b-42d7-a0bd-37cb2f2312db', 'Intruso');
  raise exception 'FALLO 4b trigger no aplicó el límite';
exception when raise_exception then raise notice 'OK    4b trigger SECURITY DEFINER: %', sqlerrm;
end $$;
-- Con lugar libre, entra (crea el perfil si no existía)
select pg_temp.como('00000000-0000-4000-8000-0000000000a2');
select pg_temp.check(public.unirse_a_espacio('ABIER1') = '00000000-0000-4000-8000-00000000e5e2', '4c con lugar libre entra (2/3)');
reset role;

-- ============ 5. Un miembro existente sigue viendo y cargando gastos ============
select pg_temp.como('a788b905-c063-4f64-bc05-d1334b6d274c');   -- qa+2
select pg_temp.check((select count(*) from public.espacios) = 1, '5a qa+2 ve su espacio');
select pg_temp.check((select codigo_invitacion from public.espacios) = 'QACDEV', '5b qa+2 ve el código de SU espacio');
select pg_temp.check((select count(*) from public.perfiles) = 2, '5c qa+2 ve a los 2 miembros de su espacio');
select pg_temp.check((select count(*) from public.gastos) = 1 and (select concepto from public.gastos) = 'Hosting QA', '5d qa+2 ve solo los gastos de su espacio');
insert into public.gastos (espacio_id, usuario_id, pagador_id, monto, moneda, concepto)
values (public.mi_espacio_id(), auth.uid(), auth.uid(), 50000, 'PYG', 'Dominio QA');
select pg_temp.check((select count(*) from public.gastos) = 2, '5e qa+2 carga un gasto');
update public.gastos set monto = 60000 where concepto = 'Dominio QA';
delete from public.gastos where concepto = 'Dominio QA';
select pg_temp.check((select count(*) from public.gastos) = 1, '5f qa+2 edita y borra su gasto');
insert into public.gastos_programados (espacio_id, concepto, monto) values (public.mi_espacio_id(), 'VPS', 340000);
select pg_temp.check((select count(*) from public.gastos_programados) = 1, '5g qa+2 carga un gasto fijo');
select pg_temp.check(public.verificar_espacio_disponible('1759040a-d53b-42d7-a0bd-37cb2f2312db') = false, '5h verificar_espacio_disponible: su espacio está lleno');
select pg_temp.check(public.verificar_espacio_disponible('00000000-0000-4000-8000-00000000e5e1') is null, '5i verificar_espacio_disponible no responde por espacios ajenos');
-- Salir del espacio sigue permitido
update public.perfiles set espacio_id = null where id = auth.uid();
select pg_temp.check((select count(*) from public.gastos) = 0, '5j al salir del espacio deja de ver sus gastos');
reset role;

-- ============ 6. Crear espacio por RPC ============
insert into auth.users (id, email) values ('00000000-0000-4000-8000-0000000000a3', 'nuevo@example.com');
select pg_temp.como('00000000-0000-4000-8000-0000000000a3');
select pg_temp.check(public.crear_espacio('Mi Empresa', 'Fundador') is not null, '6a crear_espacio crea el espacio');
select pg_temp.check((select rol from public.perfiles where id = auth.uid()) = 'admin_hogar', '6b el creador queda admin_hogar');
select pg_temp.check((select length(codigo_invitacion) from public.espacios) = 8, '6c código de 8 caracteres generado en el servidor');
do $$ begin
  perform public.crear_espacio('Otro');
  raise exception 'FALLO 6d crear un segundo espacio aceptado';
exception when insufficient_privilege then raise notice 'OK    6d no puede crear otro espacio estando en uno';
end $$;
reset role;

-- ============ 7. Superadmin sigue administrando ============
update public.perfiles set rol = 'superadmin' where id = 'b81f68e9-01ee-4a15-9b7a-bcf39065d54c';  -- como postgres
select pg_temp.como('b81f68e9-01ee-4a15-9b7a-bcf39065d54c');
select pg_temp.check((select count(*) from public.espacios) >= 4, '7a superadmin lista todos los espacios');
insert into public.espacios (nombre_familia, codigo_invitacion, limite_usuarios) values ('Creado por superadmin', 'SUPER1', 2);
update public.perfiles set espacio_id = '00000000-0000-4000-8000-00000000e5e1' where id = auth.uid();
select pg_temp.check(public.mi_espacio_id() = '00000000-0000-4000-8000-00000000e5e1', '7b superadmin puede cambiarse de espacio desde el panel');
reset role;

rollback;
