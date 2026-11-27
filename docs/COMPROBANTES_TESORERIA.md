# Comprobantes de tesorería (item 54)

Complemento incremental de #36, ya fusionado. Pago personal/financiación, reembolso y retiro requieren comprobante privado verificado y consumido en la misma transacción que los apuntes y la deuda. Transferencias internas conservan su contrato previo. No se agregan capital, utilidades ni saldos iniciales; PYG sigue siendo base y USD/BRL requieren tasa explícita. No se cambian cuentas demo ni roles del item 48.

## Circuito implementado

1. `reservar_comprobante_org` revalida sesión/contexto/permisos y socio activo. Crea `org_adjuntos` pendiente, vinculado a tipo de operación y socio, con ruta aleatoria `<espacio>/tesoreria/<id>.<ext>`, nombre saneado, PDF/JPEG/PNG y máximo 10 MiB. Límite de 30 reservas vigentes por autor y espacio.
2. Subida sin sobrescritura al bucket privado `org-comprobantes`. RLS exige reserva propia pendiente y permiso efectivo. Políticas restrictivas impiden que una política permisiva ajena abra lectura, modificación o borrado de este bucket. No se permiten UPDATE/upsert ni DELETE del cliente.
3. La Edge `comprobantes` valida el JWT contra Auth. Obtiene la reserva con el JWT del usuario, descarga realmente el objeto desde Storage en servidor y limita la lectura a 10 MiB. Comprueba tamaño, firma y cierre PDF/JPEG, estructura y cierre PNG, y calcula SHA-256. `confirmar_comprobante_servidor_org`, exclusiva de `service_role`, vuelve a comprobar sesión/contexto/permisos y metadatos reales de `storage.objects`, guardando ID/versión/hash. No confía en rutas, hashes o MIME del body del cliente. No es un escáner antivirus ni un validador completo de documentos PDF.
4. Las RPC financieras reciben `p_comprobante_id` obligatorio. El hash de idempotencia incluye el comprobante. Tras revalidar permisos y resolver el reintento exacto, bloquean la reserva, exigen estado listo, autor/tipo/socio/espacio correctos y objeto real sin cambios; consumen y contabilizan atómicamente. Un fallo económico revierte también el consumo. CHECK, FK compuesta, unicidad y triggers impiden asociación ausente, cruzada o reutilizada; un trigger diferido impide consumo sin operación.
5. Las firmas anteriores se eliminan. Un frontend cacheado o una petición sin comprobante falla cerrado sin escribir dinero. Una reversión conserva el archivo consumido y no lo libera.
6. Para leer, Edge comprueba contexto, membresía y `finanzas.ver` + `socios.ver` mediante `obtener_lectura_comprobante_org`, y emite una URL firmada de 60 segundos. El cliente no tiene SELECT directo de Storage ni puede emitir URLs de mayor duración. Una revocación impide generar nuevos enlaces; un enlace ya emitido conserva su vigencia máxima de 60 segundos. No se guardan URLs firmadas, JWT, secretos ni contenido de archivos en auditoría o logs.

Los formularios permiten subir/verificar antes de confirmar, muestran errores y reintentan con la reserva y clave originales. Una pérdida del acuse de subida se recupera verificando el objeto existente, sin sobrescribirlo. Cambiar de socio crea un circuito separado; cambiar de espacio/cerrar sesión interrumpe la continuación. Al volver, el selector recupera reservas propias pendientes/listas mediante RPC, sin persistir archivos en el navegador. El historial de socios ofrece consulta privada en móvil y escritorio.

## Conservación y limpieza

`descartar_comprobante_org` solo descarta reservas propias no consumidas. `descartar_reservas_vencidas_org` es exclusiva de servidor y marca descartadas reservas pendientes/listas de más de 24 horas, no referenciadas, con `FOR UPDATE SKIP LOCKED`. Tras su commit, un operador/tarea de confianza puede borrar **solo los paths retornados** usando la API de Storage. No se instaló un scheduler: la limpieza puede ejecutarse operativamente; omitirla retiene archivos y nunca habilita reutilización. El trigger de Storage rechaza también borrados privilegiados de archivos no descartados y cualquier sustitución. Una limpieza fallida puede reintentar el DELETE de un descartado; nunca toca consumidos.

## Validación reproducible

```bash
bash supabase/tests/run_etapa3.sh
npm run lint
npm test
npm run build
python3 supabase/releases/preparar_tesoreria.py --check
```

El runner usa exclusivamente Docker efímero, Auth/Storage/Edge reales y datos ficticios. Ejecuta regresión de etapa 2, los 58 checks previos de tesorería y tres carreras antes del complemento; luego pruebas reales de formatos, truncados, tamaño, ausencia de objeto, metadatos falsificados por cliente, permisos, cruces de espacio, idempotencia/doble consumo concurrente, fallo SQL, lectura privada, revocación/baja, sustitución/borrado, reversión y limpieza vencida. Dos carreras adicionales prueban consumo contra descarte en ambos órdenes. E2E prueba los tres formularios, subida interrumpida/reintento y lectura autorizada a 390/768/1440/1920 px; capturas en `docs/qa/comprobantes-form-*.png` y `etapa3-org-*.png`.

Comprueba rollback sin perder datos, P0 y equivalencia de catálogo **public y recursos propios de Storage** entre migraciones, `schema.sql` y la entrega atómica desde M6. `comprobantes_reset_schema.sql` es destructivo y **exclusivamente para el contenedor efímero**; no forma parte de ningún payload de producción.

Aplicación, hashes, precondiciones y verificación no destructiva: [APLICACION_ITEM54_TESORERIA.md](APLICACION_ITEM54_TESORERIA.md).
