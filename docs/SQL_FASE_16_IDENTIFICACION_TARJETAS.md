/* 
   MIGRACIÓN: Módulo Deudas Pro (Identificación de Tarjetas)
   Agrega campo para número de tarjeta.
*/

-- 1. Campo para número de tarjeta (ej: últimos 4 dígitos)
ALTER TABLE deudas_maestras ADD COLUMN IF NOT EXISTS nro_tarjeta TEXT;

-- 2. Comentario
COMMENT ON COLUMN deudas_maestras.nro_tarjeta IS 'Identificador de la tarjeta (ej: terminación 1234) para diferenciar entre varios plásticos.';
