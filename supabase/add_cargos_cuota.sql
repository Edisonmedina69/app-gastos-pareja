-- MIGRACIÓN: Módulo Deudas Pro - Agregar columna Cargos a cuotas_detalle
-- Ejecutá este script en el SQL Editor de tu Dashboard de Supabase.

-- 1. Agregar columna para cargos y seguros en cuotas_detalle
ALTER TABLE cuotas_detalle ADD COLUMN IF NOT EXISTS cargos NUMERIC DEFAULT 0;
COMMENT ON COLUMN cuotas_detalle.cargos IS 'Cargos y seguros mensuales de la cuota del préstamo';
