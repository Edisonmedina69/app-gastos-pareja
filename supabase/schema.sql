-- =============================================================================
-- ÑandeFinanza · Esquema de referencia (schema `public`)
--
-- Generado el 2026-11-26 leyendo el catálogo de la base de producción con
-- consultas de SOLO LECTURA (pg_class, pg_attribute, pg_constraint, pg_proc,
-- pg_trigger, pg_policies, pg_publication_tables).
--
-- Es documentación: NO es una migración y no hace falta ejecutarlo. Sirve para
-- saber qué columnas, restricciones y políticas existen hoy sin leer las 18
-- migraciones históricas.
--
-- Notas de lo observado (no se cambió nada):
--   * No hay índices además de las PK y UNIQUE.
--   * Ninguna tabla figura en la publicación `supabase_realtime`, así que la
--     suscripción `postgres_changes` de la app no recibe eventos.
--   * `cuentas_maestras`, `cuentas_pendientes` y `prestamos_personales` son
--     tablas heredadas que la app ya no usa.
--   * `mis_espacios()` lee `public.usuarios_espacios`, tabla que ya no existe.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Tablas
-- -----------------------------------------------------------------------------

CREATE TABLE public.espacios (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nombre_familia text NOT NULL,
  moneda_principal text DEFAULT 'PYG'::text,
  tokens_ia_disponibles integer DEFAULT 10000,
  codigo_invitacion text,
  created_at timestamp with time zone DEFAULT now(),
  limite_usuarios integer DEFAULT 2,
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
-- Funciones
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.es_superadmin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT COALESCE(
    (SELECT rol = 'superadmin' FROM public.perfiles WHERE id = auth.uid()),
    FALSE
  );
$function$;

CREATE OR REPLACE FUNCTION public.mi_espacio_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
   SELECT espacio_id FROM public.perfiles WHERE id = auth.uid() LIMIT 1;
$function$;

-- Heredada: `usuarios_espacios` ya no existe.
CREATE OR REPLACE FUNCTION public.mis_espacios()
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
      SELECT espacio_id FROM public.usuarios_espacios WHERE usuario_id = auth.uid();
    $function$;

CREATE OR REPLACE FUNCTION public.validar_limite_usuarios()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    limite INTEGER;
    actual INTEGER;
BEGIN
    -- Si es un UPDATE y el espacio_id no cambió, no validar
    IF TG_OP = 'UPDATE' THEN
        IF OLD.espacio_id IS NOT DISTINCT FROM NEW.espacio_id THEN
            RETURN NEW;
        END IF;
    END IF;

    -- Si se está desvinculando del espacio (espacio_id es NULL), no validar
    IF NEW.espacio_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Obtener el límite del espacio
    SELECT limite_usuarios INTO limite FROM public.espacios WHERE id = NEW.espacio_id;

    -- Si el espacio no tiene límite o no existe, omitir
    IF limite IS NULL THEN
        RETURN NEW;
    END IF;

    -- Contar miembros activos en el espacio destino (excluyendo el propio registro por si acaso)
    SELECT count(*)::INTEGER INTO actual
    FROM public.perfiles
    WHERE espacio_id = NEW.espacio_id AND id <> NEW.id;

    IF actual >= limite THEN
        RAISE EXCEPTION 'Límite de usuarios alcanzado para este plan (%)', limite;
    END IF;

    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.verificar_espacio_disponible(p_espacio_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_limite INTEGER;
  v_actual INTEGER;
BEGIN
  -- Obtener el límite del espacio
  SELECT limite_usuarios INTO v_limite FROM espacios WHERE id = p_espacio_id;

  -- Contar usuarios actuales
  SELECT COUNT(*) INTO v_actual FROM perfiles WHERE espacio_id = p_espacio_id;

  -- Retornar true si hay lugar
  RETURN v_actual < v_limite;
END;
$function$;

-- Heredada: genera cuotas en `cuentas_pendientes`.
CREATE OR REPLACE FUNCTION public.generar_cuotas(p_descripcion text, p_monto_mensual numeric, p_moneda text, p_cantidad_cuotas integer, p_fecha_inicio date, p_porcentaje_mora numeric, p_pagador_id bigint, p_espacio_id uuid)
 RETURNS void
 LANGUAGE plpgsql
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


-- -----------------------------------------------------------------------------
-- Políticas
-- -----------------------------------------------------------------------------

-- espacios
CREATE POLICY "Permitir crear espacios a usuarios autenticados" ON public.espacios AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.role() = 'authenticated'::text));
CREATE POLICY "RLS_Espacios_Insert" ON public.espacios AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (true);
CREATE POLICY "RLS_Espacios_Select_Public" ON public.espacios AS PERMISSIVE FOR SELECT TO public
  USING (true);
CREATE POLICY "Superadmin gestiona todo espacios" ON public.espacios AS PERMISSIVE FOR ALL TO public
  USING (es_superadmin());
CREATE POLICY "Ver mi propio espacio" ON public.espacios AS PERMISSIVE FOR SELECT TO public
  USING ((id = mi_espacio_id()));

-- perfiles
CREATE POLICY "Actualizar perfil propio" ON public.perfiles AS PERMISSIVE FOR UPDATE TO public
  USING ((id = auth.uid()));
CREATE POLICY "Insertar perfil propio" ON public.perfiles AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((id = auth.uid()));
CREATE POLICY "RLS_Perfiles_Hogar" ON public.perfiles AS PERMISSIVE FOR SELECT TO public
  USING ((espacio_id = mi_espacio_id()));
CREATE POLICY "RLS_Perfiles_Propio" ON public.perfiles AS PERMISSIVE FOR ALL TO public
  USING ((auth.uid() = id));
CREATE POLICY "Superadmin gestiona todo perfiles" ON public.perfiles AS PERMISSIVE FOR ALL TO public
  USING (es_superadmin());
CREATE POLICY "Ver o proprio perfil" ON public.perfiles AS PERMISSIVE FOR SELECT TO public
  USING ((id = auth.uid()));
CREATE POLICY "Ver perfiles de mi espacio" ON public.perfiles AS PERMISSIVE FOR SELECT TO public
  USING (((id = auth.uid()) OR (espacio_id = mi_espacio_id())));

-- gastos e ingresos
CREATE POLICY "Gestionar gastos" ON public.gastos AS PERMISSIVE FOR ALL TO public
  USING ((espacio_id = mi_espacio_id()));
CREATE POLICY "Gestionar ingresos" ON public.ingresos_mensuales AS PERMISSIVE FOR ALL TO public
  USING ((espacio_id = mi_espacio_id()));
CREATE POLICY "Gestionar mis ingresos programados" ON public.ingresos_programados AS PERMISSIVE FOR ALL TO public
  USING ((espacio_id = mi_espacio_id()));
CREATE POLICY "Ver mi historial de salarios" ON public.historial_salarios AS PERMISSIVE FOR ALL TO public
  USING ((espacio_id = mi_espacio_id()));

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

-- deudas y notificaciones
CREATE POLICY "Gestionar deudas" ON public.deudas_maestras AS PERMISSIVE FOR ALL TO public
  USING ((espacio_id = mi_espacio_id()));
CREATE POLICY "Gestionar cuotas" ON public.cuotas_detalle AS PERMISSIVE FOR ALL TO public
  USING ((espacio_id = mi_espacio_id()));
CREATE POLICY "Gestionar mis notificaciones" ON public.notificaciones AS PERMISSIVE FOR ALL TO public
  USING ((espacio_id = mi_espacio_id()));

-- tablas heredadas
CREATE POLICY "Cuentas Maestras: Acceso a mi espacio" ON public.cuentas_maestras AS PERMISSIVE FOR ALL TO public
  USING ((espacio_id IN ( SELECT mis_espacios() AS mis_espacios)));
CREATE POLICY "Permitir todo a usuarios autenticados en cuentas_maestras" ON public.cuentas_maestras AS PERMISSIVE FOR ALL TO authenticated
  USING (true);
CREATE POLICY "Aislamiento por espacio" ON public.cuentas_pendientes AS PERMISSIVE FOR ALL TO public
  USING ((espacio_id IN ( SELECT mis_espacios() AS mis_espacios)));
CREATE POLICY "Cuentas: Acceso a mi espacio" ON public.cuentas_pendientes AS PERMISSIVE FOR ALL TO public
  USING ((espacio_id IN ( SELECT mis_espacios() AS mis_espacios)));
CREATE POLICY "Prestamos: Acceso a mi espacio" ON public.prestamos_personales AS PERMISSIVE FOR ALL TO public
  USING ((espacio_id IN ( SELECT mis_espacios() AS mis_espacios)));
