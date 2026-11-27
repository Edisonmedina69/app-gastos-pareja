# Verificación de interfaz aislada

Este servidor sustituye `useHogar` y los servicios por datos sintéticos en
`sessionStorage`. Bloquea la carga del cliente de Supabase y no necesita `.env`.
No está conectado al `vite.config.js` de la aplicación ni al build de producción.
El mock sirve para comprobar la interfaz; no prueba contratos ni permisos reales
de Supabase.

```bash
npx vite --config qa/vite.config.js --port 5173
npx vite --config qa/vite.config.js --mode before --port 5174
```

El modo `before` sirve las fuentes del commit `bac4f70`, manteniendo las mismas
fixtures. Abrir ambos servidores con `orca tab create --url ... --json` y usar sus
IDs para ejecutar la prueba en el navegador de Orca:

```bash
QA_BROWSER_PAGE=<pagina-5173> QA_BEFORE_PAGE=<pagina-5174> python3 qa/browser-check.py 390
QA_BROWSER_PAGE=<pagina-5173> QA_BEFORE_PAGE=<pagina-5174> python3 qa/browser-check.py 768
QA_BROWSER_PAGE=<pagina-5173> QA_BEFORE_PAGE=<pagina-5174> python3 qa/browser-check.py 1440
```

`ORCA_CLI_COMMAND` selecciona la CLI instalada por Orca. El script guarda las
comprobaciones y capturas en `docs/qa`. Las confirmaciones y los prompts cortos se
aceptan mediante un stub del navegador durante esta prueba. Los formularios se
rellenan por eventos DOM reales de React y se envían con validación HTML.

La edición y eliminación de gastos e ingresos en la tabla y la lista se verifican
con `python3 qa/browser-ledger-check.py` (las mismas variables de páginas).

Para la revisión adicional de tipografía, contraste con axe-core, navegación y
visibilidad por rol:

```bash
npm pack axe-core --pack-destination /tmp --silent
# Sustituir la versión por la que devuelve el comando anterior.
tar -xOf /tmp/axe-core-4.14.1.tgz package/axe.min.js > qa/axe.min.cjs
QA_BROWSER_PAGE=<pagina-5173> python3 qa/browser-a11y-check.py
rm qa/axe.min.cjs
```

El audit fija la opacidad final de las animaciones en la fixture antes de medir
el contraste, porque el navegador embebido puede suspender los cuadros en segundo plano. Se revisan las reglas de contraste de texto; no representa una
certificación de accesibilidad de toda la aplicación.

Para renovar las capturas y medir que el shell llene el ancho a 390, 768, 1440 y
1920 px, ejecutar después del flujo CRUD:

```bash
QA_BROWSER_PAGE=<pagina-5173> QA_BEFORE_PAGE=<pagina-5174> python3 qa/browser-layout-check.py 1920
```

Se puede pasar cualquiera de los cuatro anchos o ejecutar sin argumento para
revisarlos todos. Registra medidas en `docs/qa/layout-fluido.json`, verifica que
la tabla no tenga fechas vacías y renueva las capturas de Dashboard, gasto manual
y Libro Mayor. Usa capturas completas para evitar la suspensión de cuadros de
algunas ventanas de Orca en segundo plano.

## Capturas con Chromium headless

Cuando el navegador de Orca no dibuja cuadros para sus capturas, se puede usar
el fallback autorizado de Playwright contra los mismos servidores de QA. No es
una dependencia de la aplicación: instalarlo en una carpeta temporal y señalar
el módulo y el ejecutable de Chromium que ya esté instalado:

```bash
npm install --prefix /tmp/gastos-playwright --no-save playwright
PLAYWRIGHT_MODULE=file:///tmp/gastos-playwright/node_modules/playwright/index.mjs \
CHROMIUM_EXECUTABLE="$HOME/.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell" \
node qa/capture-playwright.mjs
```

El script guarda 24 capturas completas: Dashboard anterior/actual, gasto manual
anterior/actual, Libro Mayor y deuda con opciones avanzadas, a los cuatro anchos.
Comprueba fechas no vacías, ancho fluido, ausencia de scroll horizontal, errores
de consola y peticiones externas. El recibo guarda locale y zona horaria.
