-- =============================================================================
-- Migración histórica · aplicada a mano en el SQL Editor de Supabase.
-- Origen: docs/RLS_HU-13.md · commit 74c21f6 2026-05-16
-- NO volver a ejecutar en producción: el esquema vigente está en supabase/schema.sql.
-- =============================================================================

-- Guarda: nunca re-ejecutar sobre una base que ya tiene el esquema (producción).
DO $$
BEGIN
  IF to_regclass('public.espacios') IS NOT NULL THEN
    RAISE EXCEPTION 'Migración histórica: la base ya tiene el esquema. Ver supabase/migrations/README.md (usar "supabase migration repair --status applied").';
  END IF;
END $$;

-- Extraído del bloque SQL principal de docs/RLS_HU-13.md (se omitió el bloque de datos de prueba).
-- Referencia tablas y funciones que ya no existen (metas_ahorro, usuarios_espacios, auth.mis_espacios):
-- se conserva sólo como registro histórico.

-- 1. Habilitar RLS en las tablas principales
ALTER TABLE gastos ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingresos_mensuales ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuentas_pendientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuentas_maestras ENABLE ROW LEVEL SECURITY;
ALTER TABLE prestamos_personales ENABLE ROW LEVEL SECURITY;
ALTER TABLE metas_ahorro ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios_espacios ENABLE ROW LEVEL SECURITY;

-- 2. Crear Políticas (Policies) para lectura y escritura
-- Estas políticas aseguran que un usuario solo pueda seleccionar, insertar, actualizar o borrar
-- filas donde el espacio_id coincida con el espacio al que pertenece en la tabla 'usuarios_espacios'.

-- Función helper para obtener los espacios del usuario actual
CREATE OR REPLACE FUNCTION auth.mis_espacios()
RETURNS SETOF uuid AS $$
  SELECT espacio_id FROM public.usuarios_espacios WHERE usuario_id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Aplicar políticas a 'gastos'
CREATE POLICY "Gastos: Acceso solo a miembros del espacio" ON gastos
    FOR ALL USING (espacio_id IN (SELECT auth.mis_espacios()));

-- Aplicar políticas a 'ingresos_mensuales'
CREATE POLICY "Ingresos: Acceso solo a miembros del espacio" ON ingresos_mensuales
    FOR ALL USING (espacio_id IN (SELECT auth.mis_espacios()));

-- Aplicar políticas a 'cuentas_pendientes'
CREATE POLICY "Cuentas: Acceso solo a miembros del espacio" ON cuentas_pendientes
    FOR ALL USING (espacio_id IN (SELECT auth.mis_espacios()));

-- Aplicar políticas a 'cuentas_maestras'
CREATE POLICY "Cuentas Maestras: Acceso solo a miembros del espacio" ON cuentas_maestras
    FOR ALL USING (espacio_id IN (SELECT auth.mis_espacios()));

-- Aplicar políticas a 'prestamos_personales'
CREATE POLICY "Prestamos: Acceso solo a miembros del espacio" ON prestamos_personales
    FOR ALL USING (espacio_id IN (SELECT auth.mis_espacios()));

-- Aplicar políticas a 'metas_ahorro'
CREATE POLICY "Metas: Acceso solo a miembros del espacio" ON metas_ahorro
    FOR ALL USING (espacio_id IN (SELECT auth.mis_espacios()));

-- Política especial para usuarios_espacios (un usuario puede ver las membresías de su propio espacio)
CREATE POLICY "Membresías: Ver membresias de mis espacios" ON usuarios_espacios
    FOR SELECT USING (espacio_id IN (SELECT auth.mis_espacios()));
    
CREATE POLICY "Membresías: Insertar mi propia membresia inicial" ON usuarios_espacios
    FOR INSERT WITH CHECK (usuario_id = auth.uid());
