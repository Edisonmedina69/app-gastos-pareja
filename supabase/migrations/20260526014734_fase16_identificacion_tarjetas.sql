-- =============================================================================
-- Migración histórica · aplicada a mano en el SQL Editor de Supabase.
-- Origen: docs/SQL_FASE_16_IDENTIFICACION_TARJETAS.md · commit b7a9da0 2026-05-25
-- NO volver a ejecutar en producción: el esquema vigente está en supabase/schema.sql.
-- =============================================================================

/* 
   MIGRACIÓN: Módulo Deudas Pro (Identificación de Tarjetas)
   Agrega campo para número de tarjeta.
*/

-- 1. Campo para número de tarjeta (ej: últimos 4 dígitos)
ALTER TABLE deudas_maestras ADD COLUMN IF NOT EXISTS nro_tarjeta TEXT;

-- 2. Comentario
COMMENT ON COLUMN deudas_maestras.nro_tarjeta IS 'Identificador de la tarjeta (ej: terminación 1234) para diferenciar entre varios plásticos.';
