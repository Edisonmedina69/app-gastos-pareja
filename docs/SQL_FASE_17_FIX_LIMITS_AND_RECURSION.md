/* 
   ACTUALIZACIÓN FASE 17: Corrección de Recursión RLS y Robustez del Límite de Usuarios
   Ejecutar este script en el SQL Editor de tu Dashboard de Supabase.
*/

-- 1. Función Helper para verificar si el usuario es Superadmin sin causar recursión RLS
-- Al ser SECURITY DEFINER, se ejecuta con privilegios del creador de la función (bypass RLS), 
-- previniendo la recursión infinita al consultar 'perfiles' desde una política de 'perfiles' o 'espacios'.
CREATE OR REPLACE FUNCTION public.es_superadmin()
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (SELECT rol = 'superadmin' FROM public.perfiles WHERE id = auth.uid()),
    FALSE
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 2. Actualización de Políticas RLS para la tabla 'perfiles'
DROP POLICY IF EXISTS "Ver perfiles de mi espacio" ON public.perfiles;
DROP POLICY IF EXISTS "Superadmin ve todo perfiles" ON public.perfiles;
DROP POLICY IF EXISTS "Insertar perfil propio" ON public.perfiles;
DROP POLICY IF EXISTS "Actualizar perfil propio" ON public.perfiles;
DROP POLICY IF EXISTS "Superadmin gestiona todo perfiles" ON public.perfiles;

-- Permitir a los usuarios ver su propio perfil o el de miembros de su mismo espacio
CREATE POLICY "Ver perfiles de mi espacio" ON public.perfiles 
  FOR SELECT 
  USING (id = auth.uid() OR espacio_id = public.mi_espacio_id());

-- Permitir a un usuario insertar su propio perfil al registrarse
CREATE POLICY "Insertar perfil propio" ON public.perfiles 
  FOR INSERT 
  WITH CHECK (id = auth.uid());

-- Permitir a un usuario actualizar su propio perfil (por ejemplo, para vincularse a un espacio o cambiar su nombre)
CREATE POLICY "Actualizar perfil propio" ON public.perfiles 
  FOR UPDATE 
  USING (id = auth.uid());

-- Permitir al Superadmin realizar cualquier operación sobre todos los perfiles
CREATE POLICY "Superadmin gestiona todo perfiles" ON public.perfiles 
  FOR ALL 
  USING (public.es_superadmin());


-- 3. Actualización de Políticas RLS para la tabla 'espacios'
DROP POLICY IF EXISTS "Ver mi propio espacio" ON public.espacios;
DROP POLICY IF EXISTS "Superadmin gestiona todo espacios" ON public.espacios;
DROP POLICY IF EXISTS "Permitir crear espacios a usuarios autenticados" ON public.espacios;

-- Permitir a los miembros ver su propio espacio
CREATE POLICY "Ver mi propio espacio" ON public.espacios 
  FOR SELECT 
  USING (id = public.mi_espacio_id());

-- Permitir a los usuarios autenticados crear nuevos espacios
CREATE POLICY "Permitir crear espacios a usuarios autenticados" ON public.espacios 
  FOR INSERT 
  WITH CHECK (auth.role() = 'authenticated');

-- Permitir al Superadmin gestionar todos los espacios (incluye DELETE)
CREATE POLICY "Superadmin gestiona todo espacios" ON public.espacios 
  FOR ALL 
  USING (public.es_superadmin());


-- 4. Actualización del Trigger de Validación de Límite de Usuarios
-- Modificamos la función para que no valide si no cambió el espacio_id o si se desvincula.
-- Además, excluimos el ID actual del conteo por seguridad.
CREATE OR REPLACE FUNCTION public.validar_limite_usuarios()
RETURNS TRIGGER AS $$
DECLARE
    limite INTEGER;
    actual INTEGER;
BEGIN
    -- Si es un UPDATE y el espacio_id no cambió, no validar
    IF TG_OP = 'UPDATE' THEN
        IF OLD.espacio_id IS NOT DISTINCT FROM NEW.espacio_id THEN
            RETURN NEW;
        END IF;
    END IF;

    -- Si se está desvinculando del espacio (espacio_id es NULL), no validar
    IF NEW.espacio_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Obtener el límite del espacio
    SELECT limite_usuarios INTO limite FROM public.espacios WHERE id = NEW.espacio_id;
    
    -- Si el espacio no tiene límite o no existe, omitir
    IF limite IS NULL THEN
        RETURN NEW;
    END IF;
    
    -- Contar miembros activos en el espacio destino (excluyendo el propio registro por si acaso)
    SELECT count(*)::INTEGER INTO actual 
    FROM public.perfiles 
    WHERE espacio_id = NEW.espacio_id AND id <> NEW.id;
    
    IF actual >= limite THEN
        RAISE EXCEPTION 'Límite de usuarios alcanzado para este plan (%)', limite;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreamos el trigger para actuar en INSERT y UPDATE de la columna espacio_id
DROP TRIGGER IF EXISTS tr_validar_limite_usuarios ON public.perfiles;
CREATE TRIGGER tr_validar_limite_usuarios
BEFORE INSERT OR UPDATE OF espacio_id ON public.perfiles
FOR EACH ROW EXECUTE FUNCTION public.validar_limite_usuarios();
