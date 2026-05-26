/* 
   MIGRACIÓN: Módulo Deudas Pro (Fase 1)
   Agrega campos necesarios para Tarjetas de Crédito y Pagos Flexibles.
*/

-- 1. Campos para Tarjeta de Crédito en deudas_maestras
ALTER TABLE deudas_maestras ADD COLUMN IF NOT EXISTS linea_credito_total NUMERIC DEFAULT 0;
ALTER TABLE deudas_maestras ADD COLUMN IF NOT EXISTS linea_credito_disponible NUMERIC DEFAULT 0;

-- 2. Campos para detalle de cuotas (Pago Mínimo)
ALTER TABLE cuotas_detalle ADD COLUMN IF NOT EXISTS pago_minimo NUMERIC DEFAULT 0;

-- 3. Comentarios para documentación
COMMENT ON COLUMN deudas_maestras.linea_credito_total IS 'Límite total de la tarjeta de crédito';
COMMENT ON COLUMN deudas_maestras.linea_credito_disponible IS 'Crédito disponible actual (se resta al gastar, se suma al pagar)';
COMMENT ON COLUMN cuotas_detalle.pago_minimo IS 'Monto mínimo a pagar este mes para evitar mora';
