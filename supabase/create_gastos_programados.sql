-- Creación de la tabla de Gastos Programados (Fijos)
CREATE TABLE IF NOT EXISTS public.gastos_programados (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    espacio_id UUID NOT NULL REFERENCES public.espacios(id) ON DELETE CASCADE,
    usuario_id UUID REFERENCES public.perfiles(id) ON DELETE SET NULL,
    concepto TEXT NOT NULL,
    monto NUMERIC NOT NULL,
    moneda TEXT NOT NULL DEFAULT 'PYG',
    dia_recurrencia INTEGER NOT NULL DEFAULT 5 CHECK (dia_recurrencia >= 1 AND dia_recurrencia <= 31),
    categoria TEXT NOT NULL DEFAULT 'Casa',
    para_quien TEXT NOT NULL DEFAULT 'Ambos' CHECK (para_quien IN ('Ambos', 'Yo', 'Pareja')),
    activo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.gastos_programados ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
CREATE POLICY "Permitir lectura de gastos programados a miembros del hogar"
    ON public.gastos_programados
    FOR SELECT
    TO authenticated
    USING (
        espacio_id = (SELECT espacio_id FROM public.perfiles WHERE id = auth.uid())
    );

CREATE POLICY "Permitir inserción de gastos programados a miembros del hogar"
    ON public.gastos_programados
    FOR INSERT
    TO authenticated
    WITH CHECK (
        espacio_id = (SELECT espacio_id FROM public.perfiles WHERE id = auth.uid())
    );

CREATE POLICY "Permitir actualización de gastos programados a miembros del hogar"
    ON public.gastos_programados
    FOR UPDATE
    TO authenticated
    USING (
        espacio_id = (SELECT espacio_id FROM public.perfiles WHERE id = auth.uid())
    )
    WITH CHECK (
        espacio_id = (SELECT espacio_id FROM public.perfiles WHERE id = auth.uid())
    );

CREATE POLICY "Permitir eliminación de gastos programados a miembros del hogar"
    ON public.gastos_programados
    FOR DELETE
    TO authenticated
    USING (
        espacio_id = (SELECT espacio_id FROM public.perfiles WHERE id = auth.uid())
    );
