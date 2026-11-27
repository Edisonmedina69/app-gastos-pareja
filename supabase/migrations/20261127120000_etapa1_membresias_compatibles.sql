-- Etapa 1: membresías compatibles. No habilita organizaciones ni segundos espacios.
-- Aplicar únicamente después de contrastar el baseline vivo; NO ejecutar el historial.
-- Una única transacción cierra la ventana entre backfill y escrituras concurrentes.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';
lock table public.espacios, public.perfiles in share row exclusive mode;

alter table public.espacios add column tipo text not null default 'hogar'
  constraint espacios_tipo_check check (tipo in ('hogar', 'organizacion'));

create table public.espacio_miembros (
  id uuid primary key default gen_random_uuid(),
  espacio_id uuid not null references public.espacios(id) on delete cascade,
  usuario_id uuid not null references public.perfiles(id) on delete cascade,
  rol_plantilla text not null default 'miembro'
    check (rol_plantilla in ('admin', 'miembro', 'contador', 'lectura')),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  constraint espacio_miembros_espacio_usuario_key unique (espacio_id, usuario_id),
  constraint espacio_miembros_espacio_id_id_key unique (espacio_id, id)
);
-- Guarda temporal de etapa 1: retirar SOLO cuando selector/helpers/RLS estén listos.
create unique index espacio_miembros_un_activo_por_usuario
  on public.espacio_miembros(usuario_id) where activo;
create index espacio_miembros_usuario_activo_idx on public.espacio_miembros(usuario_id, activo);
create index espacio_miembros_espacio_activo_idx on public.espacio_miembros(espacio_id) where activo;

-- No asciende superadmins a administradores de hogares ajenos.
-- ON CONFLICT hace idempotente este backfill sin cambiar roles o fechas existentes.
insert into public.espacio_miembros (espacio_id, usuario_id, rol_plantilla)
select espacio_id, id, case when rol = 'admin_hogar' then 'admin' else 'miembro' end
from public.perfiles where espacio_id is not null
on conflict (espacio_id, usuario_id) do nothing;

alter table public.espacio_miembros enable row level security;
revoke all on public.espacio_miembros from public, anon, authenticated;
grant select on public.espacio_miembros to authenticated;
grant all on public.espacio_miembros to service_role;
-- Solo información propia; no revela otras pertenencias de compañeros.
create policy "Leer membresías propias" on public.espacio_miembros
  for select to authenticated using (usuario_id = (select auth.uid()));

create or replace function public.sincronizar_membresia_perfil()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and old.espacio_id is distinct from new.espacio_id then
    update public.espacio_miembros set activo = false
      where usuario_id = new.id and espacio_id = old.espacio_id and activo;
  end if;
  if new.espacio_id is not null then
    insert into public.espacio_miembros (espacio_id, usuario_id, rol_plantilla, activo)
    values (new.espacio_id, new.id,
      case when new.rol = 'admin_hogar' then 'admin' else 'miembro' end, true)
    on conflict (espacio_id, usuario_id) do update
      set activo = true, rol_plantilla = excluded.rol_plantilla;
  end if;
  return new;
end;
$$;

-- Defensa también para escrituras privilegiadas a membresías: no habilitar un
-- segundo contexto ni unirse a organizaciones por el circuito familiar.
create or replace function public.validar_membresia_compatible()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_limite integer;
  v_tipo text;
begin
  if not new.activo then return new; end if;
  select limite_usuarios, tipo into v_limite, v_tipo
    from public.espacios where id = new.espacio_id for update;
  if v_tipo <> 'hogar' or not exists (
    select 1 from public.perfiles where id = new.usuario_id and espacio_id = new.espacio_id
  ) then
    raise exception 'La membresía debe coincidir con el hogar del perfil en etapa 1'
      using errcode = '23514';
  end if;
  -- Un backfill repetido no debe rechazar miembros históricos si el límite
  -- fue reducido después del alta: el INSERT no agrega una membresía activa.
  if tg_op = 'INSERT' and exists (
    select 1 from public.espacio_miembros
    where espacio_id = new.espacio_id and usuario_id = new.usuario_id and activo
  ) then return new; end if;
  if tg_op = 'UPDATE' and old.activo and old.espacio_id = new.espacio_id
      and old.usuario_id = new.usuario_id then
    return new;
  end if;
  if v_limite is not null and (
    select count(*) from public.espacio_miembros
    where espacio_id = new.espacio_id and activo and usuario_id <> new.usuario_id
  ) >= v_limite then
    raise exception 'Límite de usuarios alcanzado para este espacio (%)', v_limite
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger tr_sincronizar_membresia_perfil
  after insert or update of espacio_id, rol on public.perfiles
  for each row execute function public.sincronizar_membresia_perfil();
create trigger tr_validar_membresia_compatible
  before insert or update on public.espacio_miembros
  for each row execute function public.validar_membresia_compatible();

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
  select count(*) into v_actual from public.espacio_miembros p where p.espacio_id = p_espacio_id and p.activo;
  return v_limite is null or v_actual < v_limite;
end;
$$;

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

  if exists (select 1 from public.espacios where id = new.espacio_id and tipo <> 'hogar') then
    raise exception 'El circuito familiar solo admite hogares' using errcode = '42501';
  end if;

  -- Bloquea la fila del espacio para que dos altas concurrentes no superen el límite.
  select e.limite_usuarios into v_limite
  from public.espacios e where e.id = new.espacio_id
  for update;

  if v_limite is null then
    return new;
  end if;

  select count(*)::integer into v_actual
  from public.espacio_miembros p
  where p.espacio_id = new.espacio_id and p.usuario_id <> new.id and p.activo;

  if v_actual >= v_limite then
    raise exception 'Límite de usuarios alcanzado para este espacio (%)', v_limite
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

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
  -- Auth siempre existe, incluso antes del primer perfil. Orden: usuario → espacio → perfil.
  perform 1 from auth.users where id = v_uid for update;
  if p_codigo is null or length(trim(p_codigo)) < 6 then
    raise exception 'Código de invitación inválido' using errcode = '22023';
  end if;

  select * into v_esp from public.espacios e
  where upper(e.codigo_invitacion) = upper(trim(p_codigo))
  for update;
  if not found then
    raise exception 'Código de invitación inválido' using errcode = '22023';
  end if;

  if v_esp.tipo <> 'hogar' then
    raise exception 'El código familiar solo admite hogares' using errcode = '42501';
  end if;

  select * into v_perfil from public.perfiles p where p.id = v_uid for update;
  if found and v_perfil.espacio_id = v_esp.id then
    return v_esp.id;                       -- ya es miembro: idempotente
  end if;
  if found and v_perfil.espacio_id is not null then
    raise exception 'Ya pertenecés a otro espacio' using errcode = '42501';
  end if;

  select count(*) into v_actual from public.espacio_miembros p where p.espacio_id = v_esp.id and p.activo;
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
  -- Auth siempre existe, incluso antes del primer perfil. Orden: usuario → espacio → perfil.
  perform 1 from auth.users where id = v_uid for update;
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

revoke execute on function public.sincronizar_membresia_perfil(),
  public.validar_membresia_compatible() from public, anon, authenticated;
grant execute on function public.sincronizar_membresia_perfil(),
  public.validar_membresia_compatible() to service_role;
-- CREATE OR REPLACE conserva los grants de las funciones P0.
-- mi_espacio_id(), mis_espacios(), proteger_perfil() y RLS familiar quedan intactos.
-- Abortar toda la transición si un perfil quedó sin su membresía o viceversa.
do $$ begin
  if exists (
    select 1 from public.perfiles p full join public.espacio_miembros m
      on m.usuario_id = p.id and m.espacio_id = p.espacio_id and m.activo
    where (p.espacio_id is not null and m.id is null)
       or (m.activo and p.id is null)
  ) then raise exception 'Backfill divergente: abortar etapa 1'; end if;
end $$;
commit;
