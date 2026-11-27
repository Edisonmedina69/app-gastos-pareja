-- Etapa 2 aprobada: ejecutar solo esta migración, nunca el historial.
-- Requiere etapa 1. Desplegar cliente compatible antes de habilitar el piloto.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';
lock table public.espacios, public.perfiles, public.espacio_miembros in share row exclusive mode;

create table public.sesiones_espacio (
  session_id uuid not null references auth.sessions(id) on delete cascade,
  usuario_id uuid not null references auth.users(id) on delete cascade,
  espacio_id uuid references public.espacios(id),
  updated_at timestamptz not null default now(),
  primary key (session_id, usuario_id)
);
create index sesiones_espacio_espacio_idx on public.sesiones_espacio(espacio_id);
create table public.miembro_permisos (
  id uuid primary key default gen_random_uuid(),
  espacio_id uuid not null references public.espacios(id),
  miembro_id uuid not null,
  recurso text not null check (recurso in ('finanzas','gastos','ingresos','cuentas','socios','catalogos','recurrencias','integrantes')),
  accion text not null check (accion in ('ver','crear','editar','anular','pagar','cobrar','configurar','invitar')),
  permitido boolean not null default false,
  actualizado_por uuid references public.perfiles(id),
  created_at timestamptz not null default now(),
  foreign key (espacio_id, miembro_id) references public.espacio_miembros(espacio_id,id),
  unique (espacio_id, miembro_id, recurso, accion)
);
create table public.org_invitaciones (
  id uuid primary key default gen_random_uuid(),
  espacio_id uuid not null references public.espacios(id),
  token_hash text not null unique,
  rol text not null check (rol in ('admin','miembro','contador','lectura')),
  vence_at timestamptz not null default (now() + interval '7 days'),
  max_usos integer not null default 1 check (max_usos between 1 and 10),
  usos integer not null default 0 check (usos >= 0 and usos <= max_usos),
  revocada_at timestamptz,
  creada_por uuid not null references public.perfiles(id),
  created_at timestamptz not null default now()
);
create index org_invitaciones_espacio_idx on public.org_invitaciones(espacio_id);
create table public.org_auditoria (
  id uuid primary key default gen_random_uuid(),
  espacio_id uuid not null references public.espacios(id),
  actor_id uuid references public.perfiles(id),
  entidad text not null,
  entidad_id uuid not null,
  accion text not null,
  cambios jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index org_auditoria_espacio_idx on public.org_auditoria(espacio_id,created_at);
-- Piloto explícito, vacío al aplicar; ninguna familia se convierte automáticamente.
create table public.org_piloto_usuarios (
  usuario_id uuid primary key references auth.users(id) on delete cascade
);
-- Contador persistente: retornar error como dato para no revertir el rate limit.
create table public.org_intentos_invitacion (
  usuario_id uuid primary key references auth.users(id) on delete cascade,
  ventana timestamptz not null default now(),
  intentos integer not null default 0
);
alter table public.espacios add constraint espacios_org_base_check
  check (tipo <> 'organizacion' or (moneda_principal = 'PYG' and limite_usuarios between 1 and 10));

drop index public.espacio_miembros_un_activo_por_usuario;

create or replace function public.sesion_auth_id()
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare v_text text := auth.jwt()->>'session_id'; v_sid uuid;
begin
  if v_text is null or v_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return null; end if;
  v_sid := v_text::uuid;
  if exists (select 1 from auth.sessions where id = v_sid and user_id = auth.uid()) then return v_sid; end if;
  return null;
end $$;

create or replace function public.mi_espacio_id()
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare v_sid uuid := public.sesion_auth_id(); v_eid uuid;
begin
  if v_sid is null then return null; end if;
  select espacio_id into v_eid from public.sesiones_espacio where session_id = v_sid and usuario_id = auth.uid();
  if found then
    return (select espacio_id from public.espacio_miembros where usuario_id = auth.uid() and espacio_id = v_eid and activo);
  end if;
  -- Compatibilidad de clientes familiares con una sola membresía. Nunca perfiles.
  select min(espacio_id::text)::uuid into v_eid from public.espacio_miembros
    where usuario_id = auth.uid() and activo having count(*) = 1;
  return v_eid;
end $$;

create or replace function public.mis_espacios()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select espacio_id from public.espacio_miembros
  where usuario_id = auth.uid() and activo and public.sesion_auth_id() is not null;
$$;

create or replace function public.listar_mis_espacios()
returns table(id uuid, nombre text, tipo text) language sql stable security definer set search_path = '' as $$
  select e.id, e.nombre_familia, e.tipo from public.espacios e
  join public.espacio_miembros m on m.espacio_id = e.id
  where m.usuario_id = auth.uid() and m.activo and public.sesion_auth_id() is not null
  order by e.created_at, e.id;
$$;

create or replace function public.seleccionar_espacio(p_espacio_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_sid uuid := public.sesion_auth_id();
begin
  if v_sid is null then raise exception 'Sesión inválida o cerrada' using errcode = '28000'; end if;
  -- Lock compartido con todas las mutaciones; revalidar tras tomarlo.
  insert into public.sesiones_espacio(session_id, usuario_id) values(v_sid, auth.uid()) on conflict do nothing;
  perform 1 from public.sesiones_espacio where session_id = v_sid and usuario_id = auth.uid() for update;
  if not exists (select 1 from public.espacio_miembros where espacio_id = p_espacio_id and usuario_id = auth.uid() and activo) then
    raise exception 'No pertenecés a ese espacio' using errcode = '42501';
  end if;
  update public.sesiones_espacio set espacio_id = p_espacio_id, updated_at = clock_timestamp()
    where session_id = v_sid and usuario_id = auth.uid();
  return p_espacio_id;
end $$;

create or replace function public.validar_contexto(p_espacio_id_esperado uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_sid uuid := public.sesion_auth_id();
begin
  if v_sid is null then raise exception 'Sesión inválida o cerrada' using errcode = '28000'; end if;
  insert into public.sesiones_espacio(session_id, usuario_id, espacio_id)
    values(v_sid, auth.uid(), public.mi_espacio_id()) on conflict do nothing;
  perform 1 from public.sesiones_espacio where session_id = v_sid and usuario_id = auth.uid() for update;
  if p_espacio_id_esperado is null or p_espacio_id_esperado is distinct from public.mi_espacio_id() then
    raise exception 'El espacio cambió; volvé a seleccionarlo' using errcode = '42501';
  end if;
end $$;

create or replace function public.es_admin_espacio(p_espacio_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(p_espacio_id = public.mi_espacio_id() and exists (
    select 1 from public.espacio_miembros where espacio_id = p_espacio_id and usuario_id = auth.uid() and activo and rol_plantilla = 'admin'
  ), false);
$$;

create or replace function public.tiene_permiso(p_espacio_id uuid, p_recurso text, p_accion text)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(p_espacio_id = public.mi_espacio_id() and exists (
    select 1 from public.miembro_permisos p join public.espacio_miembros m on m.id = p.miembro_id and m.espacio_id = p.espacio_id
    join public.espacios e on e.id = m.espacio_id
    where m.usuario_id = auth.uid() and m.activo and e.tipo = 'organizacion'
      and p.espacio_id = p_espacio_id and p.recurso = p_recurso and p.accion = p_accion and p.permitido
  ), false);
$$;

-- Copiar filas efectivas, nunca inferir autorización financiera desde el nombre del rol.
create or replace function public.aplicar_plantilla_miembro(p_miembro_id uuid, p_rol text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_rol not in ('admin','miembro','contador','lectura') or p_rol is null then raise exception 'Plantilla inválida' using errcode = '22023'; end if;
  insert into public.miembro_permisos(espacio_id, miembro_id, recurso, accion, permitido, actualizado_por)
  select m.espacio_id, m.id, r, a,
    case when p_rol = 'admin' then true
      when a = 'ver' and r <> 'integrantes' then true
      when p_rol in ('miembro','contador') and r in ('gastos','ingresos') and a in ('crear','editar') then true
      when p_rol in ('miembro','contador') and ((r = 'gastos' and a = 'pagar') or (r = 'ingresos' and a = 'cobrar')) then true
      when p_rol = 'contador' and ((r in ('gastos','ingresos') and a = 'anular') or (r in ('catalogos','cuentas','recurrencias') and a in ('crear','editar','configurar'))) then true
      else false end, auth.uid()
  from public.espacio_miembros m
  cross join unnest(array['finanzas','gastos','ingresos','cuentas','socios','catalogos','recurrencias','integrantes']) r
  cross join unnest(array['ver','crear','editar','anular','pagar','cobrar','configurar','invitar']) a
  where m.id = p_miembro_id
  on conflict (espacio_id,miembro_id,recurso,accion) do update set permitido = excluded.permitido, actualizado_por = excluded.actualizado_por;
end $$;

create or replace function public.validar_membresia_compatible()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_limite integer; v_tipo text; v_eid uuid;
begin
  v_eid := case when tg_op = 'DELETE' then old.espacio_id else new.espacio_id end;
  select limite_usuarios, tipo into v_limite,v_tipo from public.espacios where id = v_eid for update;
  if tg_op = 'UPDATE' and (new.espacio_id <> old.espacio_id or new.usuario_id <> old.usuario_id) then
    raise exception 'La identidad de una membresía es inmutable' using errcode = '23514';
  end if;
  if v_tipo = 'organizacion' and tg_op in ('UPDATE','DELETE') and old.activo and old.rol_plantilla = 'admin' then
    if (tg_op = 'DELETE' or not new.activo or new.rol_plantilla <> 'admin') and not exists (
      select 1 from public.espacio_miembros where espacio_id = v_eid and activo and rol_plantilla = 'admin' and id <> old.id
    ) then raise exception 'No se puede quitar al último admin' using errcode = '23514'; end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  if not new.activo then return new; end if;
  if tg_op = 'UPDATE' and old.activo then return new; end if;
  if exists (select 1 from public.espacio_miembros where espacio_id = v_eid and usuario_id = new.usuario_id and activo) then return new; end if;
  if (select count(*) from public.espacio_miembros where espacio_id = v_eid and activo) >= v_limite then
    raise exception 'Límite de usuarios alcanzado para este espacio (%)', v_limite using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger tr_validar_membresia_compatible on public.espacio_miembros;
create trigger tr_validar_membresia_compatible before insert or update or delete on public.espacio_miembros
  for each row execute function public.validar_membresia_compatible();

create or replace function public.sincronizar_membresia_perfil()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- Compatibilidad administrativa SOLO para el hogar legado; nunca toca organizaciones.
  if tg_op = 'UPDATE' and old.espacio_id is distinct from new.espacio_id then
    update public.espacio_miembros set activo = false where usuario_id = new.id and espacio_id = old.espacio_id and activo;
  end if;
  if new.espacio_id is not null then
    insert into public.espacio_miembros(espacio_id,usuario_id,rol_plantilla)
    values(new.espacio_id,new.id,case when new.rol = 'admin_hogar' then 'admin' else 'miembro' end)
    on conflict(espacio_id,usuario_id) do update set activo = true, rol_plantilla = excluded.rol_plantilla;
  end if;
  return new;
end $$;

create or replace function public.crear_organizacion(p_nombre text, p_version integer)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_eid uuid; v_mid uuid;
begin
  if public.sesion_auth_id() is null then raise exception 'Sesión inválida o cerrada' using errcode = '28000'; end if;
  if p_version is distinct from 2 then raise exception 'Recargá la app para usar varios espacios' using errcode = '22023'; end if;
  perform 1 from auth.users where id = v_uid for update;
  if not exists (select 1 from public.org_piloto_usuarios where usuario_id = v_uid) then
    raise exception 'La creación de organizaciones está en piloto cerrado' using errcode = '42501';
  end if;
  if nullif(trim(p_nombre),'') is null or length(trim(p_nombre)) > 100 then raise exception 'Ingresá un nombre de hasta 100 caracteres' using errcode = '22023'; end if;
  insert into public.perfiles(id,nombre) values(v_uid,'Integrante') on conflict do nothing;
  insert into public.espacios(nombre_familia,tipo,moneda_principal,limite_usuarios)
    values(trim(p_nombre),'organizacion','PYG',10) returning id into v_eid;
  insert into public.espacio_miembros(espacio_id,usuario_id,rol_plantilla) values(v_eid,v_uid,'admin') returning id into v_mid;
  perform public.aplicar_plantilla_miembro(v_mid,'admin');
  insert into public.org_auditoria(espacio_id,actor_id,entidad,entidad_id,accion) values(v_eid,v_uid,'espacios',v_eid,'crear');
  return v_eid;
end $$;

create or replace function public.crear_invitacion_org(p_espacio_id_esperado uuid, p_rol text default 'lectura', p_max_usos integer default 1)
returns table(id uuid, token text, vence_at timestamptz) language plpgsql security definer set search_path = '' as $$
declare v_token text; v_id uuid; v_vence timestamptz;
begin
  perform public.validar_contexto(p_espacio_id_esperado);
  if not public.tiene_permiso(p_espacio_id_esperado,'integrantes','invitar') then raise exception 'No tenés permiso para invitar' using errcode = '42501'; end if;
  if not public.es_admin_espacio(p_espacio_id_esperado) and p_rol is distinct from 'lectura' then
    raise exception 'Una invitación delegada solo puede conceder lectura' using errcode = '42501';
  end if;
  v_token := encode(extensions.gen_random_bytes(24),'hex');
  insert into public.org_invitaciones(espacio_id,token_hash,rol,max_usos,creada_por)
    values(p_espacio_id_esperado,encode(extensions.digest(v_token,'sha256'),'hex'),p_rol,p_max_usos,auth.uid())
    returning org_invitaciones.id,org_invitaciones.vence_at into v_id,v_vence;
  insert into public.org_auditoria(espacio_id,actor_id,entidad,entidad_id,accion,cambios)
    values(p_espacio_id_esperado,auth.uid(),'invitaciones',v_id,'crear',jsonb_build_object('rol',p_rol,'max_usos',p_max_usos));
  return query select v_id,v_token,v_vence;
end $$;

create or replace function public.aceptar_invitacion_org(p_token text, p_version integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_i public.org_invitaciones%rowtype; v_mid uuid; v_intentos integer; v_eid uuid;
begin
  if public.sesion_auth_id() is null then raise exception 'Sesión inválida o cerrada' using errcode = '28000'; end if;
  if p_version is distinct from 2 then raise exception 'Recargá la app para usar varios espacios' using errcode = '22023'; end if;
  perform 1 from auth.users where id = auth.uid() for update;
  insert into public.org_intentos_invitacion(usuario_id,intentos) values(auth.uid(),1)
  on conflict(usuario_id) do update set
    intentos = case when org_intentos_invitacion.ventana < now() - interval '15 minutes' then 1 else org_intentos_invitacion.intentos + 1 end,
    ventana = case when org_intentos_invitacion.ventana < now() - interval '15 minutes' then now() else org_intentos_invitacion.ventana end
  returning intentos into v_intentos;
  if v_intentos > 20 then return jsonb_build_object('error','Demasiados intentos; reintentá en 15 minutos'); end if;
  -- Orden único: usuario → espacio → invitación → membresía. Nunca invertirlo.
  select espacio_id into v_eid from public.org_invitaciones where token_hash = encode(extensions.digest(trim(p_token),'sha256'),'hex');
  perform 1 from public.espacios where id = v_eid and tipo = 'organizacion' for update;
  select * into v_i from public.org_invitaciones where espacio_id = v_eid and token_hash = encode(extensions.digest(trim(p_token),'sha256'),'hex') for update;
  if not found or v_i.revocada_at is not null or v_i.vence_at <= now() then return jsonb_build_object('error','Invitación inválida, vencida o revocada'); end if;
  select id into v_mid from public.espacio_miembros where espacio_id = v_i.espacio_id and usuario_id = auth.uid() and activo;
  if found then return jsonb_build_object('espacio_id',v_i.espacio_id); end if;
  if v_i.usos >= v_i.max_usos then return jsonb_build_object('error','La invitación agotó sus usos'); end if;
  if (select count(*) from public.espacio_miembros where espacio_id = v_i.espacio_id and activo) >=
    (select limite_usuarios from public.espacios where id = v_i.espacio_id) then return jsonb_build_object('error','Límite de usuarios alcanzado'); end if;
  insert into public.perfiles(id,nombre) values(auth.uid(),'Integrante') on conflict do nothing;
  insert into public.espacio_miembros(espacio_id,usuario_id,rol_plantilla) values(v_i.espacio_id,auth.uid(),v_i.rol)
    on conflict(espacio_id,usuario_id) do update set activo = true, rol_plantilla = excluded.rol_plantilla returning id into v_mid;
  perform public.aplicar_plantilla_miembro(v_mid,v_i.rol);
  update public.org_invitaciones set usos = usos + 1 where org_invitaciones.id = v_i.id;
  insert into public.org_auditoria(espacio_id,actor_id,entidad,entidad_id,accion) values(v_i.espacio_id,auth.uid(),'miembros',v_mid,'unirse');
  return jsonb_build_object('espacio_id',v_i.espacio_id);
end $$;

create or replace function public.revocar_invitacion_org(p_espacio_id_esperado uuid, p_invitacion_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.validar_contexto(p_espacio_id_esperado);
  perform 1 from public.espacios where id = p_espacio_id_esperado for update;
  if not public.es_admin_espacio(p_espacio_id_esperado) then raise exception 'Solo admin puede revocar invitaciones' using errcode = '42501'; end if;
  update public.org_invitaciones set revocada_at = now() where id = p_invitacion_id and espacio_id = p_espacio_id_esperado;
  if not found then raise exception 'Invitación inexistente' using errcode = '22023'; end if;
  insert into public.org_auditoria(espacio_id,actor_id,entidad,entidad_id,accion) values(p_espacio_id_esperado,auth.uid(),'invitaciones',p_invitacion_id,'revocar');
end $$;

create or replace function public.actualizar_permisos_miembro(p_espacio_id_esperado uuid, p_miembro_id uuid, p_permisos jsonb default '[]', p_plantilla text default null, p_activo boolean default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_m public.espacio_miembros%rowtype; v_item jsonb;
begin
  perform public.validar_contexto(p_espacio_id_esperado);
  perform 1 from public.espacios where id = p_espacio_id_esperado and tipo = 'organizacion' for update;
  if not found or not public.es_admin_espacio(p_espacio_id_esperado) then raise exception 'Solo admin puede gestionar integrantes' using errcode = '42501'; end if;
  select * into v_m from public.espacio_miembros where id = p_miembro_id and espacio_id = p_espacio_id_esperado for update;
  if not found then raise exception 'Integrante inexistente' using errcode = '22023'; end if;
  if p_plantilla is not null then
    perform public.aplicar_plantilla_miembro(p_miembro_id,p_plantilla);
  end if;
  update public.espacio_miembros set rol_plantilla = coalesce(p_plantilla,rol_plantilla), activo = coalesce(p_activo,activo) where id = p_miembro_id;
  if jsonb_typeof(p_permisos) <> 'array' or jsonb_array_length(p_permisos) > 64 then raise exception 'Permisos inválidos' using errcode = '22023'; end if;
  for v_item in select value from jsonb_array_elements(p_permisos) loop
    if jsonb_typeof(v_item->'permitido') <> 'boolean' or not (v_item ? 'permitido') then raise exception 'Permiso inválido' using errcode = '22023'; end if;
    insert into public.miembro_permisos(espacio_id,miembro_id,recurso,accion,permitido,actualizado_por)
      values(p_espacio_id_esperado,p_miembro_id,v_item->>'recurso',v_item->>'accion',(v_item->>'permitido')::boolean,auth.uid())
      on conflict(espacio_id,miembro_id,recurso,accion) do update set permitido = excluded.permitido, actualizado_por = auth.uid();
  end loop;
  -- Contextos conservan el ID revocado y mi_espacio_id lo deniega; no hay fallback.
  insert into public.org_auditoria(espacio_id,actor_id,entidad,entidad_id,accion,cambios)
    values(p_espacio_id_esperado,auth.uid(),'miembros',p_miembro_id,'actualizar',jsonb_build_object('plantilla',p_plantilla,'activo',p_activo,'permisos',p_permisos));
end $$;

create or replace function public.listar_integrantes_org(p_espacio_id uuid)
returns table(id uuid, usuario_id uuid, nombre text, rol_plantilla text, activo boolean)
language sql stable security definer set search_path = '' as $$
  select m.id,m.usuario_id,p.nombre,m.rol_plantilla,m.activo from public.espacio_miembros m join public.perfiles p on p.id = m.usuario_id
  where m.espacio_id = p_espacio_id and p_espacio_id = public.mi_espacio_id()
    and (public.tiene_permiso(p_espacio_id,'finanzas','ver') or public.es_admin_espacio(p_espacio_id))
    and (m.activo or public.es_admin_espacio(p_espacio_id)) order by m.created_at,m.id;
$$;

-- RPC familiares: firmas compatibles, membresías explícitas; el legado no decide contexto.
create or replace function public.validar_cliente_multi()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if public.sesion_auth_id() is null then raise exception 'Sesión inválida o cerrada' using errcode = '28000'; end if;
  if exists(select 1 from public.espacio_miembros where usuario_id = auth.uid() and activo)
    and coalesce(nullif(current_setting('request.headers',true),'')::jsonb->>'x-app-version','') <> '2' then
    raise exception 'Recargá la app para usar varios espacios' using errcode = '42501';
  end if;
end $$;

create or replace function public.crear_espacio(p_nombre_espacio text, p_nombre text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_eid uuid; v_codigo text := ''; v_bytes bytea; i integer;
begin
  if auth.uid() is null then raise exception 'Necesitás iniciar sesión' using errcode = '28000'; end if;
  perform 1 from auth.users where id = auth.uid() for update;
  perform public.validar_cliente_multi();
  if nullif(trim(p_nombre_espacio),'') is null then raise exception 'El nombre del espacio es obligatorio' using errcode = '22023'; end if;
  v_bytes := extensions.gen_random_bytes(8);
  for i in 0..7 loop
    v_codigo := v_codigo || substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', (get_byte(v_bytes,i) % 32) + 1, 1);
  end loop;
  insert into public.espacios(nombre_familia,codigo_invitacion) values(trim(p_nombre_espacio),v_codigo) returning id into v_eid;
  insert into public.perfiles(id,nombre,espacio_id,rol) values(auth.uid(),coalesce(nullif(trim(p_nombre),''),'Admin'),v_eid,'admin_hogar')
    on conflict(id) do nothing;
  insert into public.espacio_miembros(espacio_id,usuario_id,rol_plantilla) values(v_eid,auth.uid(),'admin')
    on conflict(espacio_id,usuario_id) do update set activo = true, rol_plantilla = 'admin';
  -- Solo completa legado vacío; no modifica hogar o rol anterior.
  update public.perfiles set espacio_id = v_eid, rol = case when rol = 'superadmin' then rol else 'admin_hogar' end
    where id = auth.uid() and espacio_id is null;
  return v_eid;
end $$;

create or replace function public.unirse_a_espacio(p_codigo text, p_nombre text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_e public.espacios%rowtype;
begin
  if auth.uid() is null then raise exception 'Necesitás iniciar sesión' using errcode = '28000'; end if;
  perform 1 from auth.users where id = auth.uid() for update;
  if p_codigo is null or length(trim(p_codigo)) < 6 then raise exception 'Código de invitación inválido' using errcode = '22023'; end if;
  select * into v_e from public.espacios where upper(codigo_invitacion) = upper(trim(p_codigo)) for update;
  if not found then raise exception 'Código de invitación inválido' using errcode = '22023'; end if;
  if v_e.tipo <> 'hogar' then raise exception 'El código familiar solo admite hogares' using errcode = '42501'; end if;
  if exists(select 1 from public.espacio_miembros where espacio_id = v_e.id and usuario_id = auth.uid() and activo) then return v_e.id; end if;
  perform public.validar_cliente_multi();
  if (select count(*) from public.espacio_miembros where espacio_id = v_e.id and activo) >= v_e.limite_usuarios then
    raise exception 'Límite de usuarios alcanzado para este espacio (%)',v_e.limite_usuarios using errcode = 'P0001';
  end if;
  insert into public.perfiles(id,nombre,espacio_id) values(auth.uid(),coalesce(nullif(trim(p_nombre),''),'Miembro'),v_e.id) on conflict do nothing;
  insert into public.espacio_miembros(espacio_id,usuario_id) values(v_e.id,auth.uid())
    on conflict(espacio_id,usuario_id) do update set activo = true;
  update public.perfiles set espacio_id = v_e.id where id = auth.uid() and espacio_id is null;
  return v_e.id;
end $$;

create or replace function public.salir_de_espacio(p_espacio_id_esperado uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.validar_contexto(p_espacio_id_esperado);
  perform 1 from public.espacios where id = p_espacio_id_esperado for update;
  update public.espacio_miembros set activo = false where espacio_id = p_espacio_id_esperado and usuario_id = auth.uid() and activo;
  update public.perfiles set espacio_id = null where id = auth.uid() and espacio_id = p_espacio_id_esperado;
end $$;

-- No usar perfiles para leer compañeros de otras membresías.
create or replace function public.es_companero_activo(p_usuario_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.espacio_miembros m join public.espacios e on e.id = m.espacio_id
   where m.usuario_id = p_usuario_id and m.activo and m.espacio_id = public.mi_espacio_id()
     and (e.tipo = 'hogar' or public.tiene_permiso(e.id,'finanzas','ver') or public.es_admin_espacio(e.id)));
$$;
alter policy "Ver perfiles de mi espacio" on public.perfiles using (id = auth.uid() or public.es_companero_activo(id));
-- No borrado de identidad si conserva historial/membresías empresariales.
create or replace function public.proteger_baja_perfil_org()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if exists(select 1 from public.espacio_miembros m join public.espacios e on e.id = m.espacio_id where m.usuario_id = old.id and e.tipo = 'organizacion') then
   raise exception 'Desactivá la membresía; la identidad conserva historial' using errcode = '23514';
 end if;
 return old;
end $$;
create trigger tr_proteger_baja_perfil_org before delete on public.perfiles for each row execute function public.proteger_baja_perfil_org();

-- Prohibir que políticas permisivas legadas o superadmin habiliten finanzas familiares en org.
create or replace function public.es_hogar(p_espacio_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.espacios where id = p_espacio_id and tipo = 'hogar');
$$;
create policy "Organizaciones solo por RPC" on public.espacios as restrictive for all to authenticated
 using (tipo = 'hogar' or (id = public.mi_espacio_id() and (public.tiene_permiso(id,'finanzas','ver') or public.es_admin_espacio(id))))
 with check (tipo = 'hogar');
-- En organización la lectura del nombre mínimo es listar_mis_espacios, no SELECT *.
create policy "Membresías de compañeros" on public.espacio_miembros for select to authenticated
 using (espacio_id = public.mi_espacio_id() and public.es_admin_espacio(espacio_id));
create policy "Permisos propios o admin" on public.miembro_permisos for select to authenticated
 using (espacio_id = public.mi_espacio_id() and (public.es_admin_espacio(espacio_id) or exists(
   select 1 from public.espacio_miembros m where m.id = miembro_id and m.usuario_id = auth.uid() and m.activo)));
create policy "Invitaciones de admin" on public.org_invitaciones for select to authenticated
 using (espacio_id = public.mi_espacio_id() and public.es_admin_espacio(espacio_id));
create policy "Auditoría de admin" on public.org_auditoria for select to authenticated
 using (espacio_id = public.mi_espacio_id() and public.es_admin_espacio(espacio_id));

-- Escrituras familiares: serializar con selector y comparar el espacio capturado
-- al iniciar el request. Clientes viejos solo funcionan con una membresía.
create or replace function public.validar_escritura_hogar()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_eid uuid; v_esperado text;
begin
  if current_setting('role',true) not in ('authenticated','anon') then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;
  v_eid := case when tg_op = 'DELETE' then old.espacio_id else new.espacio_id end;
  v_esperado := nullif(current_setting('request.headers',true),'')::jsonb->>'x-espacio-id-esperado';
  if v_esperado is null and (select count(*) from public.espacio_miembros where usuario_id = auth.uid() and activo) > 1 then
    raise exception 'Recargá la app y seleccioná un espacio' using errcode = '42501';
  end if;
  perform public.validar_contexto(coalesce(v_esperado::uuid,v_eid));
  if v_eid is distinct from public.mi_espacio_id() or not public.es_hogar(v_eid) then raise exception 'Espacio familiar inválido' using errcode = '42501'; end if;
  if tg_op = 'UPDATE' and old.espacio_id is distinct from new.espacio_id then raise exception 'No se puede mover un registro entre espacios' using errcode = '42501'; end if;
  if tg_table_name = 'cuotas_detalle' and tg_op <> 'DELETE' then
   if not exists(select 1 from public.deudas_maestras where id = new.deuda_maestra_id and espacio_id = v_eid) then
    raise exception 'Deuda de otro espacio' using errcode = '23514';
   end if;
  end if;
  if tg_table_name = 'historial_salarios' and tg_op <> 'DELETE' then
   if new.ingreso_programado_id is not null and not exists(select 1 from public.ingresos_programados where id = new.ingreso_programado_id and espacio_id = v_eid) then
    raise exception 'Salario de otro espacio' using errcode = '23514';
   end if;
  end if;
  if tg_op = 'DELETE' then return old; else return new; end if;
end $$;
do $$ declare t text; begin
 foreach t in array array['gastos','gastos_programados','ingresos_mensuales','ingresos_programados','historial_salarios','deudas_maestras','cuotas_detalle','notificaciones','cuentas_maestras','cuentas_pendientes','prestamos_personales'] loop
  execute format('create policy "Solo hogar activo" on public.%I as restrictive for all to authenticated using (espacio_id = public.mi_espacio_id() and public.es_hogar(espacio_id)) with check (espacio_id = public.mi_espacio_id() and public.es_hogar(espacio_id))',t);
  execute format('create trigger tr_validar_escritura_hogar before insert or update or delete on public.%I for each row execute function public.validar_escritura_hogar()',t);
 end loop;
 foreach t in array array['sesiones_espacio','miembro_permisos','org_invitaciones','org_auditoria','org_piloto_usuarios','org_intentos_invitacion'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public, anon, authenticated',t);
  execute format('grant all on public.%I to service_role',t);
 end loop;
end $$;
grant select on public.miembro_permisos, public.org_auditoria to authenticated;
-- Nunca exponer token_hash; se entrega token claro una sola vez desde la RPC.
grant select(id,espacio_id,rol,vence_at,max_usos,usos,revocada_at,creada_por,created_at) on public.org_invitaciones to authenticated;

-- ACL explícitas para todos los helpers nuevos y RPC. Funciones internas sin EXECUTE cliente.
revoke all on function public.sesion_auth_id(), public.seleccionar_espacio(uuid), public.listar_mis_espacios(),
 public.validar_contexto(uuid), public.es_admin_espacio(uuid), public.tiene_permiso(uuid,text,text),
 public.aplicar_plantilla_miembro(uuid,text), public.crear_organizacion(text,integer),
 public.crear_invitacion_org(uuid,text,integer), public.aceptar_invitacion_org(text,integer),
 public.revocar_invitacion_org(uuid,uuid), public.actualizar_permisos_miembro(uuid,uuid,jsonb,text,boolean),
 public.listar_integrantes_org(uuid), public.validar_cliente_multi(), public.es_companero_activo(uuid),
 public.es_hogar(uuid), public.validar_escritura_hogar(), public.proteger_baja_perfil_org(), public.salir_de_espacio(uuid)
 from public, anon, authenticated;
grant execute on function public.sesion_auth_id(), public.seleccionar_espacio(uuid), public.listar_mis_espacios(),
 public.validar_contexto(uuid), public.es_admin_espacio(uuid), public.tiene_permiso(uuid,text,text),
 public.aplicar_plantilla_miembro(uuid,text), public.crear_organizacion(text,integer),
 public.crear_invitacion_org(uuid,text,integer), public.aceptar_invitacion_org(text,integer),
 public.revocar_invitacion_org(uuid,uuid), public.actualizar_permisos_miembro(uuid,uuid,jsonb,text,boolean),
 public.listar_integrantes_org(uuid), public.validar_cliente_multi(), public.es_companero_activo(uuid),
 public.es_hogar(uuid), public.validar_escritura_hogar(), public.proteger_baja_perfil_org(), public.salir_de_espacio(uuid)
 to service_role;
grant execute on function public.sesion_auth_id(), public.seleccionar_espacio(uuid), public.listar_mis_espacios(),
 public.es_admin_espacio(uuid), public.tiene_permiso(uuid,text,text), public.crear_organizacion(text,integer),
 public.crear_invitacion_org(uuid,text,integer), public.aceptar_invitacion_org(text,integer),
 public.revocar_invitacion_org(uuid,uuid), public.actualizar_permisos_miembro(uuid,uuid,jsonb,text,boolean),
 public.listar_integrantes_org(uuid), public.es_companero_activo(uuid), public.es_hogar(uuid), public.salir_de_espacio(uuid)
 to authenticated;

-- Un JWT de sesión cerrada tampoco conserva vías de superadmin heredadas.
create or replace function public.es_superadmin()
returns boolean language sql stable security definer set search_path = '' as $$
 select public.sesion_auth_id() is not null and coalesce((select rol = 'superadmin' from public.perfiles where id = auth.uid()),false);
$$;
create policy "Sesión vigente perfiles" on public.perfiles as restrictive for all to authenticated
 using (public.sesion_auth_id() is not null) with check (public.sesion_auth_id() is not null);
create policy "Sesión vigente membresías" on public.espacio_miembros as restrictive for all to authenticated
 using (public.sesion_auth_id() is not null) with check (public.sesion_auth_id() is not null);
create policy "No editar org directamente" on public.espacios as restrictive for update to authenticated
 using (tipo = 'hogar') with check (tipo = 'hogar');
create policy "No borrar org directamente" on public.espacios as restrictive for delete to authenticated using (tipo = 'hogar');
create or replace function public.listar_miembros_hogar(p_espacio_id uuid)
returns table(id uuid, espacio_id uuid, nombre text, rol text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
 select p.id,m.espacio_id,p.nombre,case when p.rol = 'superadmin' then p.rol when m.rol_plantilla = 'admin' then 'admin_hogar' else 'miembro' end,p.created_at
 from public.espacio_miembros m join public.perfiles p on p.id = m.usuario_id
 where m.espacio_id = p_espacio_id and m.activo and p_espacio_id = public.mi_espacio_id() and public.es_hogar(p_espacio_id);
$$;
revoke all on function public.listar_miembros_hogar(uuid) from public,anon;
grant execute on function public.listar_miembros_hogar(uuid) to authenticated,service_role;
commit;
