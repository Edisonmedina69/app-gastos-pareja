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
