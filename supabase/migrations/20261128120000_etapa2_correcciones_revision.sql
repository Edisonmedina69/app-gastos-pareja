-- Correcciones de la revisión de seguridad de etapa 2 (docs/REVIEW_ETAPA2.md).
-- Requiere etapa 2. NO aplicada en producción: necesita OK explícito del dueño.
-- 1. ALTO: una invitación vale solo mientras su creador conserve la autoridad
--    que tenía al emitirla. Bajas y degradaciones revocan lo pendiente.
-- 2. MEDIO: salir de un espacio borra los contextos de sesión que lo apuntaban.
-- 3. MEDIO: el borrado en cascada de un hogar (superadmin) no choca con la
--    guarda de escrituras familiares ni con contextos de sesión que lo apuntan.
-- 4. MEDIO (M6, decisión del dueño): quien fue dado de baja no reingresa con
--    una invitación emitida antes de su baja. Vuelve solo si un admin lo
--    reactiva o le envía una invitación nueva.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- Un contexto no es historial: si el espacio desaparece, la sesión vuelve a elegir.
alter table public.sesiones_espacio drop constraint sesiones_espacio_espacio_id_fkey,
  add constraint sesiones_espacio_espacio_id_fkey foreign key (espacio_id) references public.espacios(id) on delete cascade;

-- Sello de baja: lo escribe solo el servidor (authenticated no tiene UPDATE).
alter table public.espacio_miembros add column desactivado_at timestamptz;
-- Bajas previas en organizaciones: fecha desconocida, tomar el momento de migrar
-- para que ningún link anterior las reabra. Hogares no usan invitaciones org.
update public.espacio_miembros m set desactivado_at = now()
  from public.espacios e
  where e.id = m.espacio_id and e.tipo = 'organizacion' and not m.activo;
create or replace function public.sellar_baja_membresia()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.desactivado_at := case when new.activo then null else clock_timestamp() end;
  elsif old.activo and not new.activo then
    new.desactivado_at := clock_timestamp();
  else
    new.desactivado_at := old.desactivado_at;
  end if;
  return new;
end $$;
-- Comparar emisión y baja con el mismo reloj, aun dentro de una transacción.
alter table public.org_invitaciones alter column created_at set default clock_timestamp();
create trigger tr_sellar_baja_membresia before insert or update on public.espacio_miembros
  for each row execute function public.sellar_baja_membresia();

-- Autoridad vigente del creador. Se evalúa con el lock del espacio tomado.
create or replace function public.invitacion_vigente(p_invitacion_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.org_invitaciones i
    join public.espacio_miembros m on m.espacio_id = i.espacio_id and m.usuario_id = i.creada_por and m.activo
    where i.id = p_invitacion_id
      and (m.rol_plantilla = 'admin' or (i.rol = 'lectura' and exists (
        select 1 from public.miembro_permisos p
        where p.espacio_id = m.espacio_id and p.miembro_id = m.id
          and p.recurso = 'integrantes' and p.accion = 'invitar' and p.permitido)))
  );
$$;

create or replace function public.aceptar_invitacion_org(p_token text, p_version integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_i public.org_invitaciones%rowtype; v_mid uuid; v_intentos integer; v_eid uuid; v_baja timestamptz;
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
  -- El creador pudo ser dado de baja o degradado después de emitirla.
  if not public.invitacion_vigente(v_i.id) then
    update public.org_invitaciones set revocada_at = now() where org_invitaciones.id = v_i.id;
    return jsonb_build_object('error','Invitación inválida, vencida o revocada');
  end if;
  -- M6: una baja no se revierte con un link previo, ni siquiera multiuso.
  select desactivado_at into v_baja from public.espacio_miembros
    where espacio_id = v_i.espacio_id and usuario_id = auth.uid() and not activo;
  if v_baja is not null and v_i.created_at <= v_baja then
    return jsonb_build_object('error','Fuiste dado de baja: pedí a un admin que te reactive o te envíe una invitación nueva');
  end if;
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

-- Defensa en profundidad y visibilidad en la UI: al dar de baja o quitar admin,
-- revocar lo pendiente. Corre con el lock del espacio que toma el trigger BEFORE.
create or replace function public.revocar_invitaciones_de_baja()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.activo and not new.activo then
    update public.org_invitaciones set revocada_at = now()
      where espacio_id = new.espacio_id and creada_por = new.usuario_id and revocada_at is null;
  elsif old.rol_plantilla = 'admin' and new.rol_plantilla <> 'admin' then
    update public.org_invitaciones set revocada_at = now()
      where espacio_id = new.espacio_id and creada_por = new.usuario_id and revocada_at is null and rol <> 'lectura';
  end if;
  return new;
end $$;
create trigger tr_revocar_invitaciones_de_baja after update of activo, rol_plantilla on public.espacio_miembros
  for each row execute function public.revocar_invitaciones_de_baja();

create or replace function public.salir_de_espacio(p_espacio_id_esperado uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.validar_contexto(p_espacio_id_esperado);
  perform 1 from public.espacios where id = p_espacio_id_esperado for update;
  update public.espacio_miembros set activo = false where espacio_id = p_espacio_id_esperado and usuario_id = auth.uid() and activo;
  update public.perfiles set espacio_id = null where id = auth.uid() and espacio_id = p_espacio_id_esperado;
  -- Sin esto, un hogar creado o unido después queda inaccesible hasta reelegirlo.
  delete from public.sesiones_espacio where usuario_id = auth.uid() and espacio_id = p_espacio_id_esperado;
end $$;

create or replace function public.validar_escritura_hogar()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_eid uuid; v_esperado text;
begin
  if current_setting('role',true) not in ('authenticated','anon') then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;
  v_eid := case when tg_op = 'DELETE' then old.espacio_id else new.espacio_id end;
  -- Cascada de un espacio ya borrado (solo superadmin borra espacios por RLS):
  -- la acción referencial no es una escritura de la sesión y no tiene contexto.
  if tg_op <> 'INSERT' and old.espacio_id is not distinct from v_eid
     and not exists (select 1 from public.espacios where id = old.espacio_id) then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;
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

revoke all on function public.invitacion_vigente(uuid), public.revocar_invitaciones_de_baja(), public.sellar_baja_membresia() from public, anon, authenticated;
grant execute on function public.invitacion_vigente(uuid), public.revocar_invitaciones_de_baja(), public.sellar_baja_membresia() to service_role;
commit;
