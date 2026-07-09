-- Agregar columnas de medio de pago y datos bancarios a gastos_programados
ALTER TABLE public.gastos_programados
ADD COLUMN IF NOT EXISTS medio_pago TEXT NOT NULL DEFAULT 'transferencia'
CHECK (medio_pago IN ('transferencia', 'efectivo'));

ALTER TABLE public.gastos_programados
ADD COLUMN IF NOT EXISTS tipo_cuenta TEXT
CHECK (tipo_cuenta IS NULL OR tipo_cuenta IN ('alias', 'nro_cuenta'));

ALTER TABLE public.gastos_programados
ADD COLUMN IF NOT EXISTS alias_cuenta TEXT;

ALTER TABLE public.gastos_programados
ADD COLUMN IF NOT EXISTS nro_cuenta TEXT;

ALTER TABLE public.gastos_programados
ADD COLUMN IF NOT EXISTS nombre_titular TEXT;

ALTER TABLE public.gastos_programados
ADD COLUMN IF NOT EXISTS ci_titular TEXT;

-- Agregar las mismas columnas a gastos (registro histórico del pago)
ALTER TABLE public.gastos
ADD COLUMN IF NOT EXISTS medio_pago TEXT NOT NULL DEFAULT 'transferencia'
CHECK (medio_pago IN ('transferencia', 'efectivo'));

ALTER TABLE public.gastos
ADD COLUMN IF NOT EXISTS tipo_cuenta TEXT
CHECK (tipo_cuenta IS NULL OR tipo_cuenta IN ('alias', 'nro_cuenta'));

ALTER TABLE public.gastos
ADD COLUMN IF NOT EXISTS alias_cuenta TEXT;

ALTER TABLE public.gastos
ADD COLUMN IF NOT EXISTS nro_cuenta TEXT;

ALTER TABLE public.gastos
ADD COLUMN IF NOT EXISTS nombre_titular TEXT;

ALTER TABLE public.gastos
ADD COLUMN IF NOT EXISTS ci_titular TEXT;

-- Agregar las mismas columnas a deudas_maestras (datos de cuenta para transferir)
ALTER TABLE public.deudas_maestras
ADD COLUMN IF NOT EXISTS medio_pago TEXT NOT NULL DEFAULT 'transferencia'
CHECK (medio_pago IN ('transferencia', 'efectivo'));

ALTER TABLE public.deudas_maestras
ADD COLUMN IF NOT EXISTS tipo_cuenta TEXT
CHECK (tipo_cuenta IS NULL OR tipo_cuenta IN ('alias', 'nro_cuenta'));

ALTER TABLE public.deudas_maestras
ADD COLUMN IF NOT EXISTS alias_cuenta TEXT;

ALTER TABLE public.deudas_maestras
ADD COLUMN IF NOT EXISTS nro_cuenta TEXT;

ALTER TABLE public.deudas_maestras
ADD COLUMN IF NOT EXISTS nombre_titular TEXT;

ALTER TABLE public.deudas_maestras
ADD COLUMN IF NOT EXISTS ci_titular TEXT;
