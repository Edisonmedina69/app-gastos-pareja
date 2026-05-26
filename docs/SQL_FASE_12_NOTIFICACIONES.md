/* 
   MIGRACIÓN: Módulo Deudas Pro (Fase 2)
   Sistema de Notificaciones y Alertas.
*/

-- 1. Tabla de Notificaciones
CREATE TABLE IF NOT EXISTS notificaciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    espacio_id UUID REFERENCES espacios(id) ON DELETE CASCADE,
    usuario_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    titulo TEXT NOT NULL,
    mensaje TEXT NOT NULL,
    tipo TEXT DEFAULT 'info' CHECK (tipo IN ('info', 'alerta', 'exito')),
    leida BOOLEAN DEFAULT FALSE,
    link TEXT, -- Para navegar a una sección específica
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. RLS para Notificaciones
ALTER TABLE notificaciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Gestionar mis notificaciones" ON notificaciones;
CREATE POLICY "Gestionar mis notificaciones" ON notificaciones 
FOR ALL USING (espacio_id = public.mi_espacio_id());

-- 3. Comentarios
COMMENT ON TABLE notificaciones IS 'Historial de alertas y avisos para los usuarios del hogar';
