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
