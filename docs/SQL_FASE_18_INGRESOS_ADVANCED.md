/* 
   MIGRACIÓN FASE 18: Mejoras en Ingresos Mensuales e Ingresos Programados (Issue #8)
   Ejecutar este script en el SQL Editor de Supabase.
*/

-- 1. Nuevos campos para la lógica de días hábiles y descuentos en ingresos_programados
ALTER TABLE ingresos_programados ADD COLUMN IF NOT EXISTS solo_dias_habiles BOOLEAN DEFAULT TRUE;
ALTER TABLE ingresos_programados ADD COLUMN IF NOT EXISTS ajuste_dia_habil TEXT DEFAULT 'anterior';
ALTER TABLE ingresos_programados ADD COLUMN IF NOT EXISTS monto_descuento NUMERIC DEFAULT 0;
ALTER TABLE ingresos_programados ADD COLUMN IF NOT EXISTS concepto_descuento TEXT DEFAULT '';

-- 2. Nuevos campos en ingresos_mensuales para guardar la fecha efectiva y tipo de ingreso
ALTER TABLE ingresos_mensuales ADD COLUMN IF NOT EXISTS tipo_ingreso TEXT DEFAULT 'salario_mensual';
ALTER TABLE ingresos_mensuales ADD COLUMN IF NOT EXISTS fecha_efectiva DATE DEFAULT CURRENT_DATE;

-- 3. Actualizar comentarios para documentación de la tabla
COMMENT ON COLUMN ingresos_programados.solo_dias_habiles IS 'Indica si el cobro debe ajustarse solo a días hábiles (Lunes a Viernes)';
COMMENT ON COLUMN ingresos_programados.ajuste_dia_habil IS 'Estrategia si cae fin de semana: anterior (Viernes) o siguiente (Lunes)';
COMMENT ON COLUMN ingresos_programados.monto_descuento IS 'Monto de descuento automático recurrente (ej: IPS, Gym)';
