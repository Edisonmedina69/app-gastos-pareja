/* 
   MIGRACIÓN: Módulo de Gestión de Ingresos (HU-11, HU-12, HU-13)
   Sistema de Ingresos Programados y Variables.
*/

-- 1. Tabla de Ingresos Programados (Fijos)
CREATE TABLE IF NOT EXISTS ingresos_programados (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    espacio_id UUID REFERENCES espacios(id) ON DELETE CASCADE,
    usuario_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    descripcion TEXT NOT NULL,
    monto NUMERIC NOT NULL,
    moneda TEXT DEFAULT 'PYG' CHECK (moneda IN ('PYG', 'BRL', 'USD')),
    dia_recurrencia INTEGER NOT NULL CHECK (dia_recurrencia BETWEEN 1 AND 31),
    categoria TEXT DEFAULT 'Sueldo',
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. RLS para Ingresos Programados
ALTER TABLE ingresos_programados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Gestionar mis ingresos programados" ON ingresos_programados;
CREATE POLICY "Gestionar mis ingresos programados" ON ingresos_programados 
FOR ALL USING (espacio_id = public.mi_espacio_id());

-- 3. Comentarios
COMMENT ON TABLE ingresos_programados IS 'Configuración de ingresos fijos que se repiten mensualmente';
COMMENT ON COLUMN ingresos_programados.dia_recurrencia IS 'Día del mes en que se espera recibir el ingreso';
