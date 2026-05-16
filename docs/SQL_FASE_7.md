/* 
   SCRIPT MAESTRO: REESTRUCTURACIÓN FASE 7 (Multi-tenancy Pro)
   ÑandeFinanza 2.0 - Versión Final Estable
*/

/* 1. LIMPIEZA DE TABLAS ANTERIORES (Orden jerárquico) */
DROP TABLE IF EXISTS cuotas_detalle CASCADE;
DROP TABLE IF EXISTS deudas_maestras CASCADE;
DROP TABLE IF EXISTS gastos CASCADE;
DROP TABLE IF EXISTS ingresos_mensuales CASCADE;
DROP TABLE IF EXISTS metas_ahorro CASCADE;
DROP TABLE IF EXISTS usuarios_espacios CASCADE;
DROP TABLE IF EXISTS usuarios CASCADE;
DROP TABLE IF EXISTS perfiles CASCADE;
DROP TABLE IF EXISTS espacios CASCADE;

/* 2. CREACIÓN DE ESTRUCTURA BASE */
-- Tabla de Inquilinos (Hogares)
CREATE TABLE espacios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre_familia TEXT NOT NULL,
    moneda_principal TEXT DEFAULT 'PYG',
    tokens_ia_disponibles INTEGER DEFAULT 10000,
    codigo_invitacion TEXT UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de Perfiles (Usuarios vinculados a Auth)
CREATE TABLE perfiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    espacio_id UUID REFERENCES espacios(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    rol TEXT DEFAULT 'miembro' CHECK (rol IN ('superadmin', 'admin_hogar', 'miembro')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

/* 3. TABLAS TRANSACCIONALES */
CREATE TABLE gastos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    espacio_id UUID REFERENCES espacios(id) ON DELETE CASCADE,
    usuario_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    pagador_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    monto NUMERIC NOT NULL,
    moneda TEXT NOT NULL,
    tasa_cambio NUMERIC DEFAULT 1,
    concepto TEXT NOT NULL,
    categoria TEXT,
    para_quien TEXT DEFAULT 'Ambos',
    porcentaje_pagador INTEGER DEFAULT 100,
    fecha TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE ingresos_mensuales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    espacio_id UUID REFERENCES espacios(id) ON DELETE CASCADE,
    usuario_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    monto NUMERIC NOT NULL,
    moneda TEXT NOT NULL,
    tasa_cambio NUMERIC DEFAULT 1,
    concepto TEXT NOT NULL,
    mes INTEGER,
    anio INTEGER,
    fecha TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

/* 4. NUEVO MÓDULO DE DEUDAS PRO */
CREATE TABLE deudas_maestras (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    espacio_id UUID REFERENCES espacios(id) ON DELETE CASCADE,
    creador_id UUID REFERENCES auth.users(id),
    titulo TEXT NOT NULL,
    tipo TEXT CHECK (tipo IN ('fija', 'flexible', 'tarjeta_credito')),
    permite_pago_parcial BOOLEAN DEFAULT FALSE,
    moneda TEXT DEFAULT 'PYG',
    tasa_cambio NUMERIC DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE cuotas_detalle (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deuda_maestra_id UUID REFERENCES deudas_maestras(id) ON DELETE CASCADE,
    espacio_id UUID REFERENCES espacios(id) ON DELETE CASCADE,
    numero_cuota INTEGER,
    monto_cuota NUMERIC NOT NULL,
    monto_abonado NUMERIC DEFAULT 0,
    fecha_vencimiento DATE,
    estado TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'pagado')),
    fecha_pago TIMESTAMP WITH TIME ZONE,
    pagador_id UUID REFERENCES auth.users(id)
);

/* 5. SEGURIDAD (RLS) */
ALTER TABLE espacios ENABLE ROW LEVEL SECURITY;
ALTER TABLE perfiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE gastos ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingresos_mensuales ENABLE ROW LEVEL SECURITY;
ALTER TABLE deudas_maestras ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuotas_detalle ENABLE ROW LEVEL SECURITY;

/* Función Helper para RLS */
CREATE OR REPLACE FUNCTION public.mi_espacio_id()
RETURNS UUID AS $$
  SELECT espacio_id FROM public.perfiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

/* POLÍTICAS */
-- Perfiles
DROP POLICY IF EXISTS "Ver perfiles de mi espacio" ON perfiles;
CREATE POLICY "Ver perfiles de mi espacio" ON perfiles FOR SELECT USING (espacio_id = public.mi_espacio_id());
DROP POLICY IF EXISTS "Superadmin ve todo perfiles" ON perfiles;
CREATE POLICY "Superadmin ve todo perfiles" ON perfiles FOR ALL USING ((SELECT rol FROM perfiles WHERE id = auth.uid()) = 'superadmin');

-- Espacios
DROP POLICY IF EXISTS "Ver mi propio espacio" ON espacios;
CREATE POLICY "Ver mi propio espacio" ON espacios FOR SELECT USING (id = public.mi_espacio_id());
DROP POLICY IF EXISTS "Superadmin gestiona todo espacios" ON espacios;
CREATE POLICY "Superadmin gestiona todo espacios" ON espacios FOR ALL USING ((SELECT rol FROM perfiles WHERE id = auth.uid()) = 'superadmin');

-- Transacciones
DROP POLICY IF EXISTS "Gestionar gastos" ON gastos;
CREATE POLICY "Gestionar gastos" ON gastos FOR ALL USING (espacio_id = public.mi_espacio_id());
DROP POLICY IF EXISTS "Gestionar ingresos" ON ingresos_mensuales;
CREATE POLICY "Gestionar ingresos" ON ingresos_mensuales FOR ALL USING (espacio_id = public.mi_espacio_id());
DROP POLICY IF EXISTS "Gestionar deudas" ON deudas_maestras;
CREATE POLICY "Gestionar deudas" ON deudas_maestras FOR ALL USING (espacio_id = public.mi_espacio_id());
DROP POLICY IF EXISTS "Gestionar cuotas" ON cuotas_detalle;
CREATE POLICY "Gestionar cuotas" ON cuotas_detalle FOR ALL USING (espacio_id = public.mi_espacio_id());
