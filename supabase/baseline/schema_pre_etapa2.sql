-- ÑandeFinanza · esquema de referencia después de etapa 1 (NO aplicado a prod).
-- Baseline vivo 2026-11-27: baseline/catalogo_vivo_2026-11-27.md.
-- Public: 13 tablas, 168 columnas, 52 constraints, 14 índices PK/UNIQUE,
-- 9 funciones, 2 triggers, 21 políticas; coincide con la P0 aplicada.
-- Storage: sin buckets ni políticas propias; triggers internos administrados
-- por Supabase (no se reproducen aquí). Sin tablas en publicaciones.
-- El historial de migraciones YA existe; verificar sus versiones antes de usar CLI.
-- Este archivo documenta el resultado; no ejecutar sobre producción.

CREATE TABLE public.espacios (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nombre_familia text NOT NULL,
  moneda_principal text DEFAULT 'PYG'::text,
  tokens_ia_disponibles integer DEFAULT 10000,
  codigo_invitacion text,
  created_at timestamp with time zone DEFAULT now(),
  limite_usuarios integer DEFAULT 2,
  tipo text NOT NULL DEFAULT 'hogar',
  CONSTRAINT espacios_tipo_check CHECK (tipo IN ('hogar', 'organizacion')),
  CONSTRAINT espacios_codigo_invitacion_key UNIQUE (codigo_invitacion),
  CONSTRAINT espacios_pkey PRIMARY KEY (id)
);

CREATE TABLE public.perfiles (
  id uuid NOT NULL,
  espacio_id uuid,
  nombre text NOT NULL,
  rol text DEFAULT 'miembro'::text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT perfiles_pkey PRIMARY KEY (id),
  CONSTRAINT perfiles_espacio_id_fkey FOREIGN KEY (espacio_id) REFERENCES espacios(id) ON DELETE CASCADE,
  CONSTRAINT perfiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT perfiles_rol_check CHECK ((rol = ANY (ARRAY['superadmin'::text, 'admin_hogar'::text, 'miembro'::text])))
);

CREATE TABLE public.gastos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  espacio_id uuid,
  usuario_id uuid,
  pagador_id uuid,
  monto numeric NOT NULL,
  moneda text NOT NULL,
  tasa_cambio numeric DEFAULT 1,
  concepto text NOT NULL,
  categoria text,
  para_quien text DEFAULT 'Ambos'::text,
  porcentaje_pagador integer DEFAULT 100,
  fecha timestamp with time zone DEFAULT now(),
  medio_pago text NOT NULL DEFAULT 'transferencia'::text,
  tipo_cuenta text,
  alias_cuenta text,
  nro_cuenta text,
  nombre_titular text,
  ci_titular text,
  CONSTRAINT gastos_pkey PRIMARY KEY (id),
  CONSTRAINT gastos_espacio_id_fkey FOREIGN KEY (espacio_id) REFERENCES espacios(id) ON DELETE CASCADE,
  CONSTRAINT gastos_pagador_id_fkey FOREIGN KEY (pagador_id) REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT gastos_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT gastos_medio_pago_check CHECK ((medio_pago = ANY (ARRAY['transferencia'::text, 'efectivo'::text]))),
  CONSTRAINT gastos_tipo_cuenta_check CHECK (((tipo_cuenta IS NULL) OR (tipo_cuenta = ANY (ARRAY['alias'::text, 'nro_cuenta'::text]))))
);

CREATE TABLE public.gastos_programados (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  espacio_id uuid NOT NULL,
  usuario_id uuid,
  concepto text NOT NULL,
  monto numeric NOT NULL,
  moneda text NOT NULL DEFAULT 'PYG'::text,
  dia_recurrencia integer NOT NULL DEFAULT 5,
  categoria text NOT NULL DEFAULT 'Casa'::text,
  para_quien text NOT NULL DEFAULT 'Ambos'::text,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  medio_pago text NOT NULL DEFAULT 'transferencia'::text,
  tipo_cuenta text,
  alias_cuenta text,
  nro_cuenta text,
  nombre_titular text,
  ci_titular text,
  CONSTRAINT gastos_programados_pkey PRIMARY KEY (id),
  CONSTRAINT gastos_programados_espacio_id_fkey FOREIGN KEY (espacio_id) REFERENCES espacios(id) ON DELETE CASCADE,
  CONSTRAINT gastos_programados_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES perfiles(id) ON DELETE SET NULL,
  CONSTRAINT gastos_programados_dia_recurrencia_check CHECK (((dia_recurrencia >= 1) AND (dia_recurrencia <= 31))),
  CONSTRAINT gastos_programados_medio_pago_check CHECK ((medio_pago = ANY (ARRAY['transferencia'::text, 'efectivo'::text]))),
  CONSTRAINT gastos_programados_para_quien_check CHECK ((para_quien = ANY (ARRAY['Ambos'::text, 'Yo'::text, 'Pareja'::text]))),
  CONSTRAINT gastos_programados_tipo_cuenta_check CHECK (((tipo_cuenta IS NULL) OR (tipo_cuenta = ANY (ARRAY['alias'::text, 'nro_cuenta'::text]))))
);

CREATE TABLE public.ingresos_mensuales (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  espacio_id uuid,
  usuario_id uuid,
  monto numeric NOT NULL,
  moneda text NOT NULL,
  tasa_cambio numeric DEFAULT 1,
  concepto text NOT NULL,
  mes integer,
  anio integer,
  fecha timestamp with time zone DEFAULT now(),
  tipo_ingreso text DEFAULT 'salario_mensual'::text,
  fecha_efectiva date DEFAULT CURRENT_DATE,
  CONSTRAINT ingresos_mensuales_pkey PRIMARY KEY (id),
  CONSTRAINT ingresos_mensuales_espacio_id_fkey FOREIGN KEY (espacio_id) REFERENCES espacios(id) ON DELETE CASCADE,
  CONSTRAINT ingresos_mensuales_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE TABLE public.ingresos_programados (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  espacio_id uuid,
  usuario_id uuid,
  descripcion text NOT NULL,
  monto numeric NOT NULL,
  moneda text DEFAULT 'PYG'::text,
  dia_recurrencia integer NOT NULL,
  categoria text DEFAULT 'Sueldo'::text,
  activo boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  solo_dias_habiles boolean DEFAULT true,
  ajuste_dia_habil text DEFAULT 'anterior'::text,
  monto_descuento numeric DEFAULT 0,
  concepto_descuento text DEFAULT ''::text,
  CONSTRAINT ingresos_programados_pkey PRIMARY KEY (id),
  CONSTRAINT ingresos_programados_espacio_id_fkey FOREIGN KEY (espacio_id) REFERENCES espacios(id) ON DELETE CASCADE,
  CONSTRAINT ingresos_programados_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT ingresos_programados_dia_recurrencia_check CHECK (((dia_recurrencia >= 1) AND (dia_recurrencia <= 31))),
  CONSTRAINT ingresos_programados_moneda_check CHECK ((moneda = ANY (ARRAY['PYG'::text, 'BRL'::text, 'USD'::text])))
);

CREATE TABLE public.historial_salarios (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  espacio_id uuid,
  usuario_id uuid,
  ingreso_programado_id uuid,
  monto_anterior numeric NOT NULL,
  monto_nuevo numeric NOT NULL,
  moneda text NOT NULL,
  motivo text DEFAULT 'Aumento Salarial'::text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT historial_salarios_pkey PRIMARY KEY (id),
  CONSTRAINT historial_salarios_espacio_id_fkey FOREIGN KEY (espacio_id) REFERENCES espacios(id) ON DELETE CASCADE,
  CONSTRAINT historial_salarios_ingreso_programado_id_fkey FOREIGN KEY (ingreso_programado_id) REFERENCES ingresos_programados(id) ON DELETE CASCADE,
  CONSTRAINT historial_salarios_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE TABLE public.deudas_maestras (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  espacio_id uuid,
  creador_id uuid,
  titulo text NOT NULL,
  tipo text,
  permite_pago_parcial boolean DEFAULT false,
  moneda text DEFAULT 'PYG'::text,
  tasa_cambio numeric DEFAULT 1,
  created_at timestamp with time zone DEFAULT now(),
  linea_credito_total numeric DEFAULT 0,
  linea_credito_disponible numeric DEFAULT 0,
  alcance text DEFAULT 'familiar'::text,
  estado text DEFAULT 'activa'::text,
  nro_tarjeta text,
  fecha_cierre_tarjeta integer,
  tasa_interes numeric DEFAULT 0,
  medio_pago text NOT NULL DEFAULT 'transferencia'::text,
  tipo_cuenta text,
  alias_cuenta text,
  nro_cuenta text,
  nombre_titular text,
  ci_titular text,
  CONSTRAINT deudas_maestras_pkey PRIMARY KEY (id),
  CONSTRAINT deudas_maestras_creador_id_fkey FOREIGN KEY (creador_id) REFERENCES auth.users(id),
  CONSTRAINT deudas_maestras_espacio_id_fkey FOREIGN KEY (espacio_id) REFERENCES espacios(id) ON DELETE CASCADE,
  CONSTRAINT deudas_maestras_alcance_check CHECK ((alcance = ANY (ARRAY['individual'::text, 'familiar'::text]))),
  CONSTRAINT deudas_maestras_estado_check CHECK ((estado = ANY (ARRAY['activa'::text, 'cerrada'::text]))),
  CONSTRAINT deudas_maestras_medio_pago_check CHECK ((medio_pago = ANY (ARRAY['transferencia'::text, 'efectivo'::text]))),
  CONSTRAINT deudas_maestras_tipo_check CHECK ((tipo = ANY (ARRAY['fija'::text, 'flexible'::text, 'tarjeta_credito'::text]))),
  CONSTRAINT deudas_maestras_tipo_cuenta_check CHECK (((tipo_cuenta IS NULL) OR (tipo_cuenta = ANY (ARRAY['alias'::text, 'nro_cuenta'::text]))))
);

CREATE TABLE public.cuotas_detalle (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  deuda_maestra_id uuid,
  espacio_id uuid,
  numero_cuota integer,
  monto_cuota numeric NOT NULL,
  monto_abonado numeric DEFAULT 0,
  fecha_vencimiento date,
  estado text DEFAULT 'pendiente'::text,
  fecha_pago timestamp with time zone,
  pagador_id uuid,
  pago_minimo numeric DEFAULT 0,
  cargos numeric DEFAULT 0,
  CONSTRAINT cuotas_detalle_pkey PRIMARY KEY (id),
  CONSTRAINT cuotas_detalle_deuda_maestra_id_fkey FOREIGN KEY (deuda_maestra_id) REFERENCES deudas_maestras(id) ON DELETE CASCADE,
  CONSTRAINT cuotas_detalle_espacio_id_fkey FOREIGN KEY (espacio_id) REFERENCES espacios(id) ON DELETE CASCADE,
  CONSTRAINT cuotas_detalle_pagador_id_fkey FOREIGN KEY (pagador_id) REFERENCES auth.users(id),
  CONSTRAINT cuotas_detalle_estado_check CHECK ((estado = ANY (ARRAY['pendiente'::text, 'pagado'::text])))
);

CREATE TABLE public.notificaciones (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  espacio_id uuid,
  usuario_id uuid,
  titulo text NOT NULL,
  mensaje text NOT NULL,
  tipo text DEFAULT 'info'::text,
  leida boolean DEFAULT false,
  link text,
  created_at timestamp with time zone DEFAULT now(),
  metadata jsonb,
  CONSTRAINT notificaciones_pkey PRIMARY KEY (id),
  CONSTRAINT notificaciones_espacio_id_fkey FOREIGN KEY (espacio_id) REFERENCES espacios(id) ON DELETE CASCADE,
  CONSTRAINT notificaciones_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT notificaciones_tipo_check CHECK ((tipo = ANY (ARRAY['info'::text, 'alerta'::text, 'exito'::text])))
);

-- Tablas heredadas (la app actual no las usa) ---------------------------------

CREATE TABLE public.cuentas_maestras (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  espacio_id uuid,
  creador_id uuid,
  titulo text NOT NULL,
  monto_total numeric(15,2) NOT NULL,
  cantidad_cuotas integer NOT NULL,
  permite_pago_parcial boolean DEFAULT false,
  fecha_creacion timestamp with time zone DEFAULT timezone('utc'::text, now()),
  CONSTRAINT cuentas_maestras_pkey PRIMARY KEY (id)
);

CREATE TABLE public.cuentas_pendientes (
  id bigint NOT NULL,
  descripcion text NOT NULL,
  monto numeric NOT NULL,
  estado text DEFAULT 'Pendiente'::text,
  pagador_id bigint,
  fecha_creacion timestamp with time zone DEFAULT timezone('utc'::text, now()),
  fecha_pagado timestamp with time zone,
  fecha_vencimiento date,
  es_recurrente boolean DEFAULT true,
  dia_vencimiento integer,
  total_cuotas integer,
  cuotas_pagadas integer DEFAULT 0,
  responsable text DEFAULT 'Ambos'::text,
  fecha_ultimo_pago timestamp with time zone,
  pago_solicitado_a bigint,
  moneda text DEFAULT 'PYG'::text,
  espacio_id uuid,
  deuda_padre_id uuid,
  porcentaje_mora numeric DEFAULT 0,
  numero_cuota_actual integer,
  maestra_id uuid,
  monto_pagado_parcial numeric(15,2) DEFAULT 0,
  tasa_cambio numeric DEFAULT 1,
  CONSTRAINT cuentas_pendientes_pkey PRIMARY KEY (id),
  CONSTRAINT cuentas_pendientes_maestra_id_fkey FOREIGN KEY (maestra_id) REFERENCES cuentas_maestras(id) ON DELETE CASCADE
);

CREATE TABLE public.prestamos_personales (
  id bigint NOT NULL,
  deudor_id bigint,
  acreedor_id bigint,
  monto_total numeric NOT NULL,
  monto_pagado numeric DEFAULT 0,
  concepto text,
  estado text DEFAULT 'Pendiente'::text,
  moneda text DEFAULT 'PYG'::text,
  fecha_creacion timestamp with time zone DEFAULT timezone('utc'::text, now()),
  espacio_id uuid,
  tasa_cambio numeric DEFAULT 1,
  CONSTRAINT prestamos_personales_pkey PRIMARY KEY (id)
);


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


-- -----------------------------------------------------------------------------
-- Row Level Security (habilitada en todas las tablas)
-- -----------------------------------------------------------------------------

ALTER TABLE public.cuentas_maestras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cuentas_pendientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cuotas_detalle ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deudas_maestras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.espacios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gastos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gastos_programados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historial_salarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingresos_mensuales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingresos_programados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notificaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prestamos_personales ENABLE ROW LEVEL SECURITY;


-- -----------------------------------------------------------------------------
-- Funciones (versión de la migración P0 20261126120000)
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

-- Heredada: genera cuotas en `cuentas_pendientes`.
CREATE OR REPLACE FUNCTION public.generar_cuotas(p_descripcion text, p_monto_mensual numeric, p_moneda text, p_cantidad_cuotas integer, p_fecha_inicio date, p_porcentaje_mora numeric, p_pagador_id bigint, p_espacio_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_deuda_padre_id uuid;
  i integer;
  v_fecha_vencimiento date;
BEGIN
  -- Generar un ID único para agrupar todas estas cuotas
  v_deuda_padre_id := gen_random_uuid();
  v_fecha_vencimiento := p_fecha_inicio;

  FOR i IN 1..p_cantidad_cuotas LOOP
    INSERT INTO cuentas_pendientes (
      descripcion, monto, moneda, estado, pagador_id,
      fecha_vencimiento, total_cuotas, numero_cuota_actual,
      deuda_padre_id, porcentaje_mora, espacio_id
    ) VALUES (
      p_descripcion || ' (Cuota ' || i || '/' || p_cantidad_cuotas || ')',
      p_monto_mensual,
      p_moneda,
      'Pendiente',
      p_pagador_id,
      v_fecha_vencimiento,
      p_cantidad_cuotas,
      i,
      v_deuda_padre_id,
      p_porcentaje_mora,
      p_espacio_id
    );

    -- Sumar un mes para la próxima cuota
    v_fecha_vencimiento := v_fecha_vencimiento + interval '1 month';
  END LOOP;
END;
$function$;


-- -----------------------------------------------------------------------------
-- Triggers
-- -----------------------------------------------------------------------------

CREATE TRIGGER tr_validar_limite_usuarios BEFORE INSERT OR UPDATE OF espacio_id ON public.perfiles FOR EACH ROW EXECUTE FUNCTION validar_limite_usuarios();
CREATE TRIGGER tr_proteger_perfil BEFORE INSERT OR UPDATE ON public.perfiles FOR EACH ROW EXECUTE FUNCTION proteger_perfil();


-- -----------------------------------------------------------------------------
-- Permisos de ejecución (anon no ejecuta ninguna función)
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
-- Políticas
-- -----------------------------------------------------------------------------

-- espacios: sólo el propio (o superadmin). El alta es por RPC crear_espacio.
CREATE POLICY "Ver mi propio espacio" ON public.espacios AS PERMISSIVE FOR SELECT TO authenticated
  USING ((id = ( SELECT mi_espacio_id())));
CREATE POLICY "Superadmin gestiona todo espacios" ON public.espacios AS PERMISSIVE FOR ALL TO authenticated
  USING (( SELECT es_superadmin()))
  WITH CHECK (( SELECT es_superadmin()));

-- perfiles: espacio_id y rol los protege el trigger tr_proteger_perfil.
CREATE POLICY "Ver perfiles de mi espacio" ON public.perfiles AS PERMISSIVE FOR SELECT TO authenticated
  USING (((id = ( SELECT auth.uid())) OR (espacio_id = ( SELECT mi_espacio_id()))));
CREATE POLICY "Insertar perfil propio" ON public.perfiles AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((id = ( SELECT auth.uid())));
CREATE POLICY "Actualizar perfil propio" ON public.perfiles AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((id = ( SELECT auth.uid())))
  WITH CHECK ((id = ( SELECT auth.uid())));
CREATE POLICY "Borrar perfil propio" ON public.perfiles AS PERMISSIVE FOR DELETE TO authenticated
  USING ((id = ( SELECT auth.uid())));
CREATE POLICY "Superadmin gestiona todo perfiles" ON public.perfiles AS PERMISSIVE FOR ALL TO authenticated
  USING (( SELECT es_superadmin()))
  WITH CHECK (( SELECT es_superadmin()));

-- tablas de datos (incluidas las heredadas)
CREATE POLICY "Gestionar gastos" ON public.gastos AS PERMISSIVE FOR ALL TO authenticated
  USING ((espacio_id = ( SELECT mi_espacio_id())))
  WITH CHECK ((espacio_id = ( SELECT mi_espacio_id())));
CREATE POLICY "Gestionar ingresos" ON public.ingresos_mensuales AS PERMISSIVE FOR ALL TO authenticated
  USING ((espacio_id = ( SELECT mi_espacio_id())))
  WITH CHECK ((espacio_id = ( SELECT mi_espacio_id())));
CREATE POLICY "Gestionar mis notificaciones" ON public.notificaciones AS PERMISSIVE FOR ALL TO authenticated
  USING ((espacio_id = ( SELECT mi_espacio_id())))
  WITH CHECK ((espacio_id = ( SELECT mi_espacio_id())));
CREATE POLICY "Gestionar deudas" ON public.deudas_maestras AS PERMISSIVE FOR ALL TO authenticated
  USING ((espacio_id = ( SELECT mi_espacio_id())))
  WITH CHECK ((espacio_id = ( SELECT mi_espacio_id())));
CREATE POLICY "Gestionar cuotas" ON public.cuotas_detalle AS PERMISSIVE FOR ALL TO authenticated
  USING ((espacio_id = ( SELECT mi_espacio_id())))
  WITH CHECK ((espacio_id = ( SELECT mi_espacio_id())));
CREATE POLICY "Gestionar mis ingresos programados" ON public.ingresos_programados AS PERMISSIVE FOR ALL TO authenticated
  USING ((espacio_id = ( SELECT mi_espacio_id())))
  WITH CHECK ((espacio_id = ( SELECT mi_espacio_id())));
CREATE POLICY "Ver mi historial de salarios" ON public.historial_salarios AS PERMISSIVE FOR ALL TO authenticated
  USING ((espacio_id = ( SELECT mi_espacio_id())))
  WITH CHECK ((espacio_id = ( SELECT mi_espacio_id())));
CREATE POLICY "Cuentas Maestras: Acceso a mi espacio" ON public.cuentas_maestras AS PERMISSIVE FOR ALL TO authenticated
  USING ((espacio_id = ( SELECT mi_espacio_id())))
  WITH CHECK ((espacio_id = ( SELECT mi_espacio_id())));
CREATE POLICY "Cuentas: Acceso a mi espacio" ON public.cuentas_pendientes AS PERMISSIVE FOR ALL TO authenticated
  USING ((espacio_id = ( SELECT mi_espacio_id())))
  WITH CHECK ((espacio_id = ( SELECT mi_espacio_id())));
CREATE POLICY "Prestamos: Acceso a mi espacio" ON public.prestamos_personales AS PERMISSIVE FOR ALL TO authenticated
  USING ((espacio_id = ( SELECT mi_espacio_id())))
  WITH CHECK ((espacio_id = ( SELECT mi_espacio_id())));

-- gastos_programados (los nombres están truncados a 63 caracteres por Postgres)
CREATE POLICY "Permitir actualización de gastos programados a miembros del ho" ON public.gastos_programados AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((espacio_id = mi_espacio_id()))
  WITH CHECK ((espacio_id = mi_espacio_id()));
CREATE POLICY "Permitir eliminación de gastos programados a miembros del hoga" ON public.gastos_programados AS PERMISSIVE FOR DELETE TO authenticated
  USING ((espacio_id = mi_espacio_id()));
CREATE POLICY "Permitir inserción de gastos programados a miembros del hogar" ON public.gastos_programados AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((espacio_id = mi_espacio_id()));
CREATE POLICY "Permitir lectura de gastos programados a miembros del hogar" ON public.gastos_programados AS PERMISSIVE FOR SELECT TO authenticated
  USING ((espacio_id = mi_espacio_id()));

-- Membresías compatibles (etapa 1).
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


revoke execute on function public.sincronizar_membresia_perfil(), public.validar_membresia_compatible() from public, anon, authenticated;

-- ACL heredadas de public: RLS restringe el acceso efectivo.
grant all on public.cuentas_maestras, public.cuentas_pendientes, public.cuotas_detalle,
  public.deudas_maestras, public.espacios, public.gastos, public.gastos_programados,
  public.historial_salarios, public.ingresos_mensuales, public.ingresos_programados,
  public.notificaciones, public.perfiles, public.prestamos_personales
  to anon, authenticated, service_role;
revoke all on public.espacio_miembros from public, anon, authenticated;
grant select on public.espacio_miembros to authenticated;

-- ACL de triggers explícitas, incluso en un esquema local recién creado.
grant execute on function public.proteger_perfil(), public.validar_limite_usuarios(),
  public.sincronizar_membresia_perfil(), public.validar_membresia_compatible() to service_role;
