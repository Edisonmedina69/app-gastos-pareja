/* 
   MIGRACIÓN: Módulo Deudas Pro (Fase 3, 4 y Salud Financiera)
   Agrega campos para alcance, estados y gestión de solicitudes.
*/

-- 1. Campos de Alcance y Estado en deudas_maestras
ALTER TABLE deudas_maestras ADD COLUMN IF NOT EXISTS alcance TEXT DEFAULT 'familiar' CHECK (alcance IN ('individual', 'familiar'));
ALTER TABLE deudas_maestras ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'activa' CHECK (estado IN ('activa', 'cerrada'));

-- 2. Mejorar tabla de notificaciones para manejar solicitudes de pago
ALTER TABLE notificaciones ADD COLUMN IF NOT EXISTS metadata JSONB;

-- 3. Comentarios
COMMENT ON COLUMN deudas_maestras.alcance IS 'Alcance de la deuda: individual (solo creador) o familiar (compartida)';
COMMENT ON COLUMN deudas_maestras.estado IS 'Estado de la deuda: activa o cerrada/archivera';
COMMENT ON COLUMN notificaciones.metadata IS 'Datos adicionales para acciones (ej: id_deuda para solicitudes de ayuda)';
