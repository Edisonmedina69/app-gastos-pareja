# Medio de Pago y Datos de Cuenta en Gastos Fijos — Plan de Implementación

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Agregar método de pago (Transferencia / Efectivo) y datos de cuenta bancaria (alias o nro de cuenta + titular + CI) a los gastos fijos programados, para que al momento de pagar el usuario tenga a mano los datos para transferir.

**Architecture:** Se agregan 5 columnas nuevas a `gastos_programados` y `gastos`: `medio_pago`, `tipo_cuenta`, `alias_cuenta`, `nro_cuenta`, `nombre_titular`, `ci_titular`. En el frontend, toggle Efectivo/Transferencia. Si Transferencia, sub-toggle Alias / Nro de Cuenta. Alias muestra un solo campo de texto. Nro de Cuenta muestra: número de cuenta, nombre completo, CI.

**Tech Stack:** React 19, Supabase (PostgreSQL), Tailwind CSS, Lucide Icons

---

## Resumen de cambios

| Archivo | Tipo | Qué cambia |
|---|---|---|
| `supabase/add_medio_pago_gastos_fijos.sql` | CREATE | Migración SQL: 6 columnas nuevas |
| `src/components/Cuentas.jsx` | MODIFY | State, modal "Programar Gasto Fijo", modal "Pagar Servicio", tarjeta del gasto fijo |

---

### Task 1: Crear migración SQL para nuevas columnas

**Objective:** Agregar columnas `medio_pago`, `tipo_cuenta`, `alias_cuenta`, `nro_cuenta`, `nombre_titular`, `ci_titular` a `gastos_programados` y `gastos`.

**Files:**
- Create: `supabase/add_medio_pago_gastos_fijos.sql`

**Step 1: Escribir el archivo SQL**

```sql
-- Agregar columnas de medio de pago y datos bancarios a gastos_programados
ALTER TABLE public.gastos_programados
ADD COLUMN IF NOT EXISTS medio_pago TEXT NOT NULL DEFAULT 'transferencia'
CHECK (medio_pago IN ('transferencia', 'efectivo'));

ALTER TABLE public.gastos_programados
ADD COLUMN IF NOT EXISTS tipo_cuenta TEXT
CHECK (tipo_cuenta IS NULL OR tipo_cuenta IN ('alias', 'nro_cuenta'));

ALTER TABLE public.gastos_programados
ADD COLUMN IF NOT EXISTS alias_cuenta TEXT;

ALTER TABLE public.gastos_programados
ADD COLUMN IF NOT EXISTS nro_cuenta TEXT;

ALTER TABLE public.gastos_programados
ADD COLUMN IF NOT EXISTS nombre_titular TEXT;

ALTER TABLE public.gastos_programados
ADD COLUMN IF NOT EXISTS ci_titular TEXT;

-- Agregar las mismas columnas a gastos (registro histórico del pago)
ALTER TABLE public.gastos
ADD COLUMN IF NOT EXISTS medio_pago TEXT NOT NULL DEFAULT 'transferencia'
CHECK (medio_pago IN ('transferencia', 'efectivo'));

ALTER TABLE public.gastos
ADD COLUMN IF NOT EXISTS tipo_cuenta TEXT
CHECK (tipo_cuenta IS NULL OR tipo_cuenta IN ('alias', 'nro_cuenta'));

ALTER TABLE public.gastos
ADD COLUMN IF NOT EXISTS alias_cuenta TEXT;

ALTER TABLE public.gastos
ADD COLUMN IF NOT EXISTS nro_cuenta TEXT;

ALTER TABLE public.gastos
ADD COLUMN IF NOT EXISTS nombre_titular TEXT;

ALTER TABLE public.gastos
ADD COLUMN IF NOT EXISTS ci_titular TEXT;
```

**Step 2: Ejecutar en Supabase SQL Editor**

El usuario copia este SQL y lo ejecuta en el SQL Editor de Supabase.
Verificación:
```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name IN ('gastos_programados', 'gastos')
AND column_name IN ('medio_pago', 'tipo_cuenta', 'alias_cuenta', 'nro_cuenta', 'nombre_titular', 'ci_titular');
```
Deben aparecer 12 filas (6 por tabla).

---

### Task 2: Agregar state y campos en modal "Programar Gasto Fijo"

**Objective:** Agregar toggle medio de pago, sub-toggle tipo de cuenta, y campos de datos bancarios al formulario de crear/editar gasto fijo.

**Files:**
- Modify: `src/components/Cuentas.jsx`

**Step 1: Agregar variables de estado** (junto a las demás del bloque fijo, ~línea 73)

```jsx
const [fijoMedioPago, setFijoMedioPago] = useState('transferencia');
const [fijoTipoCuenta, setFijoTipoCuenta] = useState('alias');
const [fijoAliasCuenta, setFijoAliasCuenta] = useState('');
const [fijoNroCuenta, setFijoNroCuenta] = useState('');
const [fijoNombreTitular, setFijoNombreTitular] = useState('');
const [fijoCiTitular, setFijoCiTitular] = useState('');
```

**Step 2: Actualizar `resetFormFijo`** (~línea 314) para limpiar los nuevos campos

Agregar al final de la función:
```jsx
setFijoMedioPago('transferencia');
setFijoTipoCuenta('alias');
setFijoAliasCuenta('');
setFijoNroCuenta('');
setFijoNombreTitular('');
setFijoCiTitular('');
```

**Step 3: Actualizar `abrirEdicionFijo`** (~línea 303) para cargar los nuevos campos

Agregar después de `setFijoParaQuien(f.para_quien);`:
```jsx
setFijoMedioPago(f.medio_pago || 'transferencia');
setFijoTipoCuenta(f.tipo_cuenta || 'alias');
setFijoAliasCuenta(f.alias_cuenta || '');
setFijoNroCuenta(f.nro_cuenta || '');
setFijoNombreTitular(f.nombre_titular || '');
setFijoCiTitular(f.ci_titular || '');
```

**Step 4: Agregar los campos en el JSX del modal** (~línea 1958, antes del `<button type="submit"`)

```jsx
{/* ── MEDIO DE PAGO ── */}
<div className="space-y-1">
  <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Medio de Pago</label>
  <div className="flex p-1 bg-white/5 rounded-2xl border border-white/5">
    <button
      type="button"
      onClick={() => setFijoMedioPago('transferencia')}
      className={`flex-1 py-2.5 text-[9px] font-black uppercase rounded-xl transition-all ${
        fijoMedioPago === 'transferencia' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'
      }`}
    >
      Transferencia
    </button>
    <button
      type="button"
      onClick={() => setFijoMedioPago('efectivo')}
      className={`flex-1 py-2.5 text-[9px] font-black uppercase rounded-xl transition-all ${
        fijoMedioPago === 'efectivo' ? 'bg-amber-600 text-white shadow-lg' : 'text-slate-500'
      }`}
    >
      Efectivo
    </button>
  </div>
</div>

{/* ── DATOS DE CUENTA (solo si Transferencia) ── */}
{fijoMedioPago === 'transferencia' && (
  <>
    {/* Sub-toggle: Alias vs Nro de Cuenta */}
    <div className="space-y-1">
      <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Tipo de Cuenta</label>
      <div className="flex p-1 bg-white/5 rounded-2xl border border-white/5">
        <button
          type="button"
          onClick={() => setFijoTipoCuenta('alias')}
          className={`flex-1 py-2.5 text-[9px] font-black uppercase rounded-xl transition-all ${
            fijoTipoCuenta === 'alias' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'
          }`}
        >
          Alias / CBU
        </button>
        <button
          type="button"
          onClick={() => setFijoTipoCuenta('nro_cuenta')}
          className={`flex-1 py-2.5 text-[9px] font-black uppercase rounded-xl transition-all ${
            fijoTipoCuenta === 'nro_cuenta' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'
          }`}
        >
          Nro. de Cuenta
        </button>
      </div>
    </div>

    {/* Campos según tipo */}
    {fijoTipoCuenta === 'alias' ? (
      <div className="space-y-1">
        <label className="text-[10px] font-bold text-indigo-400 uppercase ml-1 flex items-center gap-1">
          <Hash size={12} /> Alias / CBU
        </label>
        <input
          type="text"
          placeholder="Ej: mi.alias.banco"
          value={fijoAliasCuenta}
          onChange={(e) => setFijoAliasCuenta(e.target.value)}
          className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500/50"
        />
      </div>
    ) : (
      <>
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-indigo-400 uppercase ml-1 flex items-center gap-1">
            <Hash size={12} /> Número de Cuenta
          </label>
          <input
            type="text"
            placeholder="Ej: 001-123456-00"
            value={fijoNroCuenta}
            onChange={(e) => setFijoNroCuenta(e.target.value)}
            className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500/50"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Nombre Completo</label>
            <input
              type="text"
              placeholder="Titular de la cuenta"
              value={fijoNombreTitular}
              onChange={(e) => setFijoNombreTitular(e.target.value)}
              className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500/50"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">CI / Documento</label>
            <input
              type="text"
              placeholder="Ej: 1234567"
              value={fijoCiTitular}
              onChange={(e) => setFijoCiTitular(e.target.value)}
              className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500/50"
            />
          </div>
        </div>
      </>
    )}
  </>
)}
```

**Step 5: Actualizar `guardarGastoFijo`** para incluir los nuevos campos

En el objeto del insert (~línea 263-274), agregar:
```jsx
medio_pago: fijoMedioPago,
tipo_cuenta: fijoMedioPago === 'transferencia' ? fijoTipoCuenta : null,
alias_cuenta: fijoMedioPago === 'transferencia' && fijoTipoCuenta === 'alias' ? fijoAliasCuenta.trim() : null,
nro_cuenta: fijoMedioPago === 'transferencia' && fijoTipoCuenta === 'nro_cuenta' ? fijoNroCuenta.trim() : null,
nombre_titular: fijoMedioPago === 'transferencia' && fijoTipoCuenta === 'nro_cuenta' ? fijoNombreTitular.trim() : null,
ci_titular: fijoMedioPago === 'transferencia' && fijoTipoCuenta === 'nro_cuenta' ? fijoCiTitular.trim() : null,
```

En el objeto del update (~línea 249-257), agregar lo mismo.

---

### Task 3: Actualizar modal "Pagar Servicio" con datos de cuenta

**Objective:** Mostrar los datos de cuenta guardados en el modal de pago, permitir cambiar medio de pago al momento de registrar, y guardar todo en el gasto.

**Files:**
- Modify: `src/components/Cuentas.jsx`

**Step 1: Agregar variable de estado para medio de pago en el modal de pago** (~línea 80)

```jsx
const [pagarMedioPago, setPagarMedioPago] = useState('transferencia');
```

**Step 2: Actualizar `abrirPagoFijo`** (~línea 323) para precargar

Agregar después de `setPagarParaQuien(f.para_quien);`:
```jsx
setPagarMedioPago(f.medio_pago || 'transferencia');
```

**Step 3: Agregar campos en el JSX del modal de pago** (~línea 2018, antes del `<button type="submit"`)

```jsx
{/* ── MEDIO DE PAGO ── */}
<div className="space-y-1">
  <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Medio de Pago</label>
  <div className="flex p-1 bg-white/5 rounded-2xl border border-white/5">
    <button
      type="button"
      onClick={() => setPagarMedioPago('transferencia')}
      className={`flex-1 py-2.5 text-[9px] font-black uppercase rounded-xl transition-all ${
        pagarMedioPago === 'transferencia' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'
      }`}
    >
      Transferencia
    </button>
    <button
      type="button"
      onClick={() => setPagarMedioPago('efectivo')}
      className={`flex-1 py-2.5 text-[9px] font-black uppercase rounded-xl transition-all ${
        pagarMedioPago === 'efectivo' ? 'bg-amber-600 text-white shadow-lg' : 'text-slate-500'
      }`}
    >
      Efectivo
    </button>
  </div>
</div>

{/* ── DATOS DE CUENTA GUARDADOS (solo lectura, si Transferencia) ── */}
{pagarMedioPago === 'transferencia' && gastoFijoAPagar?.tipo_cuenta === 'alias' && gastoFijoAPagar?.alias_cuenta && (
  <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl px-4 py-3">
    <p className="text-[9px] font-bold text-indigo-400 uppercase tracking-wider mb-1">Alias / CBU para transferir</p>
    <p className="text-sm font-black text-white">{gastoFijoAPagar.alias_cuenta}</p>
  </div>
)}

{pagarMedioPago === 'transferencia' && gastoFijoAPagar?.tipo_cuenta === 'nro_cuenta' && gastoFijoAPagar?.nro_cuenta && (
  <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl px-4 py-3 space-y-2">
    <div>
      <p className="text-[9px] font-bold text-indigo-400 uppercase tracking-wider">Nro. de Cuenta</p>
      <p className="text-sm font-black text-white">{gastoFijoAPagar.nro_cuenta}</p>
    </div>
    {gastoFijoAPagar.nombre_titular && (
      <div>
        <p className="text-[9px] font-bold text-indigo-400 uppercase tracking-wider">Titular</p>
        <p className="text-sm font-black text-white">{gastoFijoAPagar.nombre_titular}</p>
      </div>
    )}
    {gastoFijoAPagar.ci_titular && (
      <div>
        <p className="text-[9px] font-bold text-indigo-400 uppercase tracking-wider">CI / Documento</p>
        <p className="text-sm font-black text-white">{gastoFijoAPagar.ci_titular}</p>
      </div>
    )}
  </div>
)}

{/* ── AVISO EFECTIVO ── */}
{pagarMedioPago === 'efectivo' && (
  <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 flex items-center gap-2">
    <span className="text-lg">💵</span>
    <p className="text-[10px] font-bold text-amber-400 uppercase">Pago en efectivo — no requiere datos de cuenta</p>
  </div>
)}
```

**Step 4: Actualizar `registrarPagoGastoFijo`** (~línea 338) para incluir todos los campos

Agregar al objeto insert:
```jsx
medio_pago: pagarMedioPago,
tipo_cuenta: gastoFijoAPagar?.tipo_cuenta || null,
alias_cuenta: gastoFijoAPagar?.alias_cuenta || null,
nro_cuenta: gastoFijoAPagar?.nro_cuenta || null,
nombre_titular: gastoFijoAPagar?.nombre_titular || null,
ci_titular: gastoFijoAPagar?.ci_titular || null,
```

---

### Task 4: Mostrar datos de cuenta en la tarjeta del gasto fijo

**Objective:** Mostrar resumen de los datos de cuenta en la tarjeta, visible sin abrir modales.

**Files:**
- Modify: `src/components/Cuentas.jsx`

**Step 1: Agregar display debajo de la línea de categoría** (~línea 1560)

Reemplazar el `<p>` de categoría actual con un bloque que incluya los datos:

```jsx
<p className="text-[10px] text-slate-500 font-bold uppercase mt-1 tracking-tighter">
  Categoría: {f.categoria} • Vence el: {f.dia_recurrencia} de cada mes • {f.para_quien === 'Ambos' ? 'Familia' : `Para: ${f.para_quien}`}
</p>
{f.medio_pago === 'transferencia' && (
  <p className="text-[9px] text-indigo-400/80 font-bold mt-0.5 flex items-center gap-1">
    {f.tipo_cuenta === 'alias' && f.alias_cuenta && (
      <><Hash size={10} /> Alias: {f.alias_cuenta}</>
    )}
    {f.tipo_cuenta === 'nro_cuenta' && f.nro_cuenta && (
      <><Hash size={10} /> Cta: {f.nro_cuenta} {f.nombre_titular ? `• ${f.nombre_titular}` : ''}</>
    )}
  </p>
)}
{f.medio_pago === 'efectivo' && (
  <p className="text-[9px] text-amber-400/80 font-bold mt-0.5 flex items-center gap-1">
    💵 Pago en efectivo
  </p>
)}
```

---

### Task 5: Verificar build y lint

**Objective:** Confirmar que no hay errores de compilación ni lint.

**Step 1: Correr linter**
```bash
npm run lint
```
Expected: sin errores nuevos (puede haber warnings preexistentes).

**Step 2: Correr build**
```bash
npm run build
```
Expected: build exitoso.

---

## Validación funcional

1. Crear gasto fijo con medio "Transferencia" → tipo "Alias" → alias "mi.alias.banco"
   - Tarjeta debe mostrar: "Alias: mi.alias.banco"
2. Crear gasto fijo con medio "Transferencia" → tipo "Nro de Cuenta" → nro "001-123456-00", titular "Juan Pérez", CI "1234567"
   - Tarjeta debe mostrar: "Cta: 001-123456-00 • Juan Pérez"
3. Crear gasto fijo con medio "Efectivo"
   - Tarjeta debe mostrar: "💵 Pago en efectivo"
4. Abrir "Pagar Servicio" de un gasto con alias → debe mostrar recuadro azul con el alias
5. Abrir "Pagar Servicio" de un gasto con nro cuenta → debe mostrar recuadro azul con nro, titular y CI
6. Cambiar a "Efectivo" en modal de pago → aviso amarillo, sin datos de cuenta
7. Confirmar pago → el registro en `gastos` debe tener todos los campos correctos
8. Editar gasto fijo → los campos deben precargarse correctamente

## Riesgos

- **Columnas nuevas con DEFAULT:** `medio_pago` tiene default 'transferencia', el resto son null. Registros existentes no se rompen.
- **RLS:** No se necesitan cambios — son columnas nuevas en tablas con RLS ya configurado.
- **Complejidad del form:** El modal "Programar Gasto Fijo" crece. Se mantiene usable con show/hide condicional (solo se ven los campos relevantes según el toggle activo).
