-- Etapa 3 aprobada: Tesorería mínima (cuentas en cero, operaciones, apuntes,
-- movimientos de socios, reporte por socio y reversión referenciada).
-- Requiere etapa 2, correcciones de revisión y M6 incremental (20261128130000).
-- Preparación local: no habilitar flujos de socios sin comprobantes verificados.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';
lock table public.espacios, public.espacio_miembros, public.miembro_permisos in share row exclusive mode;

create table public.org_cuentas (
  id uuid primary key default gen_random_uuid(),
  espacio_id uuid not null references public.espacios(id),
  nombre text not null check (length(trim(nombre)) between 1 and 100),
  tipo text not null check (tipo in ('banco','billetera','efectivo','socio')),
  moneda text not null check (moneda in ('PYG','USD','BRL')),
  titular_miembro_id uuid,
  referencia text check (referencia is null or length(trim(referencia)) <= 160),
  activa boolean not null default true,
  created_at timestamptz not null default now(),
  constraint org_cuentas_espacio_id_id_key unique (espacio_id, id),
  constraint org_cuentas_titular_fkey foreign key (espacio_id, titular_miembro_id) references public.espacio_miembros(espacio_id, id),
  constraint org_cuentas_titular_check check ((tipo = 'socio' and titular_miembro_id is not null) or (tipo <> 'socio' and titular_miembro_id is null)),
  constraint org_cuentas_nombre_moneda_key unique (espacio_id, nombre, moneda)
);
create index org_cuentas_espacio_idx on public.org_cuentas(espacio_id, activa);
create index org_cuentas_titular_idx on public.org_cuentas(espacio_id, titular_miembro_id) where titular_miembro_id is not null;

create table public.org_operaciones (
  id uuid primary key default gen_random_uuid(),
  espacio_id uuid not null references public.espacios(id),
  tipo text not null check (tipo in ('pago','cobro','transferencia','financiacion_socio','reembolso_socio','retiro_socio','ajuste','reversion')),
  fecha_efectiva date not null,
  registrado_por uuid not null references public.perfiles(id),
  idempotencia uuid not null,
  solicitud_hash text not null check (solicitud_hash ~ '^[0-9a-f]{64}$'),
  reversa_de uuid,
  motivo text check (motivo is null or length(trim(motivo)) <= 300),
  comprobante_id uuid,
  created_at timestamptz not null default now(),
  constraint org_operaciones_espacio_id_id_key unique (espacio_id, id),
  constraint org_operaciones_espacio_idempotencia_key unique (espacio_id, idempotencia),
  constraint org_operaciones_reversa_de_key unique (reversa_de),
  constraint org_operaciones_comprobante_id_key unique (comprobante_id),
  constraint org_operaciones_reversa_fkey foreign key (espacio_id, reversa_de) references public.org_operaciones(espacio_id, id),
  constraint org_operaciones_reversion_check check ((tipo = 'reversion' and reversa_de is not null and nullif(trim(motivo),'') is not null) or (tipo <> 'reversion' and reversa_de is null))
);
create index org_operaciones_espacio_fecha_idx on public.org_operaciones(espacio_id, fecha_efectiva desc, created_at desc);

-- Se llama con el lock de espacios tomado: serializa reintentos concurrentes.
-- Una clave no confirma otra solicitud ni revela la operación de otro actor.
create or replace function public.reintento_operacion_org(p_espacio uuid, p_clave uuid, p_hash text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_op public.org_operaciones%rowtype;
begin
  select * into v_op from public.org_operaciones
    where espacio_id = p_espacio and idempotencia = p_clave;
  if not found then return null; end if;
  if v_op.registrado_por is distinct from auth.uid() or v_op.solicitud_hash is distinct from p_hash then
    raise exception 'La clave de idempotencia ya pertenece a otra solicitud' using errcode = '22023';
  end if;
  return v_op.id;
end $$;
revoke all on function public.reintento_operacion_org(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.reintento_operacion_org(uuid,uuid,text) to service_role;

create table public.org_apuntes (
  id uuid primary key default gen_random_uuid(),
  espacio_id uuid not null references public.espacios(id),
  operacion_id uuid not null,
  cuenta_id uuid not null,
  importe_firmado numeric(20,6) not null check (importe_firmado <> 0),
  tasa_base numeric(20,10) not null check (tasa_base > 0),
  importe_base_firmado numeric(20,6) not null check (importe_base_firmado <> 0 and (importe_firmado > 0) = (importe_base_firmado > 0)),
  fuente_tasa text not null check (length(trim(fuente_tasa)) between 1 and 80),
  fecha_tasa timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint org_apuntes_operacion_fkey foreign key (espacio_id, operacion_id) references public.org_operaciones(espacio_id, id),
  constraint org_apuntes_cuenta_fkey foreign key (espacio_id, cuenta_id) references public.org_cuentas(espacio_id, id)
);
create index org_apuntes_espacio_cuenta_idx on public.org_apuntes(espacio_id, cuenta_id, created_at desc);
create index org_apuntes_espacio_operacion_idx on public.org_apuntes(espacio_id, operacion_id);

create table public.org_movimientos_socios (
  id uuid primary key default gen_random_uuid(),
  espacio_id uuid not null references public.espacios(id),
  operacion_id uuid not null,
  miembro_id uuid not null,
  clase text not null check (clase in ('prestamo','reembolso','retiro','devolucion','ajuste')),
  moneda text not null check (moneda in ('PYG','USD','BRL')),
  importe_deuda_firmado numeric(20,6) not null check (importe_deuda_firmado <> 0),
  tasa_base numeric(20,10) not null check (tasa_base > 0),
  importe_base_firmado numeric(20,6) not null check (importe_base_firmado <> 0 and (importe_deuda_firmado > 0) = (importe_base_firmado > 0)),
  created_at timestamptz not null default now(),
  constraint org_movimientos_socios_operacion_fkey foreign key (espacio_id, operacion_id) references public.org_operaciones(espacio_id, id),
  constraint org_movimientos_socios_miembro_fkey foreign key (espacio_id, miembro_id) references public.espacio_miembros(espacio_id, id)
);
create index org_movimientos_socios_espacio_miembro_idx on public.org_movimientos_socios(espacio_id, miembro_id, created_at desc);
create index org_movimientos_socios_espacio_operacion_idx on public.org_movimientos_socios(espacio_id, operacion_id);

-- Ningún registro contabilizado se edita ni se borra, ni siquiera con privilegios elevados.
create or replace function public.proteger_inmutabilidad_libro_org()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  raise exception 'Los registros contabilizados son inmutables; usá reversión referenciada' using errcode = '23514';
end $$;

create trigger tr_inmutable_org_operaciones before update or delete on public.org_operaciones
  for each row execute function public.proteger_inmutabilidad_libro_org();
create trigger tr_inmutable_org_apuntes before update or delete on public.org_apuntes
  for each row execute function public.proteger_inmutabilidad_libro_org();
create trigger tr_inmutable_org_movimientos_socios before update or delete on public.org_movimientos_socios
  for each row execute function public.proteger_inmutabilidad_libro_org();

create or replace function public.proteger_cuenta_org()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Las cuentas no se eliminan; podés desactivarlas' using errcode = '23514';
  end if;
  if new.espacio_id is distinct from old.espacio_id or new.moneda is distinct from old.moneda
     or new.tipo is distinct from old.tipo or new.titular_miembro_id is distinct from old.titular_miembro_id then
    raise exception 'La moneda, tipo y titular de una cuenta son inmutables' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger tr_proteger_cuenta_org before update or delete on public.org_cuentas
  for each row execute function public.proteger_cuenta_org();

create or replace function public.proteger_moneda_base_org()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.tipo = 'organizacion' and new.moneda_principal is distinct from old.moneda_principal
     and exists (select 1 from public.org_apuntes where espacio_id = old.id) then
    raise exception 'La moneda base es inmutable después del primer asiento' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger tr_proteger_moneda_base_org before update of moneda_principal on public.espacios
  for each row execute function public.proteger_moneda_base_org();

-- Validación de precisión y tasa contra la moneda base PYG (nunca usar 1 como fallback en USD/BRL).
create or replace function public.validar_importe_tasa_org(
  p_moneda text, p_importe numeric, p_tasa numeric, p_fuente text
) returns void language plpgsql immutable security definer set search_path = '' as $$
begin
  if p_moneda is null or p_moneda not in ('PYG','USD','BRL') then
    raise exception 'Moneda inválida: %', p_moneda using errcode = '22023';
  end if;
  if p_importe is null or p_importe::text in ('NaN','Infinity','-Infinity') or p_importe <= 0 then
    raise exception 'El importe debe ser mayor a cero' using errcode = '22023';
  end if;
  if p_moneda = 'PYG' and p_importe <> trunc(p_importe, 0) then
    raise exception 'Los importes en PYG no admiten decimales' using errcode = '22023';
  end if;
  if p_moneda in ('USD','BRL') and p_importe <> trunc(p_importe, 2) then
    raise exception 'Los importes en % admiten hasta 2 decimales', p_moneda using errcode = '22023';
  end if;
  if p_tasa is null or p_tasa::text in ('NaN','Infinity','-Infinity') or p_tasa <= 0 or p_tasa <> trunc(p_tasa,10) then
    raise exception 'La tasa de cambio es obligatoria y debe ser mayor a cero' using errcode = '22023';
  end if;
  if p_moneda = 'PYG' and p_tasa <> 1 then
    raise exception 'La tasa para la moneda base PYG debe ser exactamente 1' using errcode = '22023';
  end if;
  if p_moneda in ('USD','BRL') and p_tasa <= 1 then
    raise exception 'Confirmá una tasa manual real en PYG por 1 % (prohibido usar 1 como fallback)', p_moneda using errcode = '22023';
  end if;
  if nullif(trim(p_fuente),'') is null or length(trim(p_fuente)) > 80 then
    raise exception 'Indicá la fuente de la tasa' using errcode = '22023';
  end if;
end $$;

-- Vistas calculadas con permisos del invocador (security_invoker = true).
create or replace view public.org_saldos_cuentas
with (security_invoker = true) as
select
  c.id,
  c.espacio_id,
  c.nombre,
  c.tipo,
  c.moneda,
  c.titular_miembro_id,
  p.nombre as titular_nombre,
  c.referencia,
  c.activa,
  c.created_at,
  coalesce(sum(a.importe_firmado), 0)::numeric(20,6) as saldo,
  coalesce(sum(a.importe_base_firmado), 0)::numeric(20,6) as saldo_base_historico,
  count(a.id)::integer as cantidad_movimientos
from public.org_cuentas c
left join public.espacio_miembros m on m.espacio_id = c.espacio_id and m.id = c.titular_miembro_id
left join public.perfiles p on p.id = m.usuario_id
left join public.org_apuntes a on a.espacio_id = c.espacio_id and a.cuenta_id = c.id
where c.espacio_id = public.mi_espacio_id()
  and public.tiene_permiso(c.espacio_id, 'finanzas', 'ver')
  and public.tiene_permiso(c.espacio_id, 'cuentas', 'ver')
group by c.id, p.nombre;

-- Reporte por socio con tres columnas separadas: custodia, empresa le debe y socio debe a empresa.
-- Parte de cero y nunca compensa custodia contra deuda silenciosamente.
create or replace view public.org_reporte_socios
with (security_invoker = true) as
with monedas as (
  select unnest(array['PYG','USD','BRL']::text[]) as moneda
),
custodia as (
  select c.espacio_id, c.titular_miembro_id as miembro_id, c.moneda,
    coalesce(sum(a.importe_firmado), 0)::numeric(20,6) as custodia,
    coalesce(sum(a.importe_base_firmado), 0)::numeric(20,6) as custodia_base
  from public.org_cuentas c
  left join public.org_apuntes a on a.espacio_id = c.espacio_id and a.cuenta_id = c.id
  where c.tipo = 'socio' and c.titular_miembro_id is not null
  group by c.espacio_id, c.titular_miembro_id, c.moneda
),
deuda as (
  select ms.espacio_id, ms.miembro_id, ms.moneda,
    coalesce(sum(ms.importe_deuda_firmado), 0)::numeric(20,6) as neto,
    coalesce(sum(ms.importe_base_firmado), 0)::numeric(20,6) as neto_base,
    count(ms.id)::integer as movimientos_deuda
  from public.org_movimientos_socios ms
  group by ms.espacio_id, ms.miembro_id, ms.moneda
)
select
  m.espacio_id,
  m.id as miembro_id,
  m.usuario_id,
  p.nombre as socio_nombre,
  m.rol_plantilla,
  m.activo,
  mo.moneda,
  coalesce(cu.custodia, 0)::numeric(20,6) as custodia,
  coalesce(cu.custodia_base, 0)::numeric(20,6) as custodia_base,
  greatest(coalesce(de.neto, 0), 0)::numeric(20,6) as empresa_debe_al_socio,
  greatest(coalesce(de.neto_base, 0), 0)::numeric(20,6) as empresa_debe_al_socio_base,
  greatest(-coalesce(de.neto, 0), 0)::numeric(20,6) as socio_debe_a_empresa,
  greatest(-coalesce(de.neto_base, 0), 0)::numeric(20,6) as socio_debe_a_empresa_base,
  coalesce(de.movimientos_deuda, 0)::integer as movimientos_deuda
from public.espacio_miembros m
join public.perfiles p on p.id = m.usuario_id
cross join monedas mo
left join custodia cu on cu.espacio_id = m.espacio_id and cu.miembro_id = m.id and cu.moneda = mo.moneda
left join deuda de on de.espacio_id = m.espacio_id and de.miembro_id = m.id and de.moneda = mo.moneda
where m.espacio_id = public.mi_espacio_id()
  and public.tiene_permiso(m.espacio_id, 'finanzas', 'ver')
  and public.tiene_permiso(m.espacio_id, 'socios', 'ver')
  and (
    mo.moneda = 'PYG'
    or coalesce(cu.custodia, 0) <> 0
    or coalesce(de.neto, 0) <> 0
    or exists (
      select 1 from public.org_cuentas c2
      where c2.espacio_id = m.espacio_id and c2.titular_miembro_id = m.id and c2.moneda = mo.moneda
    )
  );

-- Crear cuenta siempre en cero (sin saldo inicial ni operación de apertura).
create or replace function public.crear_cuenta_org(
  p_espacio_id_esperado uuid,
  p_nombre text,
  p_tipo text,
  p_moneda text default 'PYG',
  p_titular_miembro_id uuid default null,
  p_referencia text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  perform public.validar_contexto(p_espacio_id_esperado);
  perform 1 from public.espacios where id = p_espacio_id_esperado and tipo = 'organizacion' for update;
  if not found or not public.tiene_permiso(p_espacio_id_esperado, 'cuentas', 'crear') then
    raise exception 'No tenés permiso para crear cuentas' using errcode = '42501';
  end if;
  if nullif(trim(p_nombre),'') is null or length(trim(p_nombre)) > 100 then
    raise exception 'Ingresá un nombre de cuenta de hasta 100 caracteres' using errcode = '22023';
  end if;
  if p_tipo not in ('banco','billetera','efectivo','socio') then
    raise exception 'Tipo de cuenta inválido' using errcode = '22023';
  end if;
  if p_moneda is null or p_moneda not in ('PYG','USD','BRL') then
    raise exception 'Moneda inválida' using errcode = '22023';
  end if;
  if p_tipo = 'socio' then
    if p_titular_miembro_id is null or not exists (
      select 1 from public.espacio_miembros
      where espacio_id = p_espacio_id_esperado and id = p_titular_miembro_id and activo
    ) then
      raise exception 'Seleccioná un socio activo como titular de la cuenta' using errcode = '22023';
    end if;
  elsif p_titular_miembro_id is not null then
    raise exception 'Solo las cuentas de custodia de socio llevan titular' using errcode = '22023';
  end if;
  insert into public.org_cuentas(espacio_id, nombre, tipo, moneda, titular_miembro_id, referencia)
    values(p_espacio_id_esperado, trim(p_nombre), p_tipo, p_moneda, p_titular_miembro_id, nullif(trim(p_referencia),''))
    returning id into v_id;
  insert into public.org_auditoria(espacio_id, actor_id, entidad, entidad_id, accion, cambios)
    values(p_espacio_id_esperado, auth.uid(), 'cuentas', v_id, 'crear',
      jsonb_build_object('nombre', trim(p_nombre), 'tipo', p_tipo, 'moneda', p_moneda, 'titular_miembro_id', p_titular_miembro_id));
  return v_id;
end $$;

create or replace function public.actualizar_cuenta_org(
  p_espacio_id_esperado uuid,
  p_cuenta_id uuid,
  p_nombre text default null,
  p_referencia text default null,
  p_activa boolean default null
) returns void language plpgsql security definer set search_path = '' as $$
declare v_c public.org_cuentas%rowtype;
begin
  perform public.validar_contexto(p_espacio_id_esperado);
  perform 1 from public.espacios where id = p_espacio_id_esperado and tipo = 'organizacion' for update;
  if not found or not (
    public.tiene_permiso(p_espacio_id_esperado, 'cuentas', 'editar')
    or public.tiene_permiso(p_espacio_id_esperado, 'cuentas', 'configurar')
  ) then
    raise exception 'No tenés permiso para editar cuentas' using errcode = '42501';
  end if;
  select * into v_c from public.org_cuentas where id = p_cuenta_id and espacio_id = p_espacio_id_esperado for update;
  if not found then raise exception 'Cuenta inexistente en esta organización' using errcode = '22023'; end if;
  if p_nombre is not null and (nullif(trim(p_nombre),'') is null or length(trim(p_nombre)) > 100) then
    raise exception 'Nombre de cuenta inválido' using errcode = '22023';
  end if;
  update public.org_cuentas
    set nombre = coalesce(nullif(trim(p_nombre),''), nombre),
        referencia = case when p_referencia is null then referencia else nullif(trim(p_referencia),'') end,
        activa = coalesce(p_activa, activa)
    where id = p_cuenta_id and espacio_id = p_espacio_id_esperado;
  insert into public.org_auditoria(espacio_id, actor_id, entidad, entidad_id, accion, cambios)
    values(p_espacio_id_esperado, auth.uid(), 'cuentas', p_cuenta_id, 'actualizar',
      jsonb_build_object('nombre', coalesce(nullif(trim(p_nombre),''), v_c.nombre), 'activa', coalesce(p_activa, v_c.activa)));
end $$;

-- Transferencia entre cuentas de misma moneda o cambio PYG/USD/BRL con tasa manual confirmada.
-- Requiere cuentas.pagar (salida) y cuentas.cobrar (entrada).
create or replace function public.transferir_org(
  p_espacio_id_esperado uuid,
  p_idempotencia uuid,
  p_cuenta_origen_id uuid,
  p_cuenta_destino_id uuid,
  p_importe_origen numeric,
  p_importe_destino numeric default null,
  p_fecha_efectiva date default current_date,
  p_tasa_origen_base numeric default null,
  p_tasa_destino_base numeric default null,
  p_fuente_tasa text default 'manual_confirmada',
  p_motivo text default null,
  p_confirmar_saldo_insuficiente boolean default false
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_op_id uuid;
  v_hash text := encode(extensions.digest(jsonb_build_array('transferir_org',p_cuenta_origen_id,p_cuenta_destino_id,p_importe_origen,p_importe_destino,coalesce(p_fecha_efectiva,current_date),p_tasa_origen_base,p_tasa_destino_base,trim(p_fuente_tasa),nullif(trim(p_motivo),''),coalesce(p_confirmar_saldo_insuficiente,false))::text,'sha256'),'hex');
  v_origen public.org_cuentas%rowtype;
  v_destino public.org_cuentas%rowtype;
  v_imp_dest numeric;
  v_tasa_orig numeric;
  v_tasa_dest numeric;
  v_base_orig numeric(20,6);
  v_base_dest numeric(20,6);
  v_saldo_actual numeric(20,6);
begin
  perform public.validar_contexto(p_espacio_id_esperado);
  if p_idempotencia is null then raise exception 'Falta clave de idempotencia' using errcode = '22023'; end if;
  perform 1 from public.espacios where id = p_espacio_id_esperado and tipo = 'organizacion' for update;
  if not found then raise exception 'Organización inválida' using errcode = '42501'; end if;
  if not (
    public.tiene_permiso(p_espacio_id_esperado, 'cuentas', 'pagar')
    and public.tiene_permiso(p_espacio_id_esperado, 'cuentas', 'cobrar')
  ) then
    raise exception 'Se requieren los permisos cuentas.pagar y cuentas.cobrar para transferir' using errcode = '42501';
  end if;

  v_op_id := public.reintento_operacion_org(p_espacio_id_esperado,p_idempotencia,v_hash);
  if v_op_id is not null then return v_op_id; end if;

  if p_cuenta_origen_id is null or p_cuenta_destino_id is null or p_cuenta_origen_id = p_cuenta_destino_id then
    raise exception 'Elegí dos cuentas distintas para transferir' using errcode = '22023';
  end if;

  -- Orden determinístico de bloqueo de cuentas.
  perform 1 from public.org_cuentas
    where espacio_id = p_espacio_id_esperado and id in (p_cuenta_origen_id, p_cuenta_destino_id)
    order by id for update;

  select * into v_origen from public.org_cuentas where espacio_id = p_espacio_id_esperado and id = p_cuenta_origen_id;
  select * into v_destino from public.org_cuentas where espacio_id = p_espacio_id_esperado and id = p_cuenta_destino_id;
  if v_origen.id is null or v_destino.id is null then
    raise exception 'Las cuentas deben pertenecer a la organización activa' using errcode = '23514';
  end if;
  if not v_origen.activa or not v_destino.activa then
    raise exception 'Ambas cuentas deben estar activas para transferir' using errcode = '22023';
  end if;

  v_tasa_orig := case when v_origen.moneda = 'PYG' then coalesce(p_tasa_origen_base, 1) else p_tasa_origen_base end;
  perform public.validar_importe_tasa_org(v_origen.moneda, p_importe_origen, v_tasa_orig, p_fuente_tasa);

  if v_origen.moneda = v_destino.moneda then
    v_imp_dest := coalesce(p_importe_destino, p_importe_origen);
    if v_imp_dest <> p_importe_origen then
      raise exception 'En transferencias de la misma moneda el importe de salida y entrada deben coincidir' using errcode = '22023';
    end if;
    v_tasa_dest := v_tasa_orig;
  else
    if p_importe_destino is null then
      raise exception 'En cambios de moneda debés indicar el importe acreditado en la cuenta destino' using errcode = '22023';
    end if;
    v_imp_dest := p_importe_destino;
    if v_destino.moneda = 'PYG' then
      v_tasa_dest := coalesce(p_tasa_destino_base, 1);
    elsif v_origen.moneda = 'PYG' and p_tasa_destino_base is null then
      raise exception 'Confirmá la tasa manual en PYG por 1 %', v_destino.moneda using errcode = '22023';
    else
      v_tasa_dest := p_tasa_destino_base;
    end if;
    perform public.validar_importe_tasa_org(v_destino.moneda, v_imp_dest, v_tasa_dest, p_fuente_tasa);
  end if;

  select coalesce(sum(importe_firmado), 0) into v_saldo_actual
    from public.org_apuntes where espacio_id = p_espacio_id_esperado and cuenta_id = v_origen.id;
  if v_saldo_actual < p_importe_origen then
    if not coalesce(p_confirmar_saldo_insuficiente, false) or nullif(trim(p_motivo),'') is null then
      raise exception 'Saldo insuficiente en % (disponible: %). Confirmá la excepción e indicá el motivo', v_origen.nombre, v_saldo_actual using errcode = '22023';
    end if;
  end if;

  v_base_orig := round(p_importe_origen * v_tasa_orig, 6);
  v_base_dest := round(v_imp_dest * v_tasa_dest, 6);

  insert into public.org_operaciones(espacio_id, tipo, fecha_efectiva, registrado_por, idempotencia, solicitud_hash, motivo)
    values(p_espacio_id_esperado, 'transferencia', coalesce(p_fecha_efectiva, current_date), auth.uid(), p_idempotencia, v_hash, nullif(trim(p_motivo),''))
    returning id into v_op_id;

  insert into public.org_apuntes(espacio_id, operacion_id, cuenta_id, importe_firmado, tasa_base, importe_base_firmado, fuente_tasa)
    values
      (p_espacio_id_esperado, v_op_id, v_origen.id, -p_importe_origen, v_tasa_orig, -v_base_orig, trim(p_fuente_tasa)),
      (p_espacio_id_esperado, v_op_id, v_destino.id, v_imp_dest, v_tasa_dest, v_base_dest, trim(p_fuente_tasa));

  insert into public.org_auditoria(espacio_id, actor_id, entidad, entidad_id, accion, cambios)
    values(p_espacio_id_esperado, auth.uid(), 'operaciones', v_op_id, 'transferir',
      jsonb_build_object(
        'cuenta_origen_id', v_origen.id, 'moneda_origen', v_origen.moneda, 'importe_origen', p_importe_origen, 'tasa_origen', v_tasa_orig,
        'cuenta_destino_id', v_destino.id, 'moneda_destino', v_destino.moneda, 'importe_destino', v_imp_dest, 'tasa_destino', v_tasa_dest,
        'diferencia_valoracion_base', (v_base_dest - v_base_orig)
      ));
  return v_op_id;
end $$;

-- Pago personal de un socio: registra financiación (+importe en cuenta de socio y +importe de deuda a favor del socio)
-- y la salida del gasto (−importe en cuenta de socio) bajo una sola operación atómica.
-- Quien tenga gastos.pagar puede registrar su propio pago personal; para otro socio se requiere además socios.crear o socios.pagar.
create or replace function public.registrar_pago_personal_socio_org(
  p_espacio_id_esperado uuid,
  p_idempotencia uuid,
  p_miembro_id uuid,
  p_cuenta_socio_id uuid,
  p_importe numeric,
  p_tasa_base numeric default null,
  p_fuente_tasa text default 'manual_confirmada',
  p_fecha_efectiva date default current_date,
  p_motivo text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_op_id uuid;
  v_hash text := encode(extensions.digest(jsonb_build_array('registrar_pago_personal_socio_org',p_miembro_id,p_cuenta_socio_id,p_importe,p_tasa_base,trim(p_fuente_tasa),coalesce(p_fecha_efectiva,current_date),trim(p_motivo))::text,'sha256'),'hex');
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

  v_op_id := public.reintento_operacion_org(p_espacio_id_esperado,p_idempotencia,v_hash);
  if v_op_id is not null then return v_op_id; end if;

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

  insert into public.org_operaciones(espacio_id, tipo, fecha_efectiva, registrado_por, idempotencia, solicitud_hash, motivo)
    values(p_espacio_id_esperado, 'financiacion_socio', coalesce(p_fecha_efectiva, current_date), auth.uid(), p_idempotencia, v_hash, trim(p_motivo))
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

-- Reembolso de la empresa al socio o retiro personal del socio desde una cuenta empresarial.
-- Reembolso: reduce caja empresarial (−importe) y reduce lo que la empresa debe al socio (−importe en deuda), sin repetir gasto.
-- Retiro: reduce caja empresarial (−importe) y aumenta lo que el socio debe a la empresa (−importe en deuda), sin clasificarlo como gasto operativo.
create or replace function public.registrar_movimiento_socio_org(
  p_espacio_id_esperado uuid,
  p_idempotencia uuid,
  p_tipo text,
  p_miembro_id uuid,
  p_cuenta_id uuid,
  p_importe numeric,
  p_tasa_base numeric default null,
  p_fuente_tasa text default 'manual_confirmada',
  p_fecha_efectiva date default current_date,
  p_motivo text default null,
  p_confirmar_saldo_insuficiente boolean default false
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_op_id uuid;
  v_hash text := encode(extensions.digest(jsonb_build_array('registrar_movimiento_socio_org',p_tipo,p_miembro_id,p_cuenta_id,p_importe,p_tasa_base,trim(p_fuente_tasa),coalesce(p_fecha_efectiva,current_date),trim(p_motivo),coalesce(p_confirmar_saldo_insuficiente,false))::text,'sha256'),'hex');
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

  v_op_id := public.reintento_operacion_org(p_espacio_id_esperado,p_idempotencia,v_hash);
  if v_op_id is not null then return v_op_id; end if;

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

  insert into public.org_operaciones(espacio_id, tipo, fecha_efectiva, registrado_por, idempotencia, solicitud_hash, motivo)
    values(p_espacio_id_esperado, p_tipo, coalesce(p_fecha_efectiva, current_date), auth.uid(), p_idempotencia, v_hash, trim(p_motivo))
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

-- Reversión referenciada: ningún asiento se edita ni se borra; invierte apuntes y movimientos de socio con las mismas tasas históricas.
create or replace function public.revertir_org(
  p_espacio_id_esperado uuid,
  p_idempotencia uuid,
  p_operacion_id uuid,
  p_motivo text,
  p_fecha_efectiva date default current_date
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_op_id uuid;
  v_hash text := encode(extensions.digest(jsonb_build_array('revertir_org',p_operacion_id,trim(p_motivo),coalesce(p_fecha_efectiva,current_date))::text,'sha256'),'hex');
  v_orig public.org_operaciones%rowtype;
begin
  perform public.validar_contexto(p_espacio_id_esperado);
  if p_idempotencia is null then raise exception 'Falta clave de idempotencia' using errcode = '22023'; end if;
  perform 1 from public.espacios where id = p_espacio_id_esperado and tipo = 'organizacion' for update;
  if not found then raise exception 'Organización inválida' using errcode = '42501'; end if;
  if nullif(trim(p_motivo),'') is null then
    raise exception 'El motivo es obligatorio para revertir una operación' using errcode = '22023';
  end if;

  select * into v_orig from public.org_operaciones
    where espacio_id = p_espacio_id_esperado and id = p_operacion_id for update;
  if not found then
    raise exception 'Operación inexistente en esta organización' using errcode = '23514';
  end if;
  if v_orig.tipo = 'reversion' then
    raise exception 'No se puede revertir una reversión' using errcode = '22023';
  end if;


  if not public.tiene_permiso(p_espacio_id_esperado,
    case v_orig.tipo when 'transferencia' then 'cuentas'
      when 'financiacion_socio' then 'gastos'
      when 'reembolso_socio' then 'socios'
      when 'retiro_socio' then 'socios' else '' end, 'anular') then
    raise exception 'No tenés permiso para revertir esta operación' using errcode = '42501';
  end if;

  v_op_id := public.reintento_operacion_org(p_espacio_id_esperado,p_idempotencia,v_hash);
  if v_op_id is not null then return v_op_id; end if;

  if exists (select 1 from public.org_operaciones where espacio_id = p_espacio_id_esperado and reversa_de = v_orig.id) then
    raise exception 'Esta operación ya fue revertida' using errcode = '23505';
  end if;

  insert into public.org_operaciones(espacio_id, tipo, fecha_efectiva, registrado_por, idempotencia, solicitud_hash, reversa_de, motivo)
    values(p_espacio_id_esperado, 'reversion', coalesce(p_fecha_efectiva, current_date), auth.uid(), p_idempotencia, v_hash, v_orig.id, trim(p_motivo))
    returning id into v_op_id;

  insert into public.org_apuntes(espacio_id, operacion_id, cuenta_id, importe_firmado, tasa_base, importe_base_firmado, fuente_tasa, fecha_tasa)
  select espacio_id, v_op_id, cuenta_id, -importe_firmado, tasa_base, -importe_base_firmado, fuente_tasa, fecha_tasa
  from public.org_apuntes
  where espacio_id = p_espacio_id_esperado and operacion_id = v_orig.id;

  insert into public.org_movimientos_socios(espacio_id, operacion_id, miembro_id, clase, moneda, importe_deuda_firmado, tasa_base, importe_base_firmado)
  select espacio_id, v_op_id, miembro_id, clase, moneda, -importe_deuda_firmado, tasa_base, -importe_base_firmado
  from public.org_movimientos_socios
  where espacio_id = p_espacio_id_esperado and operacion_id = v_orig.id;

  insert into public.org_auditoria(espacio_id, actor_id, entidad, entidad_id, accion, cambios)
    values(p_espacio_id_esperado, auth.uid(), 'operaciones', v_op_id, 'revertir',
      jsonb_build_object('reversa_de', v_orig.id, 'tipo_original', v_orig.tipo, 'motivo', trim(p_motivo)));
  return v_op_id;
end $$;

-- RLS y permisos de tablas de tesorería: solo SELECT con permiso efectivo; escrituras solo por RPC.
do $$ declare t text; begin
  foreach t in array array['org_cuentas','org_operaciones','org_apuntes','org_movimientos_socios'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('grant select on public.%I to authenticated', t);
    execute format('create policy "Sesión vigente %s" on public.%I as restrictive for all to authenticated using (public.sesion_auth_id() is not null) with check (public.sesion_auth_id() is not null)', t, t);
  end loop;
end $$;

create policy "Ver cuentas org" on public.org_cuentas for select to authenticated
  using (espacio_id = public.mi_espacio_id() and public.tiene_permiso(espacio_id, 'finanzas', 'ver') and public.tiene_permiso(espacio_id, 'cuentas', 'ver'));
create policy "Ver operaciones org" on public.org_operaciones for select to authenticated
  using (espacio_id = public.mi_espacio_id() and public.tiene_permiso(espacio_id, 'finanzas', 'ver') and (
    public.tiene_permiso(espacio_id, 'cuentas', 'ver') or public.tiene_permiso(espacio_id, 'socios', 'ver')
  ));
create policy "Ver apuntes org" on public.org_apuntes for select to authenticated
  using (espacio_id = public.mi_espacio_id() and public.tiene_permiso(espacio_id, 'finanzas', 'ver') and public.tiene_permiso(espacio_id, 'cuentas', 'ver'));
create policy "Ver movimientos socios org" on public.org_movimientos_socios for select to authenticated
  using (espacio_id = public.mi_espacio_id() and public.tiene_permiso(espacio_id, 'finanzas', 'ver') and public.tiene_permiso(espacio_id, 'socios', 'ver'));

revoke all on table public.org_saldos_cuentas, public.org_reporte_socios from public, anon, authenticated, service_role;
grant select on table public.org_saldos_cuentas, public.org_reporte_socios to authenticated, service_role;

revoke all on function
  public.proteger_inmutabilidad_libro_org(),
  public.proteger_cuenta_org(),
  public.proteger_moneda_base_org(),
  public.validar_importe_tasa_org(text,numeric,numeric,text),
  public.crear_cuenta_org(uuid,text,text,text,uuid,text),
  public.actualizar_cuenta_org(uuid,uuid,text,text,boolean),
  public.transferir_org(uuid,uuid,uuid,uuid,numeric,numeric,date,numeric,numeric,text,text,boolean),
  public.registrar_pago_personal_socio_org(uuid,uuid,uuid,uuid,numeric,numeric,text,date,text),
  public.registrar_movimiento_socio_org(uuid,uuid,text,uuid,uuid,numeric,numeric,text,date,text,boolean),
  public.revertir_org(uuid,uuid,uuid,text,date)
from public, anon, authenticated;

grant execute on function
  public.proteger_inmutabilidad_libro_org(),
  public.proteger_cuenta_org(),
  public.proteger_moneda_base_org(),
  public.validar_importe_tasa_org(text,numeric,numeric,text),
  public.crear_cuenta_org(uuid,text,text,text,uuid,text),
  public.actualizar_cuenta_org(uuid,uuid,text,text,boolean),
  public.transferir_org(uuid,uuid,uuid,uuid,numeric,numeric,date,numeric,numeric,text,text,boolean),
  public.registrar_pago_personal_socio_org(uuid,uuid,uuid,uuid,numeric,numeric,text,date,text),
  public.registrar_movimiento_socio_org(uuid,uuid,text,uuid,uuid,numeric,numeric,text,date,text,boolean),
  public.revertir_org(uuid,uuid,uuid,text,date)
to service_role;

grant execute on function
  public.crear_cuenta_org(uuid,text,text,text,uuid,text),
  public.actualizar_cuenta_org(uuid,uuid,text,text,boolean),
  public.transferir_org(uuid,uuid,uuid,uuid,numeric,numeric,date,numeric,numeric,text,text,boolean),
  public.registrar_pago_personal_socio_org(uuid,uuid,uuid,uuid,numeric,numeric,text,date,text),
  public.registrar_movimiento_socio_org(uuid,uuid,text,uuid,uuid,numeric,numeric,text,date,text,boolean),
  public.revertir_org(uuid,uuid,uuid,text,date)
to authenticated;
commit;
