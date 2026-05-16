# Plan de Diseño: Fase 5 - Sistema Multimoneda y Control de IA

Este documento detalla la estrategia para implementar las historias de usuario HU-10 y HU-11.

## 1. Cambios en la Base de Datos (Supabase)
Es necesario agregar los siguientes campos a las tablas existentes. Se recomienda ejecutar este SQL en el Editor de Consultas de Supabase:

```sql
-- Para HU-10: Tasa de Cambio
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS tasa_cambio NUMERIC DEFAULT 1;
ALTER TABLE cuentas_pendientes ADD COLUMN IF NOT EXISTS tasa_cambio NUMERIC DEFAULT 1;

-- Para HU-11: Control de Tokens (A nivel de Hogar/Espacio)
ALTER TABLE espacios ADD COLUMN IF NOT EXISTS tokens_mensuales INTEGER DEFAULT 30000;
ALTER TABLE espacios ADD COLUMN IF NOT EXISTS tokens_usados INTEGER DEFAULT 0;
ALTER TABLE espacios ADD COLUMN IF NOT EXISTS ultimo_ciclo_tokens TIMESTAMP WITH TIME ZONE DEFAULT NOW();
```

## 2. HU-10: Gestión de Tasas de Cambio Híbrida
### Componentes a modificar: `Inicio.jsx` y `Cuentas.jsx`
- **Lógica de Autocompletado:**
  - Al seleccionar una moneda distinta a PYG (la principal), se disparará un `fetch` a `https://open.er-api.com/v6/latest/[MONEDA]`.
  - El valor obtenido se multiplicará para obtener la relación con PYG (ej. 1 BRL = 1,450 PYG).
- **Interfaz de Usuario:**
  - Se añadirá un campo numérico "Tasa de Cambio (Cotización)" que se auto-rellenará pero permitirá edición manual.
  - Se mostrará una previsualización del monto convertido a PYG en tiempo real.
- **Persistencia:**
  - Se guardará la `tasa_cambio` utilizada en la tabla correspondiente para mantener la integridad histórica.

## 3. HU-11: Bloqueo por Límite de Tokens
### Componente a modificar: `AsistenteGemini.jsx`
- **Sincronización de Datos:**
  - Al cargar el componente, se leerá el estado de los tokens desde la tabla `espacios`.
  - **Lógica de Reset:** Si la fecha actual corresponde a un mes distinto a `ultimo_ciclo_tokens`, se reiniciará `tokens_usados` a 0 y se actualizará la fecha en la DB.
- **Control de Acceso:**
  - Si `tokens_usados >= tokens_mensuales`, el input de chat se bloqueará (`disabled`).
  - Se mostrará un banner informativo: "Has agotado tus consultas mágicas...".
- **Consumo Real:**
  - Después de cada respuesta de Gemini, se enviará un `update` a Supabase incrementando `tokens_usados` basándose en el conteo de tokens devuelto por la API (o una estimación precisa).

## 4. Pruebas y Validación
- Verificar que al cambiar de PYG a BRL en el modal de gasto, aparezca la cotización correcta.
- Modificar manualmente la cotización y confirmar que el gasto se guarda con ese valor.
- Simular el agotamiento de tokens (poniendo `tokens_usados` al máximo en DB) y verificar el bloqueo del chat.
