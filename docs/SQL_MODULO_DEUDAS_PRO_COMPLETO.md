/* 
   SCRIPT MAESTRO: MÓDULO DEUDAS PRO Y SALUD FINANCIERA
   App: ÑandeFinanza 2.0
   Requerimientos: Fase 1, 3 y 4.
*/

-- 1. TABLA PRINCIPAL DE DEUDAS
CREATE TABLE IF NOT EXISTS deudas_maestras (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    espacio_id UUID REFERENCES espacios(id) ON DELETE CASCADE,
    creador_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    titulo TEXT NOT NULL, -- equivalente a 'descripcion'
    tipo TEXT NOT NULL CHECK (tipo IN ('fija', 'flexible', 'tarjeta_credito')),
    alcance TEXT DEFAULT 'familiar' CHECK (alcance IN ('individual', 'familiar')),
    estado TEXT DEFAULT 'activa' CHECK (estado IN ('activa', 'cerrada')),
    moneda TEXT DEFAULT 'PYG' CHECK (moneda IN ('PYG', 'BRL', 'USD')),
    permite_pago_parcial BOOLEAN DEFAULT FALSE,
    tasa_cambio NUMERIC DEFAULT 1,
    
    -- Campos condicionales para Tarjetas
    linea_credito_total NUMERIC DEFAULT 0,
    linea_credito_disponible NUMERIC DEFAULT 0,
    fecha_cierre_tarjeta INTEGER, -- Día del mes (1-31)
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. TABLA DE CALENDARIO DE CUOTAS
CREATE TABLE IF NOT EXISTS cuotas_detalle (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deuda_maestra_id UUID REFERENCES deudas_maestras(id) ON DELETE CASCADE,
    espacio_id UUID REFERENCES espacios(id) ON DELETE CASCADE,
    numero_cuota INTEGER,
    monto_cuota NUMERIC NOT NULL,
    monto_abonado NUMERIC DEFAULT 0,
    pago_minimo NUMERIC DEFAULT 0, -- Especialmente para tarjetas
    fecha_vencimiento DATE, -- Generada omitiendo fines de semana
    estado TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'pagado')),
    fecha_pago TIMESTAMP WITH TIME ZONE,
    pagador_id UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- 3. POLÍTICAS DE SEGURIDAD (RLS)
ALTER TABLE deudas_maestras ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuotas_detalle ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Gestionar deudas" ON deudas_maestras;
CREATE POLICY "Gestionar deudas" ON deudas_maestras FOR ALL USING (espacio_id = public.mi_espacio_id());

DROP POLICY IF EXISTS "Gestionar cuotas" ON cuotas_detalle;
CREATE POLICY "Gestionar cuotas" ON cuotas_detalle FOR ALL USING (espacio_id = public.mi_espacio_id());

-- 4. COMENTARIOS DE DOCUMENTACIÓN
COMMENT ON TABLE deudas_maestras IS 'Registro principal de deudas, préstamos y tarjetas de crédito';
COMMENT ON TABLE cuotas_detalle IS 'Calendario de pagos mensual asociado a cada deuda';
COMMENT ON COLUMN deudas_maestras.alcance IS 'Privacidad: Individual (solo el creador paga) o Familiar (ambos pagan)';
COMMENT ON COLUMN cuotas_detalle.fecha_vencimiento IS 'Fecha límite de pago, calculada dinámicamente evitando sábados, domingos y feriados.';
