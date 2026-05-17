/* 
   ACTUALIZACIÓN FASE 10: Planes SaaS y Gestión de Límites
   Ejecutar en el SQL Editor de Supabase
*/

-- 1. Agregar columna de límite de usuarios a la tabla de espacios
ALTER TABLE espacios ADD COLUMN IF NOT EXISTS limite_usuarios INTEGER DEFAULT 2;

-- 2. Función Helper para contar miembros actuales de un espacio
CREATE OR REPLACE FUNCTION public.contar_miembros_espacio(eid UUID)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER FROM public.perfiles WHERE espacio_id = eid;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 3. Trigger o Política para bloquear registros si se supera el límite
-- Nota: En Supabase es más limpio manejarlo con un Trigger antes de insertar en perfiles.

CREATE OR REPLACE FUNCTION public.validar_limite_usuarios()
RETURNS TRIGGER AS $$
DECLARE
    limite INTEGER;
    actual INTEGER;
BEGIN
    -- Obtener el límite del espacio
    SELECT limite_usuarios INTO limite FROM public.espacios WHERE id = NEW.espacio_id;
    
    -- Contar miembros actuales
    SELECT count(*) INTO actual FROM public.perfiles WHERE espacio_id = NEW.espacio_id;
    
    IF actual >= limite THEN
        RAISE EXCEPTION 'Límite de usuarios alcanzado para este plan (%)', limite;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_validar_limite_usuarios ON perfiles;
CREATE TRIGGER tr_validar_limite_usuarios
BEFORE INSERT ON perfiles
FOR EACH ROW EXECUTE FUNCTION public.validar_limite_usuarios();
