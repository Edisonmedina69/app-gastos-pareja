-- ÑandeFinanza · esquema de referencia después de etapa 2 y sus correcciones de revisión (correcciones NO aplicadas a prod).
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
