# Evidencia local de comprobantes, item 54

Validación del 27/11/2026, stack Docker efímero `etapa3-test-*`, sin producción ni datos reales.

- `bash supabase/tests/run_etapa3.sh`: exit 0. Baseline etapa 1 → etapa 2 → correcciones → M6 → tesorería; regresión etapa 2/correcciones; 58 checks previos de tesorería y tres carreras de idempotencia/reversión; P0.
- Complemento: 18 grupos reales Auth/RPC/Storage/Edge. Incluye PDF/PNG, archivos falsos/truncados, exceso de tamaño, reserva sin objeto, metadata/confirmación falsificada, cruce entre espacios, cambio de contexto y recuperación, fallo económico con reserva intacta, doble envío/doble consumo, enlaces privados de 60 s, revocación/baja/sesión cerrada, eliminación/upsert/sustitución, reembolso/retiro y reversión. Dos carreras con barreras SQL adicionales cubren consumo contra descarte en ambos órdenes. Limpieza exclusiva de servidor comprueba vencimiento de 24 h y conservación de consumidos/reservas vigentes.
- E2E real: pago personal, reembolso y retiro con archivo; interrupción deliberada de subida, error visible y reintento; lectura privada; hogar sin cambios. Capturas sin scroll horizontal a 390, 768, 1440 y 1920 px. Sin errores inesperados de consola; se excluyen únicamente los del fallo de red provocado deliberadamente.
- Rollback operativo: escrituras revocadas, evidencia y lectura conservadas, P0 posterior correcto.
- Catálogo equivalente entre migraciones, `schema.sql` y release atómica desde M6: tablas, constraints, funciones, ACL, RLS, índices y triggers public; bucket, políticas y trigger propios de Storage.
- `npm run lint`, `npm test` (50 tests), `npm run build`: exit 0. Build mantiene avisos previos de Browserslist antiguo y chunk principal >500 kB.
- Detector mecánico Impeccable sobre componentes cambiados: `[]`; revisión visual de captura móvil realizada.
- Migración de #36: byte a byte igual a `origin/main`; no se reescribió.

La limpieza destructiva del esquema del runner está limitada al contenedor efímero. Se ajustó a la protección interna de Storage contra DELETE SQL mediante una transacción local de fixture; el release de producción no contiene esa limpieza ni habilita borrado directo.

Hashes y secuencia de entrega: [APLICACION_ITEM54_TESORERIA.md](../APLICACION_ITEM54_TESORERIA.md). La sesión `fa1fb1cc-f34e-41d5-b45e-6a29d05b80c2` asumió la aplicación remota SQL/Edge; el worker prepara PR y no hace merge. La evidencia local no sustituye la verificación posterior de producción del ejecutor.
