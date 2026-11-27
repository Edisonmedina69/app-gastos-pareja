# Arquitectura del frontend

```
src/
├── main.jsx                  # punto de entrada
├── app/                      # shell: App, layout y navegación
│   ├── App.jsx
│   ├── navegacion.js         # secciones de la barra lateral
│   └── layout/               # HeaderMovil, Sidebar, Navegacion (barra inferior)
├── features/<dominio>/       # una carpeta por área de negocio
│   ├── components/           # pantallas y piezas de UI del dominio
│   ├── hooks/                # estado y efectos del dominio
│   └── lib/                  # reglas puras (sin red), con tests *.test.js
├── services/                 # ÚNICA capa que habla con Supabase o APIs externas
└── shared/                   # código sin dominio
    ├── lib/                  # formatters y utilidades
    ├── ui/                   # componentes visuales reutilizables
    └── hooks/
```

## Dominios

| Feature | Qué contiene |
|---|---|
| `auth` | Login, demo instantánea y cierre de sesión global |
| `hogar` | `useHogar` (sesión, perfil, datos, tiempo real y tareas automáticas), verificación de perfil y roles, vincular o crear un hogar |
| `dashboard` | Inicio, ingreso mágico con IA y cálculo de salud financiera |
| `deudas` | Deudas Pro, gastos fijos y previsiones; ciclos de tarjeta y alertas de vencimiento |
| `ingresos` | Ingresos variables y fijos, historial salarial y acreditación de sueldos |
| `historial` | Libro de transacciones y exportación a Excel |
| `asistente` | Chat con la IA |
| `admin` | Panel de superadmin |

## Reglas

1. **Solo `src/services/` importa `supabaseClient.js`.** Componentes y hooks usan funciones de dominio (`listarGastos`, `actualizarCuota`, …). Para encontrar una regla que la rompa:
   `grep -rn "supabaseClient\|@supabase" src | grep -v "^src/services/"`
2. Los servicios devuelven `{ data, error }`, igual que Supabase. Cada uno replica una consulta existente; no agregan lógica.
3. La lógica de negocio pura va en `features/*/lib` y lleva tests (`npm test`, con `node:test`).
4. Un servicio no importa nada de `features/`. Las operaciones que combinan reglas y varias llamadas (por ejemplo, `cerrarCicloTarjeta`) viven en `features/<dominio>/lib`.

## Comandos

```bash
npm run dev     # desarrollo
npm run lint    # ESLint
npm test        # tests unitarios (node --test)
npm run build   # build de producción
```

## UI compartida y tokens

- **Tokens** en `src/index.css`: variables OKLCH (`--background`, `--primary`, `--muted-foreground`, …) expuestas a Tailwind como `bg-primary`, `text-muted-foreground`, `border-border`, etc., con soporte de opacidad (`bg-primary/20`). La app arranca en modo oscuro (`<html class="dark">`); la paleta clara ya está definida para cuando todas las pantallas usen tokens.
- **Tipografía:** escala Major Third (1.250) sobre 16 px (`text-micro`, `text-title-sm|md|lg`).
- **`src/shared/ui`:** `Button`, `IconButton`, `Input`, `Select`, `Label`, `Field`, `Card`, `Badge`, `Skeleton`, `Modal` y `SegmentedControl`. Todos tienen estados hover, focus-visible, active, disabled y carga.
- **`Modal`:** en celular es una hoja inferior y desde `sm` un diálogo centrado. Cierra con Escape o tocando el fondo, bloquea el scroll del fondo y gestiona el foco.

### Reglas mobile-first

- Objetivos táctiles de **44 px** o más. Lo garantiza una regla global para `pointer: coarse` en `index.css`, y además los componentes usan `min-h-touch`.
- Inputs con letra de **16 px** o más (`text-base`), para evitar el zoom de iOS.
- **Sin scroll horizontal:** los grupos de pestañas tienen scroll propio (`SegmentedControl`).
- **Navegación inferior** en celular (`app/layout/Navegacion.jsx`) y barra lateral desde `lg`. Ambas respetan `env(safe-area-inset-*)`.
- Respeta `prefers-reduced-motion`.

### Deudas Pro

`Cuentas.jsx` solo orquesta pestañas, filtros y qué modal está abierto. Cada modal de `features/deudas/components/modales/` maneja su propio formulario: sus valores iniciales salen de `lib/formularios.js`, que tiene tests. Las tarjetas y las listas son componentes aparte.

## Navegación y formularios

`main.jsx` monta `BrowserRouter`. El shell deriva la sección de la URL y conserva
la misma instancia de cada dominio entre su listado y sus formularios. Las URLs
se resuelven con los datos del hogar cargado, sin depender de objetos efímeros en
`history.state`: `/deudas/nueva`, `/deudas/:id/editar`,
`/deudas/:id/abonos/:cuotaId`, `/deudas/:id/compras/nueva`,
`/deudas/:id/medio-pago`, `/gastos/nuevo`, `/fijos/nuevo`,
`/fijos/:id/editar`, `/fijos/:id/pagar`, `/fijos/:id/medio-pago`,
`/previsiones/nueva`, `/previsiones/:id/editar`, `/ingresos/nuevo`,
`/ingresos/programar` y `/ingresos/:id/editar`. También son pantallas las altas
administrativas de hogares y usuarios (`/admin/hogares/nuevo` y
`/admin/usuarios/nuevo`). Los permisos de administración se mantienen en el shell.

`FormPage` presenta el editor y su resumen, sin fondo modal ni bloqueo del
scroll; las acciones quedan al pie en móvil. Volver usa el historial cuando se
abrió desde la app y una ruta del dominio cuando se accedió directamente.
Las confirmaciones y las ediciones cortas conservan sus diálogos. El rewrite de
Vercel ya envía las rutas internas a `index.html`.
