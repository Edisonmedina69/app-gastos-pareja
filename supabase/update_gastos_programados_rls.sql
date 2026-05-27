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
