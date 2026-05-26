/* 
   MIGRACIÓN: Módulo de Ajuste de Salario (HU-14)
   Historial de Crecimiento Salarial y Auditoría.
*/

-- 1. Tabla de Historial de Salarios
CREATE TABLE IF NOT EXISTS historial_salarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    espacio_id UUID REFERENCES espacios(id) ON DELETE CASCADE,
    usuario_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    ingreso_programado_id UUID REFERENCES ingresos_programados(id) ON DELETE CASCADE,
    monto_anterior NUMERIC NOT NULL,
    monto_nuevo NUMERIC NOT NULL,
    moneda TEXT NOT NULL,
    motivo TEXT DEFAULT 'Aumento Salarial',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. RLS para Historial
ALTER TABLE historial_salarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Ver mi historial de salarios" ON historial_salarios;
CREATE POLICY "Ver mi historial de salarios" ON historial_salarios 
FOR ALL USING (espacio_id = public.mi_espacio_id());

-- 3. Comentarios
COMMENT ON TABLE historial_salarios IS 'Registro de cambios en los ingresos fijos para seguimiento del crecimiento financiero';
