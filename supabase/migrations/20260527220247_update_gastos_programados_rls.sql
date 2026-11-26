-- =============================================================================
-- Migración histórica · aplicada a mano en el SQL Editor de Supabase.
-- Origen: supabase/update_gastos_programados_rls.sql · commit 0b0b321 2026-05-27
-- NO volver a ejecutar en producción: el esquema vigente está en supabase/schema.sql.
-- =============================================================================

-- Actualizar políticas de RLS para usar public.mi_espacio_id()
-- Esto evita recursiones y estandariza con las demás tablas

-- 1. Eliminar políticas viejas
DROP POLICY IF EXISTS "Permitir lectura de gastos programados a miembros del hogar" ON public.gastos_programados;
DROP POLICY IF EXISTS "Permitir inserción de gastos programados a miembros del hogar" ON public.gastos_programados;
DROP POLICY IF EXISTS "Permitir actualización de gastos programados a miembros del hogar" ON public.gastos_programados;
DROP POLICY IF EXISTS "Permitir eliminación de gastos programados a miembros del hogar" ON public.gastos_programados;

-- 2. Crear políticas nuevas usando public.mi_espacio_id()
CREATE POLICY "Permitir lectura de gastos programados a miembros del hogar"
    ON public.gastos_programados
    FOR SELECT
    TO authenticated
    USING (
        espacio_id = public.mi_espacio_id()
    );

CREATE POLICY "Permitir inserción de gastos programados a miembros del hogar"
    ON public.gastos_programados
    FOR INSERT
    TO authenticated
    WITH CHECK (
        espacio_id = public.mi_espacio_id()
    );

CREATE POLICY "Permitir actualización de gastos programados a miembros del hogar"
    ON public.gastos_programados
    FOR UPDATE
    TO authenticated
    USING (
        espacio_id = public.mi_espacio_id()
    )
    WITH CHECK (
        espacio_id = public.mi_espacio_id()
    );

CREATE POLICY "Permitir eliminación de gastos programados a miembros del hogar"
    ON public.gastos_programados
    FOR DELETE
    TO authenticated
    USING (
        espacio_id = public.mi_espacio_id()
    );
