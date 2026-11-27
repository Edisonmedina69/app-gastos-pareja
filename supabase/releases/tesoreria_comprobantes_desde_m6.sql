-- ENTREGA ATÓMICA desde M6: generada por preparar_tesoreria.py, no editar a mano.
-- Registrar la versión real que devuelva el aplicador; mapear este payload a ambos archivos fuente.
-- No ejecutar las migraciones fuente además de este payload.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';
do $$ begin
  if to_regclass('public.org_cuentas') is not null then
    raise exception 'Esta entrega exige M6 sin tesorería: verificar historial y catálogo';
  end if;
  if to_regprocedure('public.invitacion_vigente(uuid)') is null or not exists(
    select 1 from information_schema.columns where table_schema='public' and table_name='espacio_miembros' and column_name='desactivado_at'
  ) then raise exception 'Faltan correcciones de etapa 2 o M6'; end if;
end $$;

-- Fuente 20261129120000_etapa3_tesoreria_minima.sql; SHA256 bfb2596332d24d5186284cec482428742dd144d603ab0999253f0b60a7e6b849
-- Etapa 3 aprobada: Tesorería mínima (cuentas en cero, operaciones, apuntes,
-- movimientos de socios, reporte por socio y reversión referenciada).
-- Requiere etapa 2, correcciones de revisión y M6 incremental (20261128130000).
-- Preparación local: no habilitar flujos de socios sin comprobantes verificados.
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

-- Fuente 20261129130000_comprobantes_tesoreria.sql; SHA256 f02feff22ccfbf13dab87a81c4e5aa402ea640ccff26aeea4610de440b18e291
-- Complemento incremental de #36. Aplicar después de 20261129120000, en mantenimiento.
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
