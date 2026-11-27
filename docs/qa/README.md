# Verificación de formularios y escritorio

Pruebas en el navegador embebido de Orca con datos sintéticos, sin conexión a
Supabase. El servidor optativo de QA y los comandos reproducibles están en
[qa/README.md](../../qa/README.md). La comparación anterior usa las fuentes y el
CSS compilado del commit `bac4f70` con las mismas fixtures.

| Ancho | Comprobaciones funcionales | Dashboard | Formularios | Libro Mayor |
| --- | --- | --- | --- | --- |
| 390 px | 33 pasan | 1 columna | pantalla con acción fija | lista |
| 768 px | 33 pasan | 2 columnas | pantalla con acción fija | lista |
| 1440 px | 33 pasan | 3 indicadores, 2 paneles | editor y resumen lateral | tabla |

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
6,46:1 (mínimo AA 4,5:1). El audit fija las animaciones en su opacidad final dentro de la fixture para
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
| Gasto manual 390 | [ver](antes-gasto-390.png) | [ver](despues-gasto-390.png) |
| Gasto manual 768 | [ver](antes-gasto-768.png) | [ver](despues-gasto-768.png) |
| Gasto manual 1440 | [ver](antes-gasto-1440.png) | [ver](despues-gasto-1440.png) |

Libro Mayor: [390](despues-libro-390.png), [768](despues-libro-768.png),
[1440](despues-libro-1440.png).
