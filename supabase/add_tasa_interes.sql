-- MIGRACIÓN: Módulo Deudas Pro - Agregar Tasa de Interés y Fix Cierre Tarjeta
-- Ejecutá este script en el SQL Editor de tu Dashboard de Supabase.

-- 1. Agregar columna para tasa de interés en deudas_maestras (para tarjetas y préstamos)
ALTER TABLE deudas_maestras ADD COLUMN IF NOT EXISTS tasa_interes NUMERIC DEFAULT 0;
COMMENT ON COLUMN deudas_maestras.tasa_interes IS 'Tasa de interés anual (%) de la tarjeta de crédito o préstamo';

-- 2. Asegurar que la columna fecha_cierre_tarjeta exista (por si no se creó anteriormente)
ALTER TABLE deudas_maestras ADD COLUMN IF NOT EXISTS fecha_cierre_tarjeta INTEGER;
COMMENT ON COLUMN deudas_maestras.fecha_cierre_tarjeta IS 'Día del mes (1-31) en que cierra la tarjeta de crédito';
