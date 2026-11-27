-- =============================================================================
-- P0 seguridad: aislamiento entre espacios (QA CaninDevs, 2026-11-26)
--
-- Corrige:
--   1. `espacios` legible por cualquiera (RLS_Espacios_Select_Public qual=true),
--      incluido `codigo_invitacion`.
--   2. Un usuario podía ponerse el `espacio_id` (o el `rol`) que quisiera en su
--      fila de `perfiles` y así leer los datos de otro espacio o volverse
--      superadmin.
--   3. `validar_limite_usuarios()` no era SECURITY DEFINER: contaba 0 miembros
--      y el límite no se aplicaba.
--   4. `cuentas_maestras` tenía una política `using (true)` para authenticated.
--   5. `mis_espacios()` leía `usuarios_espacios`, que ya no existe.
--   6. Linter: funciones SECURITY DEFINER ejecutables por anon y funciones con
--      search_path mutable.
--
-- Modelo: un perfil pertenece a un solo espacio (`perfiles.espacio_id`). La
-- membresía la resuelve `mi_espacio_id()`. Ese valor solo puede cambiarse
-- mediante las RPC `unirse_a_espacio` / `crear_espacio`, o lo cambia un
-- superadmin.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Funciones de membresía: SECURITY DEFINER y search_path fijo
-- -----------------------------------------------------------------------------
create or replace function public.mi_espacio_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.espacio_id from public.perfiles p where p.id = auth.uid() limit 1;
$$;

create or replace function public.es_superadmin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.rol = 'superadmin' from public.perfiles p where p.id = auth.uid()),
    false
  );
$$;

-- Antes leía public.usuarios_espacios (no existe). Ahora usa perfiles.
create or replace function public.mis_espacios()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.espacio_id from public.perfiles p
  where p.id = auth.uid() and p.espacio_id is not null;
$$;

create or replace function public.verificar_espacio_disponible(p_espacio_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limite integer;
  v_actual integer;
begin
  -- Solo responde por el espacio propio (o para el superadmin).
  if p_espacio_id is distinct from public.mi_espacio_id() and not public.es_superadmin() then
    return null;
  end if;
  select e.limite_usuarios into v_limite from public.espacios e where e.id = p_espacio_id;
  select count(*) into v_actual from public.perfiles p where p.espacio_id = p_espacio_id;
  return v_limite is null or v_actual < v_limite;
end;
$$;

-- SECURITY INVOKER (respeta RLS); solo se fija el search_path.
alter function public.generar_cuotas(text, numeric, text, integer, date, numeric, bigint, uuid)
  set search_path = public;

-- -----------------------------------------------------------------------------
-- 2. Límite de miembros: el trigger ahora ve todos los perfiles
-- -----------------------------------------------------------------------------
create or replace function public.validar_limite_usuarios()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limite integer;
  v_actual integer;
begin
  if tg_op = 'UPDATE' and old.espacio_id is not distinct from new.espacio_id then
    return new;
  end if;
  if new.espacio_id is null then
    return new;
  end if;

  -- Bloquea la fila del espacio para que dos altas concurrentes no superen el límite.
  select e.limite_usuarios into v_limite
  from public.espacios e where e.id = new.espacio_id
  for update;

  if v_limite is null then
    return new;
  end if;

  select count(*)::integer into v_actual
  from public.perfiles p
  where p.espacio_id = new.espacio_id and p.id <> new.id;

  if v_actual >= v_limite then
    raise exception 'Límite de usuarios alcanzado para este espacio (%)', v_limite
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. Guarda de perfiles: espacio_id y rol no se cambian por la API directa
-- -----------------------------------------------------------------------------
-- SECURITY INVOKER a propósito: `current_user` es 'authenticated'/'anon' cuando
-- la escritura viene de PostgREST, y es el dueño (postgres) cuando viene de una
-- RPC SECURITY DEFINER (unirse_a_espacio / crear_espacio). service_role y el
-- superadmin pueden.
create or replace function public.proteger_perfil()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user not in ('anon', 'authenticated') or public.es_superadmin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.espacio_id is not null then
      raise exception 'Para unirte a un espacio usá un código de invitación'
        using errcode = '42501';
    end if;
    if coalesce(new.rol, 'miembro') <> 'miembro' then
      raise exception 'No podés asignarte ese rol' using errcode = '42501';
    end if;
  else
    if new.id is distinct from old.id then
      raise exception 'No se puede cambiar el id del perfil' using errcode = '42501';
    end if;
    -- Salir del espacio (NULL) sí se permite; cambiar a otro, no.
    if new.espacio_id is distinct from old.espacio_id and new.espacio_id is not null then
      raise exception 'Para unirte a un espacio usá un código de invitación'
        using errcode = '42501';
    end if;
    if new.rol is distinct from old.rol then
      raise exception 'No podés cambiar tu rol' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists tr_proteger_perfil on public.perfiles;
create trigger tr_proteger_perfil
  before insert or update on public.perfiles
  for each row execute function public.proteger_perfil();

-- -----------------------------------------------------------------------------
-- 4. RPC: unirse a un espacio con código de invitación
-- -----------------------------------------------------------------------------
create or replace function public.unirse_a_espacio(p_codigo text, p_nombre text default null)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  v_esp    public.espacios%rowtype;
  v_perfil public.perfiles%rowtype;
  v_actual integer;
  v_nombre text;
begin
  if v_uid is null then
    raise exception 'Necesitás iniciar sesión' using errcode = '28000';
  end if;
  if p_codigo is null or length(trim(p_codigo)) < 6 then
    raise exception 'Código de invitación inválido' using errcode = '22023';
  end if;

  select * into v_esp from public.espacios e
  where upper(e.codigo_invitacion) = upper(trim(p_codigo))
  for update;
  if not found then
    raise exception 'Código de invitación inválido' using errcode = '22023';
  end if;

  select * into v_perfil from public.perfiles p where p.id = v_uid for update;
  if found and v_perfil.espacio_id = v_esp.id then
    return v_esp.id;                       -- ya es miembro: idempotente
  end if;
  if found and v_perfil.espacio_id is not null then
    raise exception 'Ya pertenecés a otro espacio' using errcode = '42501';
  end if;

  select count(*) into v_actual from public.perfiles p where p.espacio_id = v_esp.id;
  if v_esp.limite_usuarios is not null and v_actual >= v_esp.limite_usuarios then
    raise exception 'Límite de usuarios alcanzado para este espacio (%)', v_esp.limite_usuarios
      using errcode = 'P0001';
  end if;

  v_nombre := coalesce(
    nullif(trim(p_nombre), ''),
    v_perfil.nombre,
    nullif(split_part((select u.email from auth.users u where u.id = v_uid), '@', 1), ''),
    'Miembro'
  );

  insert into public.perfiles (id, espacio_id, nombre, rol)
  values (v_uid, v_esp.id, v_nombre, 'miembro')
  on conflict (id) do update
    set espacio_id = excluded.espacio_id,
        nombre     = excluded.nombre,
        rol        = case when public.perfiles.rol = 'superadmin' then 'superadmin' else 'miembro' end;

  return v_esp.id;
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. RPC: crear un espacio nuevo (el creador queda como admin_hogar)
-- -----------------------------------------------------------------------------
create or replace function public.crear_espacio(p_nombre_espacio text, p_nombre text default null)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid       uuid := auth.uid();
  v_perfil    public.perfiles%rowtype;
  v_espacio   uuid;
  v_codigo    text;
  v_alfabeto  constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_bytes     bytea;
  v_intentos  integer := 0;
  i           integer;
begin
  if v_uid is null then
    raise exception 'Necesitás iniciar sesión' using errcode = '28000';
  end if;
  if p_nombre_espacio is null or length(trim(p_nombre_espacio)) = 0 then
    raise exception 'El nombre del espacio es obligatorio' using errcode = '22023';
  end if;

  select * into v_perfil from public.perfiles p where p.id = v_uid for update;
  if found and v_perfil.espacio_id is not null then
    raise exception 'Ya pertenecés a otro espacio' using errcode = '42501';
  end if;

  -- Código de 8 caracteres (32^8 ≈ 1,1·10^12 combinaciones) generado en el servidor.
  loop
    v_bytes := extensions.gen_random_bytes(8);
    v_codigo := '';
    for i in 0..7 loop
      v_codigo := v_codigo || substr(v_alfabeto, (get_byte(v_bytes, i) % 32) + 1, 1);
    end loop;
    exit when not exists (select 1 from public.espacios e where e.codigo_invitacion = v_codigo);
    v_intentos := v_intentos + 1;
    if v_intentos > 10 then
      raise exception 'No se pudo generar un código único';
    end if;
  end loop;

  insert into public.espacios (nombre_familia, codigo_invitacion)
  values (trim(p_nombre_espacio), v_codigo)
  returning id into v_espacio;

  insert into public.perfiles (id, espacio_id, nombre, rol)
  values (
    v_uid, v_espacio,
    coalesce(nullif(trim(p_nombre), ''), v_perfil.nombre,
             nullif(split_part((select u.email from auth.users u where u.id = v_uid), '@', 1), ''),
             'Admin'),
    'admin_hogar'
  )
  on conflict (id) do update
    set espacio_id = excluded.espacio_id,
        nombre     = excluded.nombre,
        rol        = case when public.perfiles.rol = 'superadmin' then 'superadmin' else 'admin_hogar' end;

  return v_espacio;
end;
$$;

-- -----------------------------------------------------------------------------
-- 6. Permisos de ejecución: nada para anon/public
-- -----------------------------------------------------------------------------
revoke execute on function public.mi_espacio_id()                      from public, anon;
revoke execute on function public.es_superadmin()                      from public, anon;
revoke execute on function public.mis_espacios()                       from public, anon;
revoke execute on function public.verificar_espacio_disponible(uuid)   from public, anon;
revoke execute on function public.unirse_a_espacio(text, text)         from public, anon;
revoke execute on function public.crear_espacio(text, text)            from public, anon;
revoke execute on function public.generar_cuotas(text, numeric, text, integer, date, numeric, bigint, uuid) from public, anon;
revoke execute on function public.validar_limite_usuarios()            from public, anon, authenticated;
revoke execute on function public.proteger_perfil()                    from public, anon, authenticated;

grant execute on function public.mi_espacio_id()                       to authenticated, service_role;
grant execute on function public.es_superadmin()                       to authenticated, service_role;
grant execute on function public.mis_espacios()                        to authenticated, service_role;
grant execute on function public.verificar_espacio_disponible(uuid)    to authenticated, service_role;
grant execute on function public.unirse_a_espacio(text, text)          to authenticated, service_role;
grant execute on function public.crear_espacio(text, text)             to authenticated, service_role;
grant execute on function public.generar_cuotas(text, numeric, text, integer, date, numeric, bigint, uuid) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 7. espacios: solo miembros y superadmin. Alta solo por RPC (o superadmin).
-- -----------------------------------------------------------------------------
drop policy if exists "RLS_Espacios_Select_Public"                       on public.espacios;
drop policy if exists "RLS_Espacios_Insert"                              on public.espacios;
drop policy if exists "Permitir crear espacios a usuarios autenticados"  on public.espacios;
drop policy if exists "Ver mi propio espacio"                            on public.espacios;
drop policy if exists "Superadmin gestiona todo espacios"                on public.espacios;

create policy "Ver mi propio espacio" on public.espacios
  for select to authenticated
  using (id = (select public.mi_espacio_id()));

create policy "Superadmin gestiona todo espacios" on public.espacios
  for all to authenticated
  using ((select public.es_superadmin()))
  with check ((select public.es_superadmin()));

-- -----------------------------------------------------------------------------
-- 8. perfiles: el usuario ve los de su espacio y edita el suyo (la guarda del
--    punto 3 impide tocar espacio_id/rol). Sin políticas duplicadas.
-- -----------------------------------------------------------------------------
drop policy if exists "RLS_Perfiles_Propio"               on public.perfiles;
drop policy if exists "RLS_Perfiles_Hogar"                on public.perfiles;
drop policy if exists "Ver o proprio perfil"              on public.perfiles;
drop policy if exists "Ver perfiles de mi espacio"        on public.perfiles;
drop policy if exists "Insertar perfil propio"            on public.perfiles;
drop policy if exists "Actualizar perfil propio"          on public.perfiles;
drop policy if exists "Borrar perfil propio"              on public.perfiles;
drop policy if exists "Superadmin gestiona todo perfiles" on public.perfiles;

create policy "Ver perfiles de mi espacio" on public.perfiles
  for select to authenticated
  using (id = (select auth.uid()) or espacio_id = (select public.mi_espacio_id()));

create policy "Insertar perfil propio" on public.perfiles
  for insert to authenticated
  with check (id = (select auth.uid()));

create policy "Actualizar perfil propio" on public.perfiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "Borrar perfil propio" on public.perfiles
  for delete to authenticated
  using (id = (select auth.uid()));

create policy "Superadmin gestiona todo perfiles" on public.perfiles
  for all to authenticated
  using ((select public.es_superadmin()))
  with check ((select public.es_superadmin()));

-- -----------------------------------------------------------------------------
-- 9. Tablas de datos: todas filtran por mi_espacio_id(), solo authenticated
-- -----------------------------------------------------------------------------
-- cuentas_maestras: quitar la política abierta y las basadas en mis_espacios().
drop policy if exists "Permitir todo a usuarios autenticados en cuentas_maestras" on public.cuentas_maestras;
drop policy if exists "Cuentas Maestras: Acceso a mi espacio" on public.cuentas_maestras;
create policy "Cuentas Maestras: Acceso a mi espacio" on public.cuentas_maestras
  for all to authenticated
  using (espacio_id = (select public.mi_espacio_id()))
  with check (espacio_id = (select public.mi_espacio_id()));

drop policy if exists "Aislamiento por espacio"      on public.cuentas_pendientes;
drop policy if exists "Cuentas: Acceso a mi espacio" on public.cuentas_pendientes;
create policy "Cuentas: Acceso a mi espacio" on public.cuentas_pendientes
  for all to authenticated
  using (espacio_id = (select public.mi_espacio_id()))
  with check (espacio_id = (select public.mi_espacio_id()));

drop policy if exists "Prestamos: Acceso a mi espacio" on public.prestamos_personales;
create policy "Prestamos: Acceso a mi espacio" on public.prestamos_personales
  for all to authenticated
  using (espacio_id = (select public.mi_espacio_id()))
  with check (espacio_id = (select public.mi_espacio_id()));

-- Las demás ya filtraban por mi_espacio_id(); se recrean para authenticated
-- (anon ya no puede ejecutar las funciones) y con WITH CHECK explícito.
do $$
declare
  r record;
begin
  for r in
    select * from (values
      ('gastos',               'Gestionar gastos'),
      ('ingresos_mensuales',   'Gestionar ingresos'),
      ('notificaciones',       'Gestionar mis notificaciones'),
      ('deudas_maestras',      'Gestionar deudas'),
      ('cuotas_detalle',       'Gestionar cuotas'),
      ('ingresos_programados', 'Gestionar mis ingresos programados'),
      ('historial_salarios',   'Ver mi historial de salarios')
    ) as t(tabla, politica)
  loop
    execute format('drop policy if exists %I on public.%I', r.politica, r.tabla);
    execute format(
      'create policy %I on public.%I for all to authenticated '
      'using (espacio_id = (select public.mi_espacio_id())) '
      'with check (espacio_id = (select public.mi_espacio_id()))',
      r.politica, r.tabla);
  end loop;
end $$;

-- gastos_programados ya era `to authenticated` con mi_espacio_id(); sin cambios.

commit;
