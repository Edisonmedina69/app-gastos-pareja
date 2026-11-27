-- M6 incremental: recuperado de d45aeb6 sin reescribir la migración de #35.
-- Requiere 20261128120000; comprobar catálogo e historial antes de aplicar.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

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

revoke all on function public.sellar_baja_membresia() from public, anon, authenticated;
grant execute on function public.sellar_baja_membresia() to service_role;
commit;
