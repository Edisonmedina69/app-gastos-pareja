-- Complemento incremental de #36. Aplicar después de 20261129120000, en mantenimiento.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- Abortar ante movimientos legados sin evidencia: nunca fabricar comprobantes.
do $$ begin
  if exists(select 1 from public.org_operaciones where tipo in ('financiacion_socio','reembolso_socio','retiro_socio')) then
    raise exception 'Existen movimientos de socios previos: conciliar y resolver evidencia antes de aplicar';
  end if;
end $$;

create table public.org_adjuntos (
  id uuid primary key default gen_random_uuid(),
  espacio_id uuid not null references public.espacios(id),
  destino text not null default 'tesoreria' check (destino = 'tesoreria'),
  finalidad text not null default 'comprobante' check (finalidad = 'comprobante'),
  tipo_operacion text not null check (tipo_operacion in ('financiacion_socio','reembolso_socio','retiro_socio')),
  miembro_id uuid not null,
  object_path text not null unique,
  nombre_original text not null check (length(nombre_original) between 1 and 160),
  mime text not null check (mime in ('application/pdf','image/jpeg','image/png')),
  bytes bigint not null check (bytes between 1 and 10485760),
  subido_por uuid not null references auth.users(id),
  estado text not null default 'pendiente' check (estado in ('pendiente','listo','consumido','descartado')),
  verificado_at timestamptz,
  sha256 text,
  storage_object_id uuid,
  storage_version text,
  created_at timestamptz not null default now(),
  unique (espacio_id,id),
  foreign key (espacio_id,miembro_id) references public.espacio_miembros(espacio_id,id),
  check (estado not in ('listo','consumido') or
    (verificado_at is not null and sha256 is not null and sha256 ~ '^[0-9a-f]{64}$' and storage_object_id is not null)),
  check (object_path = espacio_id::text || '/tesoreria/' || id::text || case mime
    when 'application/pdf' then '.pdf' when 'image/jpeg' then '.jpg' else '.png' end)
);
create index org_adjuntos_autor_idx on public.org_adjuntos(subido_por,created_at);
alter table public.org_operaciones add constraint org_operaciones_comprobante_fk
  foreign key (espacio_id,comprobante_id) references public.org_adjuntos(espacio_id,id);
alter table public.org_operaciones add constraint org_operaciones_comprobante_obligatorio
  check (tipo not in ('financiacion_socio','reembolso_socio','retiro_socio') or comprobante_id is not null);
alter table public.org_adjuntos enable row level security;
revoke all on public.org_adjuntos from public,anon,authenticated,service_role;
grant select on public.org_adjuntos to authenticated;

create function public.validar_permiso_comprobante_org(p_espacio uuid,p_tipo text,p_miembro uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_usuario uuid;
begin
  perform public.validar_contexto(p_espacio);
  if not exists(select 1 from public.espacios where id=p_espacio and tipo='organizacion') then
    raise exception 'Organización inválida' using errcode='42501';
  end if;
  select usuario_id into v_usuario from public.espacio_miembros
    where espacio_id=p_espacio and id=p_miembro and activo;
  if not found then raise exception 'Socio inexistente o inactivo' using errcode='42501'; end if;
  if p_tipo='financiacion_socio' then
    if not public.tiene_permiso(p_espacio,'gastos','pagar') or
      (v_usuario<>auth.uid() and not (public.tiene_permiso(p_espacio,'socios','crear') or public.tiene_permiso(p_espacio,'socios','pagar'))) then
      raise exception 'No tenés permiso para este pago personal' using errcode='42501';
    end if;
  elsif p_tipo in ('reembolso_socio','retiro_socio') then
    if not (public.tiene_permiso(p_espacio,'cuentas','pagar') and public.tiene_permiso(p_espacio,'socios','pagar')) then
      raise exception 'Se requieren cuentas.pagar y socios.pagar' using errcode='42501';
    end if;
  else raise exception 'Finalidad inválida' using errcode='22023'; end if;
end $$;

create function public.puede_leer_comprobante_org(p_espacio uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.sesion_auth_id() is not null and public.mi_espacio_id()=p_espacio
    and public.tiene_permiso(p_espacio,'finanzas','ver') and public.tiene_permiso(p_espacio,'socios','ver');
$$;
create policy org_adjuntos_lectura on public.org_adjuntos for select to authenticated
using (public.puede_leer_comprobante_org(espacio_id));

create function public.reservar_comprobante_org(p_espacio_id_esperado uuid,p_tipo text,p_miembro_id uuid,p_nombre text,p_mime text,p_bytes bigint)
returns public.org_adjuntos language plpgsql security definer set search_path = '' as $$
declare v_id uuid:=gen_random_uuid(); v_adjunto public.org_adjuntos;
begin
  perform public.validar_permiso_comprobante_org(p_espacio_id_esperado,p_tipo,p_miembro_id);
  perform 1 from public.espacios where id=p_espacio_id_esperado for update;
  perform public.validar_permiso_comprobante_org(p_espacio_id_esperado,p_tipo,p_miembro_id);
  if p_mime not in ('application/pdf','image/jpeg','image/png') or p_mime is null
    or p_bytes is null or p_bytes not between 1 and 10485760 then
    raise exception 'Adjuntá PDF, JPG o PNG de hasta 10 MiB' using errcode='22023';
  end if;
  -- Evita acumular reservas sin límite por usuario. Descartar libera el cupo.
  if (select count(*) from public.org_adjuntos where subido_por=auth.uid() and espacio_id=p_espacio_id_esperado and estado in ('pendiente','listo'))>=30 then
    raise exception 'Descartá comprobantes pendientes antes de reservar otro' using errcode='22023';
  end if;
  insert into public.org_adjuntos(id,espacio_id,tipo_operacion,miembro_id,object_path,nombre_original,mime,bytes,subido_por)
  values(v_id,p_espacio_id_esperado,p_tipo,p_miembro_id,
    p_espacio_id_esperado::text||'/tesoreria/'||v_id::text||case p_mime when 'application/pdf' then '.pdf' when 'image/jpeg' then '.jpg' else '.png' end,
    coalesce(nullif(left(regexp_replace(trim(p_nombre),'[^[:alnum:] ._-]','','g'),160),''),'Comprobante'),p_mime,p_bytes,auth.uid())
  returning * into v_adjunto;
  return v_adjunto;
end $$;

-- Acceso para verificar/subir: exige el autor y el permiso concreto actual.
create function public.obtener_reserva_comprobante_org(p_espacio_id_esperado uuid,p_adjunto_id uuid)
returns public.org_adjuntos language plpgsql security definer set search_path = '' as $$
declare v public.org_adjuntos;
begin
  perform public.validar_contexto(p_espacio_id_esperado);
  select * into v from public.org_adjuntos where id=p_adjunto_id and espacio_id=p_espacio_id_esperado and subido_por=auth.uid();
  if not found or v.estado='descartado' then raise exception 'Reserva no disponible' using errcode='42501'; end if;
  perform public.validar_permiso_comprobante_org(v.espacio_id,v.tipo_operacion,v.miembro_id);
  return v;
end $$;

create function public.puede_subir_comprobante_org(p_path text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare v public.org_adjuntos;
begin
  select * into v from public.org_adjuntos where object_path=p_path and subido_por=auth.uid() and estado='pendiente';
  if not found then return false; end if;
  perform public.validar_permiso_comprobante_org(v.espacio_id,v.tipo_operacion,v.miembro_id);
  return true;
exception when others then return false;
end $$;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('org-comprobantes','org-comprobantes',false,10485760,array['application/pdf','image/jpeg','image/png']);

create policy org_comprobantes_subir on storage.objects for insert to authenticated
with check(bucket_id='org-comprobantes' and public.puede_subir_comprobante_org(name));
-- Restrictivas: las políticas permisivas preexistentes de otros buckets no abren éste.
create policy org_comprobantes_insert_guard on storage.objects as restrictive for insert to authenticated
with check(bucket_id<>'org-comprobantes' or public.puede_subir_comprobante_org(name));
create policy org_comprobantes_read_guard on storage.objects as restrictive for select to authenticated
using(bucket_id<>'org-comprobantes');
create policy org_comprobantes_update_guard on storage.objects as restrictive for update to authenticated
using(bucket_id<>'org-comprobantes') with check(bucket_id<>'org-comprobantes');
create policy org_comprobantes_delete_guard on storage.objects as restrictive for delete to authenticated
using(bucket_id<>'org-comprobantes');
create policy org_comprobantes_anon_guard on storage.objects as restrictive for all to anon
using(bucket_id<>'org-comprobantes') with check(bucket_id<>'org-comprobantes');

-- También protege frente a una limpieza privilegiada accidental. No modifica bytes de Storage.
create function public.proteger_objeto_comprobante_org()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_estado text;
begin
  if old.bucket_id='org-comprobantes' then
    select estado into v_estado from public.org_adjuntos where object_path=old.name for update;
    if tg_op='UPDATE' or v_estado is distinct from 'descartado' then
      raise exception 'El comprobante no se puede sustituir ni borrar; descartá primero una reserva no consumida' using errcode='42501';
    end if;
  elsif tg_op='UPDATE' and new.bucket_id='org-comprobantes' then
    raise exception 'No se puede mover un objeto a comprobantes' using errcode='42501';
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;
create trigger proteger_objeto_comprobante_org before update or delete on storage.objects
for each row execute function public.proteger_objeto_comprobante_org();

-- Exclusiva del verificador Edge: actor/sesión provienen de Auth, nunca del body cliente.
create function public.confirmar_comprobante_servidor_org(p_espacio uuid,p_adjunto uuid,p_actor uuid,p_sesion uuid,p_sha256 text,p_bytes bigint,p_mime text)
returns void language plpgsql security definer set search_path = '' as $$
declare v public.org_adjuntos; o storage.objects;
begin
  perform set_config('request.jwt.claims',jsonb_build_object('sub',p_actor,'session_id',p_sesion,'role','authenticated')::text,true);
  perform set_config('request.headers','{"x-app-version":"2"}',true);
  perform public.validar_contexto(p_espacio);
  perform 1 from public.espacios where id=p_espacio for update;
  v:=public.obtener_reserva_comprobante_org(p_espacio,p_adjunto);
  select * into v from public.org_adjuntos where id=p_adjunto for update;
  if v.estado not in ('pendiente','listo','consumido') then raise exception 'Reserva descartada' using errcode='23514'; end if;
  select * into o from storage.objects where bucket_id='org-comprobantes' and name=v.object_path;
  if not found or p_sha256 is null or p_sha256 !~ '^[0-9a-f]{64}$'
    or p_bytes is distinct from v.bytes or p_mime is distinct from v.mime
    or (o.metadata->>'size')::bigint is distinct from p_bytes
    or o.metadata->>'mimetype' is distinct from p_mime then
    raise exception 'El objeto real no coincide con la reserva verificada' using errcode='23514';
  end if;
  if v.estado in ('listo','consumido') then
    if v.sha256 is distinct from p_sha256 or v.storage_object_id is distinct from o.id or v.storage_version is distinct from o.version then
      raise exception 'El objeto verificado cambió' using errcode='23514';
    end if;
    return;
  end if;
  update public.org_adjuntos set estado='listo',verificado_at=now(),sha256=p_sha256,storage_object_id=o.id,storage_version=o.version where id=v.id;
end $$;

create function public.descartar_comprobante_org(p_espacio_id_esperado uuid,p_adjunto_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v public.org_adjuntos;
begin
  perform public.validar_contexto(p_espacio_id_esperado);
  perform 1 from public.espacios where id=p_espacio_id_esperado for update;
  select * into v from public.org_adjuntos where id=p_adjunto_id and espacio_id=p_espacio_id_esperado and subido_por=auth.uid() for update;
  if not found or v.estado='consumido' then raise exception 'No se puede descartar este comprobante' using errcode='42501'; end if;
  if v.estado='descartado' then return; end if;
  update public.org_adjuntos set estado='descartado' where id=v.id;
end $$;

create function public.consumir_comprobante_org(p_espacio uuid,p_adjunto uuid,p_tipo text,p_miembro uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v public.org_adjuntos; o storage.objects;
begin
  perform public.validar_permiso_comprobante_org(p_espacio,p_tipo,p_miembro);
  select * into v from public.org_adjuntos where espacio_id=p_espacio and id=p_adjunto for update;
  if not found or v.estado<>'listo' or v.subido_por<>auth.uid() or v.tipo_operacion<>p_tipo or v.miembro_id<>p_miembro then
    raise exception 'Falta un comprobante verificado propio, disponible y de esta operación' using errcode='23514';
  end if;
  select * into o from storage.objects where bucket_id='org-comprobantes' and name=v.object_path;
  if not found or o.id is distinct from v.storage_object_id or o.version is distinct from v.storage_version
    or (o.metadata->>'size')::bigint is distinct from v.bytes or o.metadata->>'mimetype' is distinct from v.mime then
    raise exception 'El comprobante real no está disponible o cambió' using errcode='23514';
  end if;
  update public.org_adjuntos set estado='consumido' where id=v.id;
end $$;

create function public.proteger_adjunto_org()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op='DELETE' or old.estado in ('consumido','descartado') or
    (to_jsonb(new)-array['estado','verificado_at','sha256','storage_object_id','storage_version']) is distinct from
    (to_jsonb(old)-array['estado','verificado_at','sha256','storage_object_id','storage_version']) or
    not ((old.estado='pendiente' and new.estado in ('listo','descartado')) or (old.estado='listo' and new.estado in ('consumido','descartado'))) or
    (old.estado='listo' and (new.verificado_at,new.sha256,new.storage_object_id,new.storage_version) is distinct from (old.verificado_at,old.sha256,old.storage_object_id,old.storage_version)) then
    raise exception 'Comprobante inmutable o transición inválida' using errcode='42501';
  end if;
  return new;
end $$;
create trigger proteger_adjunto_org before update or delete on public.org_adjuntos for each row execute function public.proteger_adjunto_org();

create function public.validar_consumo_comprobante_org()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.estado='consumido' and not exists(select 1 from public.org_operaciones o where o.espacio_id=new.espacio_id
    and o.comprobante_id=new.id and o.tipo=new.tipo_operacion and o.registrado_por=new.subido_por) then
    raise exception 'Consumo sin operación atómica' using errcode='23514';
  end if;
  return null;
end $$;
create constraint trigger validar_consumo_comprobante_org after update on public.org_adjuntos
deferrable initially deferred for each row execute function public.validar_consumo_comprobante_org();

create function public.validar_comprobante_operacion_org()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.comprobante_id is not null and not exists(select 1 from public.org_adjuntos a
    where a.id=new.comprobante_id and a.espacio_id=new.espacio_id and a.estado='consumido'
      and a.tipo_operacion=new.tipo and a.subido_por=new.registrado_por) then
    raise exception 'Operación sin consumo de comprobante compatible' using errcode='23514';
  end if;
  return new;
end $$;
create trigger validar_comprobante_operacion_org before insert on public.org_operaciones
for each row execute function public.validar_comprobante_operacion_org();

-- Las firmas antiguas se eliminan: un frontend cacheado falla cerrado antes de contabilizar.
drop function public.registrar_pago_personal_socio_org(uuid,uuid,uuid,uuid,numeric,numeric,text,date,text);
drop function public.registrar_movimiento_socio_org(uuid,uuid,text,uuid,uuid,numeric,numeric,text,date,text,boolean);

-- RPC financieras nuevas se agregan a continuación (con comprobante obligatorio).

create or replace function public.registrar_pago_personal_socio_org(
  p_espacio_id_esperado uuid,
  p_idempotencia uuid,
  p_miembro_id uuid,
  p_cuenta_socio_id uuid,
  p_importe numeric,
  p_comprobante_id uuid,
  p_tasa_base numeric default null,
  p_fuente_tasa text default 'manual_confirmada',
  p_fecha_efectiva date default current_date,
  p_motivo text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_op_id uuid;
  v_hash text := encode(extensions.digest(jsonb_build_array('registrar_pago_personal_socio_org',p_comprobante_id,p_miembro_id,p_cuenta_socio_id,p_importe,p_tasa_base,trim(p_fuente_tasa),coalesce(p_fecha_efectiva,current_date),trim(p_motivo))::text,'sha256'),'hex');
  v_cuenta public.org_cuentas%rowtype;
  v_miembro public.espacio_miembros%rowtype;
  v_tasa numeric;
  v_base numeric(20,6);
begin
  perform public.validar_contexto(p_espacio_id_esperado);
  if p_idempotencia is null then raise exception 'Falta clave de idempotencia' using errcode = '22023'; end if;
  perform 1 from public.espacios where id = p_espacio_id_esperado and tipo = 'organizacion' for update;
  if not found then raise exception 'Organización inválida' using errcode = '42501'; end if;

  if not public.tiene_permiso(p_espacio_id_esperado, 'gastos', 'pagar') then
    raise exception 'No tenés permiso para registrar pagos' using errcode = '42501';
  end if;

  perform public.validar_permiso_comprobante_org(p_espacio_id_esperado,'financiacion_socio',p_miembro_id);
  v_op_id := public.reintento_operacion_org(p_espacio_id_esperado,p_idempotencia,v_hash);
  if v_op_id is not null then return v_op_id; end if;
  perform public.consumir_comprobante_org(p_espacio_id_esperado,p_comprobante_id,'financiacion_socio',p_miembro_id);

  select * into v_miembro from public.espacio_miembros
    where espacio_id = p_espacio_id_esperado and id = p_miembro_id and activo for update;
  if not found then raise exception 'Socio inexistente o inactivo en esta organización' using errcode = '23514'; end if;

  if v_miembro.usuario_id <> auth.uid()
     and not (public.tiene_permiso(p_espacio_id_esperado, 'socios', 'crear') or public.tiene_permiso(p_espacio_id_esperado, 'socios', 'pagar')) then
    raise exception 'Solo podés registrar pagos personales propios o tener permiso en socios' using errcode = '42501';
  end if;

  select * into v_cuenta from public.org_cuentas
    where espacio_id = p_espacio_id_esperado and id = p_cuenta_socio_id for update;
  if not found or v_cuenta.tipo <> 'socio' or v_cuenta.titular_miembro_id is distinct from v_miembro.id then
    raise exception 'La cuenta debe ser una cuenta de socio cuyo titular sea ese integrante' using errcode = '23514';
  end if;
  if not v_cuenta.activa then
    raise exception 'La cuenta del socio está inactiva' using errcode = '22023';
  end if;
  if nullif(trim(p_motivo),'') is null then
    raise exception 'Indicá el concepto o motivo del pago personal del socio' using errcode = '22023';
  end if;

  v_tasa := case when v_cuenta.moneda = 'PYG' then coalesce(p_tasa_base, 1) else p_tasa_base end;
  perform public.validar_importe_tasa_org(v_cuenta.moneda, p_importe, v_tasa, p_fuente_tasa);
  v_base := round(p_importe * v_tasa, 6);

  insert into public.org_operaciones(espacio_id, tipo, fecha_efectiva, registrado_por, idempotencia, solicitud_hash, motivo, comprobante_id)
    values(p_espacio_id_esperado, 'financiacion_socio', coalesce(p_fecha_efectiva, current_date), auth.uid(), p_idempotencia, v_hash, trim(p_motivo), p_comprobante_id)
    returning id into v_op_id;

  -- Dos apuntes en la cuenta del socio (+financiación y −gasto) que dejan custodia neta sin cambio.
  insert into public.org_apuntes(espacio_id, operacion_id, cuenta_id, importe_firmado, tasa_base, importe_base_firmado, fuente_tasa)
    values
      (p_espacio_id_esperado, v_op_id, v_cuenta.id, p_importe, v_tasa, v_base, trim(p_fuente_tasa)),
      (p_espacio_id_esperado, v_op_id, v_cuenta.id, -p_importe, v_tasa, -v_base, trim(p_fuente_tasa));

  -- Deuda positiva: la empresa le debe al socio.
  insert into public.org_movimientos_socios(espacio_id, operacion_id, miembro_id, clase, moneda, importe_deuda_firmado, tasa_base, importe_base_firmado)
    values(p_espacio_id_esperado, v_op_id, v_miembro.id, 'prestamo', v_cuenta.moneda, p_importe, v_tasa, v_base);

  insert into public.org_auditoria(espacio_id, actor_id, entidad, entidad_id, accion, cambios)
    values(p_espacio_id_esperado, auth.uid(), 'operaciones', v_op_id, 'pago_personal_socio',
      jsonb_build_object('miembro_id', v_miembro.id, 'cuenta_id', v_cuenta.id, 'moneda', v_cuenta.moneda, 'importe', p_importe, 'tasa_base', v_tasa));
  return v_op_id;
end $$;


create or replace function public.registrar_movimiento_socio_org(
  p_espacio_id_esperado uuid,
  p_idempotencia uuid,
  p_tipo text,
  p_miembro_id uuid,
  p_cuenta_id uuid,
  p_importe numeric,
  p_comprobante_id uuid,
  p_tasa_base numeric default null,
  p_fuente_tasa text default 'manual_confirmada',
  p_fecha_efectiva date default current_date,
  p_motivo text default null,
  p_confirmar_saldo_insuficiente boolean default false
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_op_id uuid;
  v_hash text := encode(extensions.digest(jsonb_build_array('registrar_movimiento_socio_org',p_comprobante_id,p_tipo,p_miembro_id,p_cuenta_id,p_importe,p_tasa_base,trim(p_fuente_tasa),coalesce(p_fecha_efectiva,current_date),trim(p_motivo),coalesce(p_confirmar_saldo_insuficiente,false))::text,'sha256'),'hex');
  v_cuenta public.org_cuentas%rowtype;
  v_miembro public.espacio_miembros%rowtype;
  v_clase text;
  v_tasa numeric;
  v_base numeric(20,6);
  v_saldo_actual numeric(20,6);
  v_deuda_a_favor numeric(20,6);
  v_deuda_base numeric(20,6);
  v_base_deuda numeric(20,6);
  v_tasa_deuda numeric(20,10);
begin
  perform public.validar_contexto(p_espacio_id_esperado);
  if p_idempotencia is null then raise exception 'Falta clave de idempotencia' using errcode = '22023'; end if;
  perform 1 from public.espacios where id = p_espacio_id_esperado and tipo = 'organizacion' for update;
  if not found then raise exception 'Organización inválida' using errcode = '42501'; end if;

  if p_tipo not in ('reembolso_socio','retiro_socio') then
    raise exception 'Tipo de movimiento de socio inválido' using errcode = '22023';
  end if;
  if not (
    public.tiene_permiso(p_espacio_id_esperado, 'cuentas', 'pagar')
    and public.tiene_permiso(p_espacio_id_esperado, 'socios', 'pagar')
  ) then
    raise exception 'Se requieren los permisos cuentas.pagar y socios.pagar' using errcode = '42501';
  end if;

  perform public.validar_permiso_comprobante_org(p_espacio_id_esperado,p_tipo,p_miembro_id);
  v_op_id := public.reintento_operacion_org(p_espacio_id_esperado,p_idempotencia,v_hash);
  if v_op_id is not null then return v_op_id; end if;
  perform public.consumir_comprobante_org(p_espacio_id_esperado,p_comprobante_id,p_tipo,p_miembro_id);

  select * into v_miembro from public.espacio_miembros
    where espacio_id = p_espacio_id_esperado and id = p_miembro_id and activo for update;
  if not found then raise exception 'Socio inexistente o inactivo en esta organización' using errcode = '23514'; end if;

  select * into v_cuenta from public.org_cuentas
    where espacio_id = p_espacio_id_esperado and id = p_cuenta_id for update;
  if not found then raise exception 'Cuenta inexistente en esta organización' using errcode = '23514'; end if;
  if not v_cuenta.activa then raise exception 'La cuenta seleccionada está inactiva' using errcode = '22023'; end if;
  if nullif(trim(p_motivo),'') is null then
    raise exception 'Indicá el motivo del movimiento con el socio' using errcode = '22023';
  end if;

  v_tasa := case when v_cuenta.moneda = 'PYG' then coalesce(p_tasa_base, 1) else p_tasa_base end;
  perform public.validar_importe_tasa_org(v_cuenta.moneda, p_importe, v_tasa, p_fuente_tasa);
  v_base := round(p_importe * v_tasa, 6);
  v_base_deuda := v_base;
  v_tasa_deuda := v_tasa;

  select coalesce(sum(importe_firmado), 0) into v_saldo_actual
    from public.org_apuntes where espacio_id = p_espacio_id_esperado and cuenta_id = v_cuenta.id;
  if v_saldo_actual < p_importe then
    if not coalesce(p_confirmar_saldo_insuficiente, false) then
      raise exception 'Saldo insuficiente en % (disponible: %). Confirmá la excepción para continuar', v_cuenta.nombre, v_saldo_actual using errcode = '22023';
    end if;
  end if;

  if p_tipo = 'reembolso_socio' then
    select coalesce(sum(importe_deuda_firmado), 0), coalesce(sum(importe_base_firmado), 0)
      into v_deuda_a_favor, v_deuda_base
      from public.org_movimientos_socios
      where espacio_id = p_espacio_id_esperado and miembro_id = v_miembro.id and moneda = v_cuenta.moneda;
    if v_deuda_a_favor < p_importe then
      raise exception 'El reembolso (%) supera lo que la empresa le debe al socio en % (%)', p_importe, v_cuenta.moneda, greatest(v_deuda_a_favor, 0) using errcode = '22023';
    end if;
    -- Cancela la valoración histórica de la deuda, no la de la caja de hoy.
    -- El último reembolso absorbe el residuo de redondeo y salda ambas monedas.
    v_base_deuda := case when p_importe = v_deuda_a_favor then v_deuda_base
      else round(v_deuda_base * p_importe / v_deuda_a_favor,6) end;
    v_tasa_deuda := round(v_base_deuda / p_importe,10);
    v_clase := 'reembolso';
  else
    v_clase := 'retiro';
  end if;

  insert into public.org_operaciones(espacio_id, tipo, fecha_efectiva, registrado_por, idempotencia, solicitud_hash, motivo, comprobante_id)
    values(p_espacio_id_esperado, p_tipo, coalesce(p_fecha_efectiva, current_date), auth.uid(), p_idempotencia, v_hash, trim(p_motivo), p_comprobante_id)
    returning id into v_op_id;

  insert into public.org_apuntes(espacio_id, operacion_id, cuenta_id, importe_firmado, tasa_base, importe_base_firmado, fuente_tasa)
    values(p_espacio_id_esperado, v_op_id, v_cuenta.id, -p_importe, v_tasa, -v_base, trim(p_fuente_tasa));

  insert into public.org_movimientos_socios(espacio_id, operacion_id, miembro_id, clase, moneda, importe_deuda_firmado, tasa_base, importe_base_firmado)
    values(p_espacio_id_esperado, v_op_id, v_miembro.id, v_clase, v_cuenta.moneda, -p_importe, v_tasa_deuda, -v_base_deuda);

  insert into public.org_auditoria(espacio_id, actor_id, entidad, entidad_id, accion, cambios)
    values(p_espacio_id_esperado, auth.uid(), 'operaciones', v_op_id, p_tipo,
      jsonb_build_object('miembro_id', v_miembro.id, 'cuenta_id', v_cuenta.id, 'moneda', v_cuenta.moneda, 'importe', p_importe, 'tasa_base', v_tasa,
        'importe_base_deuda',v_base_deuda,'diferencia_cambio_base',v_base-v_base_deuda));
  return v_op_id;
end $$;


revoke all on function public.validar_permiso_comprobante_org(uuid,text,uuid), public.puede_leer_comprobante_org(uuid), public.reservar_comprobante_org(uuid,text,uuid,text,text,bigint), public.obtener_reserva_comprobante_org(uuid,uuid), public.puede_subir_comprobante_org(text), public.proteger_objeto_comprobante_org(), public.confirmar_comprobante_servidor_org(uuid,uuid,uuid,uuid,text,bigint,text), public.descartar_comprobante_org(uuid,uuid), public.consumir_comprobante_org(uuid,uuid,text,uuid), public.proteger_adjunto_org(), public.validar_consumo_comprobante_org(), public.validar_comprobante_operacion_org(), public.registrar_pago_personal_socio_org(uuid,uuid,uuid,uuid,numeric,uuid,numeric,text,date,text), public.registrar_movimiento_socio_org(uuid,uuid,text,uuid,uuid,numeric,uuid,numeric,text,date,text,boolean) from public,anon,authenticated,service_role;
grant execute on function public.puede_leer_comprobante_org(uuid), public.puede_subir_comprobante_org(text), public.reservar_comprobante_org(uuid,text,uuid,text,text,bigint), public.obtener_reserva_comprobante_org(uuid,uuid), public.descartar_comprobante_org(uuid,uuid), public.registrar_pago_personal_socio_org(uuid,uuid,uuid,uuid,numeric,uuid,numeric,text,date,text), public.registrar_movimiento_socio_org(uuid,uuid,text,uuid,uuid,numeric,uuid,numeric,text,date,text,boolean) to authenticated;
grant execute on function public.confirmar_comprobante_servidor_org(uuid,uuid,uuid,uuid,text,bigint,text) to service_role;
-- La lectura del contenido se emite solamente en Edge, con URL de 60 segundos.
create function public.obtener_lectura_comprobante_org(p_espacio_id_esperado uuid,p_adjunto_id uuid)
returns public.org_adjuntos language plpgsql security definer set search_path = '' as $$
declare v public.org_adjuntos;
begin
  perform public.validar_contexto(p_espacio_id_esperado);
  if not public.puede_leer_comprobante_org(p_espacio_id_esperado) then raise exception 'Sin permiso para leer comprobantes' using errcode='42501'; end if;
  select * into v from public.org_adjuntos where espacio_id=p_espacio_id_esperado and id=p_adjunto_id and estado in ('listo','consumido');
  if not found then raise exception 'Comprobante no disponible' using errcode='42501'; end if;
  return v;
end $$;
revoke all on function public.obtener_lectura_comprobante_org(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.obtener_lectura_comprobante_org(uuid,uuid) to authenticated;

-- Recuperar reservas propias al volver al formulario/espacio, sin persistir archivos en el navegador.
create function public.listar_reservas_comprobante_org(p_espacio_id_esperado uuid,p_tipo text,p_miembro_id uuid)
returns setof public.org_adjuntos language plpgsql security definer set search_path = '' as $$
begin
  perform public.validar_permiso_comprobante_org(p_espacio_id_esperado,p_tipo,p_miembro_id);
  return query select * from public.org_adjuntos where espacio_id=p_espacio_id_esperado and subido_por=auth.uid()
    and tipo_operacion=p_tipo and miembro_id=p_miembro_id and estado in ('pendiente','listo') order by created_at desc limit 30;
end $$;
revoke all on function public.listar_reservas_comprobante_org(uuid,text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.listar_reservas_comprobante_org(uuid,text,uuid) to authenticated;

-- Fase 1 de limpieza privilegiada. Tras el commit, borrar solo los paths retornados usando Storage API.
-- No toca consumidos ni espera adjuntos que estén siendo verificados/contabilizados.
create function public.descartar_reservas_vencidas_org(p_limite integer default 100)
returns table(adjunto_id uuid,object_path text) language plpgsql security definer set search_path = '' as $$
begin
  if p_limite is null or p_limite not between 1 and 1000 then raise exception 'Límite inválido' using errcode='22023'; end if;
  return query
  with vencidos as (
    select a.id from public.org_adjuntos a where a.estado in ('pendiente','listo')
      and a.created_at < now()-interval '24 hours'
      and not exists(select 1 from public.org_operaciones o where o.comprobante_id=a.id)
    order by a.created_at limit p_limite for update of a skip locked
  )
  update public.org_adjuntos a set estado='descartado' from vencidos v where a.id=v.id returning a.id,a.object_path;
end $$;
revoke all on function public.descartar_reservas_vencidas_org(integer) from public,anon,authenticated,service_role;
grant execute on function public.descartar_reservas_vencidas_org(integer) to service_role;

commit;
