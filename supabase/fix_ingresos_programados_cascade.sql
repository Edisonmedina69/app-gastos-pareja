-- Cambiar el comportamiento de borrado en ingresos_programados e historial_salarios
-- De ON DELETE CASCADE a ON DELETE SET NULL para evitar la pérdida accidental de datos si un usuario se recrea o elimina.

-- 1. Modificar ingresos_programados
ALTER TABLE public.ingresos_programados
  DROP CONSTRAINT IF EXISTS ingresos_programados_usuario_id_fkey;

ALTER TABLE public.ingresos_programados
  ADD CONSTRAINT ingresos_programados_usuario_id_fkey
  FOREIGN KEY (usuario_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. Modificar historial_salarios
ALTER TABLE public.historial_salarios
  DROP CONSTRAINT IF EXISTS historial_salarios_usuario_id_fkey;

ALTER TABLE public.historial_salarios
  ADD CONSTRAINT historial_salarios_usuario_id_fkey
  FOREIGN KEY (usuario_id) REFERENCES auth.users(id) ON DELETE SET NULL;
