# Comprobantes: contrato mínimo pendiente de implementar

El plan exige comprobantes verificados en servidor para pagos personales, financiación, reembolsos y retiros. El PR #36 original acepta esos movimientos sin archivo: `comprobante_id` es opcional y no tiene FK. Las correcciones de permisos e idempotencia no resuelven esta condición. **No habilitar esos flujos en producción hasta implementar este contrato o decidir explícitamente su postergación.** El coordinador consulta al dueño; no se eliminan ni bloquean definitivamente en esta preparación.

## Circuito y responsabilidades

1. Reservar por RPC con sesión vigente, contexto esperado y permiso efectivo de la operación concreta. Crear `org_adjuntos` con destino tesorería, finalidad comprobante, espacio, autor, nombre saneado, MIME permitido y tamaño máximo de 10 MiB; ruta aleatoria bajo `espacio_id/adjunto_id`. Estado inicial pendiente. No aceptar rutas arbitrarias del cliente.
2. Subir a bucket **privado**, sin sobrescritura. Storage RLS comprueba la reserva, su autor y membresía vigente en ese espacio. Solo aceptar PDF/JPEG/PNG; no confiar en la extensión ni en el MIME declarado.
3. Confirmar en servidor (Edge Function o servicio de confianza), validando JWT/sesión, membresía/contexto y permisos de nuevo. Descargar del bucket, comprobar firma del formato y tamaño real, calcular hash y marcar listo con fecha de verificación; los clientes no pueden escribir estado/verificación. El `service_role` queda exclusivamente en servidor. No registrar tokens, URLs firmadas ni contenido del archivo en auditoría.
4. Registrar la operación con `p_comprobante_id` obligatorio: lock de contexto → espacio → reserva, verificar listo y destino/finalidad/espacio, consumir en la misma transacción que cabecera, apuntes y deuda. Añadir FK compuesta `(espacio_id,comprobante_id)` y unicidad para impedir cruces y reutilización. Un fallo SQL no consume el comprobante ni deja movimientos parciales. Transferencias internas sin pago externo siguen su regla específica del plan.
5. El hash de idempotencia incluye el comprobante y el contenido económico. Un reintento exacto por el mismo actor devuelve el ID original incluso si el comprobante ya está consumido por esa operación; otra clave o contenido no puede reaprovecharlo. Validar permisos actuales antes de devolver el reintento.
6. Lectura por permiso financiero y pertenencia vigentes, con URLs firmadas breves emitidas en servidor. Una reversión conserva el archivo consumido; no lo libera ni permite reutilizarlo. Limpieza solo de reservas pendientes/descartadas vencidas, con locks compatibles con confirmación/consumo; nunca borrar adjuntos consumidos.

## Cambio en el cliente

Los tres formularios reservan/suben/verifican antes de enviar la operación, muestran el estado y permiten reintentar con la misma clave y archivo. Cambio de espacio, baja, pérdida de permiso o cierre de sesión interrumpen la confirmación; volver al espacio original permite retomar si la reserva y los permisos siguen vigentes. No mostrar éxito hasta confirmar el commit del libro.

## Evidencia necesaria antes de habilitar

Probar sin adjunto, sin objeto, MIME falso, archivo truncado o >10 MiB; archivo ajeno/de otro espacio; reserva duplicada/consumida; permiso revocado y cambio de espacio entre cada paso; fallo SQL después del lock; doble consumo concurrente, reintento idéntico y clave con otro contenido; limpieza contra confirmación/consumo; reversión que conserva archivo; lectura denegada tras baja. Deben quedar cero movimientos ante cada rechazo y un solo conjunto de apuntes ante reintentos/carreras.

Se requiere migración incremental separada si tesorería ya fue aplicada: comprobar catálogo/historial primero. No reescribir migraciones desplegadas ni usar `db push` indiscriminadamente.
