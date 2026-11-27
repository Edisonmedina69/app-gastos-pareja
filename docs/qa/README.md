# Verificación de formularios y escritorio

Pruebas funcionales en Orca y capturas finales con Chromium headless mediante
Playwright, autorizado por el coordinador, con datos sintéticos y sin conexión a
Supabase. El servidor optativo de QA y los comandos reproducibles están en
[qa/README.md](../../qa/README.md). La comparación anterior usa las fuentes y el
CSS compilado del commit `bac4f70` con las mismas fixtures.

| Ancho | Comprobaciones funcionales | Dashboard | Formularios | Libro Mayor |
| --- | --- | --- | --- | --- |
| 390 px | 33 pasan | 1 columna | pantalla con acción fija | lista |
| 768 px | 33 pasan | 2 columnas | pantalla con acción fija | lista |
| 1440 px | 33 pasan | 3 indicadores, 2 paneles | editor y resumen lateral | tabla |
| 1920 px | 30 pasan | 4 indicadores, 2 paneles | editor de ancho limitado y resumen lateral | tabla fluida |

Se comprobaron altas, precarga por URL, edición y eliminación de deudas, tarjetas,
gastos fijos, previsiones e ingresos programados. También altas de gastos e
ingresos manuales y su edición de monto y eliminación desde Libro Mayor, registro
de abonos, pagos de gastos fijos, compras con tarjeta y edición del medio de pago.
Los pagos y compras conservan las operaciones que ya ofrecía la aplicación; no se
agregan nuevas operaciones de reversión de cuotas.

Las 24 comprobaciones adicionales incluyen mínimos de 12 px y ausencia de
desborde en seis pantallas a los tres anchos, contraste con axe-core, atrás del
navegador, vuelta desde una URL directa y visibilidad por rol. El botón demo está
oculto para el usuario común y visible para superadmin; las altas administrativas
son pantallas propias y quedan protegidas por el shell. No se crean cuentas en
esta prueba. La consola no registró errores de aplicación.

El audit de contraste revisa 18 combinaciones de pantalla y ancho sin infracciones
detectadas; cuatro mediciones de botones fijos quedaron indeterminadas por
superposición en axe y se verificaron por sus colores computados: contraste
mínimo 5,48:1 (umbral AA 4,5:1). El audit fija las animaciones en su opacidad final dentro de la fixture para
medir colores estables. No constituye una auditoría integral de WCAG ni una prueba
de los permisos, contratos o transacciones reales de Supabase.

Validación local: `npm run lint`, `npm test` (43 tests) y `npm run build` pasan.
La versión aislada del primer PR también pasó los tres comandos.

Los resultados completos están en [resultados.json](resultados.json) y
[adicionales.json](adicionales.json).

| Captura | Antes | Después |
| --- | --- | --- |
| Dashboard 390 | [ver](antes-dashboard-390.png) | [ver](despues-dashboard-390.png) |
| Dashboard 768 | [ver](antes-dashboard-768.png) | [ver](despues-dashboard-768.png) |
| Dashboard 1440 | [ver](antes-dashboard-1440.png) | [ver](despues-dashboard-1440.png) |
| Dashboard 1920 | [ver](antes-dashboard-1920.png) | [ver](despues-dashboard-1920.png) |
| Gasto manual 390 | [ver](antes-gasto-390.png) | [ver](despues-gasto-390.png) |
| Gasto manual 768 | [ver](antes-gasto-768.png) | [ver](despues-gasto-768.png) |
| Gasto manual 1440 | [ver](antes-gasto-1440.png) | [ver](despues-gasto-1440.png) |
| Gasto manual 1920 | [ver](antes-gasto-1920.png) | [ver](despues-gasto-1920.png) |

Libro Mayor: [390](despues-libro-390.png), [768](despues-libro-768.png),
[1440](despues-libro-1440.png), [1920](despues-libro-1920.png).

Formulario largo (deuda, paso 3 y opciones avanzadas):
[390](despues-deuda-390.png), [768](despues-deuda-768.png),
[1440](despues-deuda-1440.png), [1920](despues-deuda-1920.png).

## Seguimiento de ancho completo y revisión de diseño

Se quitó el max-width del shell y del contenedor de contenido: a 1920 px el main
ocupa los 1680 px que deja la sidebar fija de 240 px, con cuatro indicadores de
396 px. A 1440 px el main ocupa 1200 px y muestra tres indicadores. Los formularios
conservan su medida máxima para lectura. Las medidas de los cuatro anchos, sin
scroll horizontal, están en [layout-fluido.json](layout-fluido.json).

Las fechas vacías de la captura inicial eran un defecto de la fixture. El esquema
real define `gastos.fecha DEFAULT now()` (`supabase/schema.sql:65`), pero el mock
solo completaba `created_at`. Ahora replica ese default para gastos e ingresos.
La comprobación añadida del Libro Mayor exige fechas no vacías en la fixture y
en todas las filas de la tabla. No se modificaron consultas, datos ni formateadores
productivos. El flujo completo a 1920 px pasa, sumando 129 comprobaciones
funcionales registradas.

El pulido y sus decisiones se documentan en [revision-diseno.md](revision-diseno.md).
Las skills copiadas están en un commit separado (`116d6b4`). Lint, los 43 tests y
build pasan; la consola de la nueva pasada no presenta errores.

La captura de Orca se bloqueó con `the browser page did not draw a frame`.
El coordinador autorizó Chromium headless como alternativa: las 24 capturas de
esta carpeta ya están renovadas a página completa, con locale `es-PY` y zona
`America/Asuncion`. Dashboard, Libro Mayor, gasto manual y el formulario largo
se comprobaron a 390/768/1440/1920 px sin scroll horizontal; la tabla muestra
fecha válida en sus siete filas. No hubo errores de consola ni peticiones
externas. El recibo es [capturas-playwright.json](capturas-playwright.json).
Playwright se instaló fuera del repositorio, sin modificar sus dependencias.
