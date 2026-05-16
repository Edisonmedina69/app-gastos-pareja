# Fase 6 - HU-13: Aislamiento de Datos por Espacio (Multi-tenant)

Para garantizar la seguridad de que un hogar no pueda ver los datos de otro hogar, utilizaremos **Row Level Security (RLS)** en Supabase. 

## 1. Habilitar RLS en todas las tablas

Ejecuta el siguiente script en el **SQL Editor** de tu Dashboard de Supabase para habilitar RLS y crear las políticas de seguridad.

```sql
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
```

## 2. Entorno de Prueba (Espacio Semilla)

Para realizar pruebas sin afectar a usuarios reales, puedes crear un espacio de prueba ejecutando el siguiente SQL:

```sql
-- Crear un espacio de prueba
INSERT INTO espacios (id, nombre, moneda_base, tokens_mensuales, tokens_usados)
VALUES ('00000000-0000-0000-0000-000000000001', 'Hogar de Prueba (Test-001)', 'PYG', 30000, 0)
ON CONFLICT DO NOTHING;

-- Para asignar tu usuario actual a este espacio de prueba:
-- Reemplaza 'TU_UUID_DE_USUARIO' con tu ID real de auth.users
-- INSERT INTO usuarios_espacios (usuario_id, espacio_id, rol)
-- VALUES ('TU_UUID_DE_USUARIO', '00000000-0000-0000-0000-000000000001', 'admin');
```

Al cambiar de espacio en la base de datos (o al invitar a un usuario a tu espacio), las reglas RLS garantizarán que las consultas como `supabase.from('gastos').select('*')` solo devuelvan la información de *ese* hogar.
