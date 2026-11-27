# Plan: modo organización para CaninDevs

**Estado: propuesta para aprobación del dueño; no autoriza implementación ni despliegue.**
Alcance: tesorería operativa para 5 integrantes o más, comprobantes, compromisos, cobros y cuentas; no reemplaza la contabilidad fiscal del contador. Este PR cambia únicamente este documento.

## 1. Punto de partida verificado

Lecturas: [arquitectura](ARQUITECTURA.md), [estrategia](ESTRATEGIA_PRODUCTO.md), [schema](../supabase/schema.sql), [advertencias de migración](../supabase/migrations/README.md), migración P0 y código de `src/app/App.jsx`, `features/hogar/hooks/useHogar.js`, `features/ingresos/lib/sueldosProgramados.js`, `features/deudas/components/modales/ModalPagarFijo.jsx`, `features/historial/components/Historial.jsx` y servicios de hogar, gastos programados y cotizaciones.

- `espacios.limite_usuarios` es un entero con default 2, no un enum 1/2. La restricción práctica está en altas, configuración y UI; subirlo a 5 no resuelve el modelo de pareja.
- `perfiles.id` referencia Auth y guarda un solo `espacio_id`; roles actuales: `superadmin`, `admin_hogar`, `miembro`. P0 protege cambios de espacio/rol y serializa altas; las RPC actuales son `crear_espacio(text,text)` y `unirse_a_espacio(text,text)`.
- `useHogar` elige un `otroUsuario` y ejecuta acreditaciones automáticas de salarios. Fijos se identifican por texto `[FIJO]`; las cuentas bancarias actuales son datos del destinatario, no cajas con saldo. Los ingresos existentes son personales.
- La navegación usa `activeTab`, sin router instalado; ya existe exportación `xlsx`. El servicio de cotizaciones devuelve 1 ante errores: no es aceptable para nuevos movimientos USD/BRL.
- El encabezado del schema combina catálogo de producción del 26/11/2026 con políticas P0 que entonces estaban pendientes. También registra ausencia de publicación Realtime e índices secundarios. **No se verificó el catálogo vivo:** esta sesión no expone el MCP Supabase anunciado; la comprobación de solo lectura es una condición previa del PR 1, no una afirmación de estado actual.

## 2. Convivencia y decisiones propuestas

Agregar `espacios.tipo text NOT NULL DEFAULT 'hogar' CHECK IN ('hogar','organizacion')`; todos los espacios existentes siguen siendo hogares. Conservar `nombre_familia` por compatibilidad, presentado como «Nombre» en organización, y `moneda_principal` como moneda base. Nuevas organizaciones: límite inicial 10 (incluye administrador), ampliable por administración autorizada; nunca cambiar el límite de hogares existentes.

Propuesta sujeta a aprobación: primera versión conserva **un espacio por identidad Auth**. Un socio que ya usa la app con su familia necesitará otra identidad para la organización; no se lo desvinculará automáticamente. Confirmar esta limitación antes de aprobar: compartir la misma identidad entre hogar y empresa requiere otro diseño de membresías, selector de espacio y RLS, en un plan previo independiente.

Roles empresariales en `org_miembros`, separados del rol global `perfiles.rol`: `admin`, `miembro`, `contador`, `lectura`. El creador sigue con perfil compatible `admin_hogar`, pero solo la membresía empresarial autoriza acciones de organización; `superadmin` no se puede obtener por invitación ni por email del cliente. No interpretar `admin_hogar` como permiso empresarial.

Las tablas empresariales tendrán prefijo `org_`. No reutilizar tablas heredadas `cuentas_maestras`/`cuentas_pendientes`, ni escribir gastos/ingresos de empresa en tablas familiares. Separar sesión/perfil de `useHogar` y montar el cargador empresarial según `tipo`, sin ejecutar sus tareas automáticas, reparto de pareja, salud familiar o IA familiar en organizaciones.

## 3. Modelo de datos propuesto

Convenciones: tablas nuevas con `id uuid PK`, `espacio_id uuid NOT NULL FK espacios`, `created_at timestamptz`; importes `numeric(20,6)`, tasas `numeric(20,10)`, nunca float. Monedas restringidas a PYG/USD/BRL. `?` indica nullable; resto obligatorio salvo defaults indicados. Cada padre empresarial expone `UNIQUE(espacio_id,id)`; cada referencia empresarial usa FK compuesta `(espacio_id,parent_id)` para impedir cruces de espacio. Autoría referencia perfiles y se conserva por baja lógica; no borrar socios ni registros financieros en cascada.

| Tabla / cambio | Columnas de dominio |
|---|---|
| `espacios` | `tipo` nuevo; conservar `nombre_familia`, `moneda_principal`, `limite_usuarios`; validar moneda/límite de organizaciones en servidor. Moneda base inmutable después del primer asiento. |
| `org_miembros` | `usuario_id uuid FK perfiles`, `rol`, `activo boolean DEFAULT true`; UNIQUE `(espacio_id,usuario_id)`. Se crea junto al perfil vinculado y se valida esa coincidencia. |
| `org_invitaciones` | `token_hash text UNIQUE`, `rol`, `vence_at timestamptz`, `max_usos int DEFAULT 1`, `usos int DEFAULT 0`, `revocada_at?`, `creada_por uuid`. Nunca almacenar token claro. |
| `org_terceros` | `tipo proveedor/cliente/ambos`, `nombre text`, `ruc text?`, `contacto text?`, `activo boolean`. |
| `org_categorias` | `nombre text`, `tipo gasto/ingreso`, `activo boolean`; UNIQUE `(espacio_id,tipo,nombre)`. Semillas: facturas/compras, hosting/servidores, contador, multas SET/DNIT, SaaS; implementación y mensualidades. |
| `org_cuentas` | `nombre text`, `tipo banco/billetera/efectivo/socio`, `moneda`, `titular_miembro_id uuid? FK org_miembros`, `referencia text?`, `activa boolean`; titular obligatorio para tipo socio. Una cuenta por moneda; saldo calculado, no editable. |
| `org_compromisos` | `tipo gasto/ingreso`, `modalidad unico/cuotas/recurrente`, `concepto text`, `tercero_id uuid?`, `categoria_id uuid`, `proyecto text?`, `monto numeric`, `moneda`, `frecuencia_meses int?` (1/3/12), `inicio date`, `fin date?`, `dia_vencimiento int?`, `cantidad_cuotas int?`, `creado_por uuid`, `activo boolean`. Para ingresos exigir cliente; para cuotas monto es total contratado y calendario explícito suma ese total. |
| `org_periodos` | `compromiso_id uuid`, `periodo date` (primer día del mes de competencia), `numero int DEFAULT 1`, `vencimiento date`, `importe numeric`, `moneda`, `tasa_base_prevista numeric`, `categoria_id uuid`, `tercero_nombre text?`, `tercero_ruc text?`, `nro_factura text?`, `timbrado text?`, `emitida_el date?`, `anulado_at?`. UNIQUE `(espacio_id,compromiso_id,periodo,numero)`; snapshot de importe, categoría y datos de factura. |
| `org_operaciones` | `tipo pago/cobro/transferencia/financiacion_socio/reembolso_socio/retiro_socio/apertura/ajuste/reversion`, `fecha_efectiva date`, `registrado_por uuid`, `idempotencia uuid`, `reversa_de uuid? UNIQUE`, `motivo text?`; UNIQUE `(espacio_id,idempotencia)`. Cabecera inmutable de la operación atómica. |
| `org_pagos` | `periodo_id uuid`, `operacion_id uuid UNIQUE`, `cuenta_id uuid`, `responsable_miembro_id uuid`, `importe_aplicado numeric` (moneda del período), `importe_cuenta numeric`, `tasa_base numeric`, `importe_base numeric`, `fuente_tasa text`, `fecha_tasa timestamptz`. Sirve tanto para pago de gasto como cobro de ingreso; dirección determinada por compromiso, nunca por texto. |
| `org_apuntes` | `operacion_id uuid`, `cuenta_id uuid`, `importe_firmado numeric` (moneda de cuenta), `tasa_base numeric`, `importe_base_firmado numeric`, `fuente_tasa text`, `fecha_tasa timestamptz`. Libro de caja; todos los cambios de saldo tienen asiento. |
| `org_movimientos_socios` | `operacion_id uuid`, `miembro_id uuid`, `clase prestamo/reembolso/retiro/devolucion/apertura/ajuste`, `moneda`, `importe_deuda_firmado numeric`, `tasa_base numeric`, `importe_base_firmado numeric`. Positivo: empresa debe al socio; negativo: socio debe a empresa. No deriva de quién hizo clic en pagar. |
| `org_adjuntos` | `periodo_id uuid`, `pago_id uuid?`, `object_path text UNIQUE`, `nombre_original text`, `mime text`, `bytes bigint`, `subido_por uuid`, `estado pendiente/listo/eliminado`. Si hay pago, su período debe coincidir mediante FK compuesta adicional. |
| `org_auditoria` | `actor_id uuid?`, `entidad text`, `entidad_id uuid`, `accion text`, `cambios jsonb` (campos permitidos, sin tokens ni URLs firmadas). Solo escritura del servidor; incluir cambios de roles, anulaciones y conciliaciones. |

Restricciones/índices: importes de compromisos/períodos/pagos positivos, tasas mayores que cero (1 para moneda base), apuntes no cero; categoría compatible con tipo y organización comprobado en servidor. Índices en FK, `org_miembros(usuario_id,activo)`, `(espacio_id,periodo)`, `(espacio_id,vencimiento)`, `(espacio_id,cuenta_id)` y operaciones por fecha. Estados/saldos son vistas calculadas con permisos de invocador, no duplicados editables.

### Períodos, pagos e ingresos

`org_periodos` es la tabla propia del estado mensual: vista `org_estado_periodos` suma pagos efectivos y presenta `pendiente/pagado` en gastos o `pendiente/cobrado` en ingresos, junto a importe abonado y saldo; un abono parcial sigue pendiente. La plantilla no se marca pagada. Fijos trimestrales/anuales generan filas solo en su mes exigible; no repartir artificialmente un pago anual entre 12 meses. El mes de competencia y la fecha real de caja se filtran por separado, en zona `America/Asuncion`.

Generación de calendario por RPC explícita y repetible, horizonte inicial de 12 meses; UNIQUE evita duplicados entre sesiones. Día 31 cae en el último día de meses cortos. Editar una plantilla afecta solo períodos futuros sin pagos y con confirmación; no reescribe comprobantes ni historial. Cancelar deja evidencia y no borra pagos. No acreditar mensualidades automáticamente al abrir la app.

Implementación: un compromiso por cliente/proyecto, único o con cuotas numeradas, vencimientos e importes explícitos. Mensualidad: otro compromiso recurrente por cliente. «Por cobrar» consulta períodos de ingresos con saldo positivo, con filtros de cliente, mes y vencidos. Un pago no puede superar el pendiente; anticipos/créditos a favor quedan fuera de esta versión.

### Cuentas, socios y moneda

Saldo de cuenta = suma de sus apuntes, incluido saldo inicial mediante operación de apertura fechada. Nunca importar el saldo bancario personal completo: una «cuenta de socio X» representa **solo fondos empresariales bajo su custodia**. No guardar credenciales bancarias. Alertar saldo insuficiente y exigir confirmación/motivo para excepciones, sin inventar dinero.

- Cobrar 1.000.000 PYG en cuenta de Ana aumenta custodia empresarial de Ana a 1.000.000; no genera deuda a su favor.
- Si Ana paga 200.000 con esos fondos: custodia queda 800.000, deuda sigue cero.
- Si Ana paga 100.000 con dinero personal: una RPC registra financiación +100.000 en cuenta de socio y +100.000 de deuda, seguida del gasto −100.000. Caja neta no cambia y empresa debe 100.000; todo en una transacción, con operaciones relacionadas en auditoría. Miembro puede usar este flujo solo como parte del pago personal propio; no obtiene permiso general para financiar, transferir o ajustar deudas.
- Reembolsar esos 100.000 desde caja empresarial reduce caja y deuda, sin repetir gasto. Un retiro personal aumenta lo que el socio debe, sin clasificarlo como gasto operativo. Aportes de capital/distribución de utilidades quedan fuera hasta decisión del dueño.

Reporte por socio muestra **tres columnas separadas**: fondos de empresa en custodia (cuentas), deuda de empresa al socio y deuda del socio a empresa (movimientos de deuda). No compensarlas silenciosamente. Saldos iniciales de caja y deuda se concilian por separado con el dueño.

Una operación normal exige moneda de cuenta = moneda del período. Para pagar una factura USD desde PYG, registrar primero cambio entre cuentas PYG y USD y luego el pago USD, enlazados/atómicos desde el formulario; puede usarse una cuenta USD de tránsito con saldo final cero. Transferencia: dos apuntes de signo opuesto, una cabecera; misma moneda conserva importe, distinta moneda guarda ambos importes y tasa real. Comisiones son un gasto separado, nunca diferencia escondida. Transferencias no son ingresos ni gastos.

Cada apunte conserva moneda de su cuenta, tasa **unidades de moneda base por 1 unidad de origen**, importe base y fecha/fuente; cada pago conserva los mismos datos. La tasa de previsión del período es independiente de la tasa efectiva del pago. Entrada manual confirmada si falla la sugerencia externa; prohibido usar el fallback 1 para USD/BRL. No recalcular historia con la cotización actual. Redondear al presentar: PYG 0 decimales, USD/BRL 2; validar precisión admitida al registrar. Reportes de saldo muestran original y equivalente histórico; cambio entre monedas puede tener diferencia de valoración explícita, sin alterar ingresos operativos.

## 4. Autorización, RLS y comprobantes

| Acción | Admin | Miembro | Contador | Lectura |
|---|---|---|---|---|
| Ver finanzas, comprobantes y exportar | Sí | Sí | Sí | Sí |
| Registrar gastos/ingresos, pagar/cobrar y adjuntar | Sí | Sí | Sí | No |
| Configurar categorías, terceros y recurrencias | Sí | No | Sí | No |
| Cuentas, transferencias, deuda de socios y conciliación | Sí | No | Sí | No |
| Anular/revertir registros contabilizados | Sí | No | Sí | No |
| Invitar, revocar, roles, límite y configuración | Sí | No | No | No |

Snapshots de períodos con pagos se protegen en servidor. Registros contabilizados no se editan ni borran: reversión referenciada y nuevo registro. Solo admin puede desactivar miembros; impedir eliminar o degradar el último administrador, incluso en concurrencia. Baja revoca acceso inmediatamente sin perder historia. Salir del espacio debe desactivar membresía de forma atómica; una membresía activa requiere también `perfiles.espacio_id` coincidente para no heredar acceso tras salir.

- RLS habilitada antes de exponer tablas. Lectura exige `espacio_id = (SELECT mi_espacio_id())`, espacio de tipo organización y membresía activa; escritura agrega permiso por rol. `USING` y `WITH CHECK` en modificaciones. Helpers no recursivos, índices de pertenencia y `search_path = ''` en funciones elevadas.
- Catálogos pueden tener escritura directa con RLS por rol; membresías, invitaciones, períodos y libro financiero se modifican solo por RPC con grants mínimos. Una RPC `SECURITY DEFINER` valida explícitamente identidad, rol, espacio y todos los padres; no confía en RLS del propietario. Revocar ejecución a `PUBLIC`/`anon`; ninguna service key en navegador.
- RPC nuevas `crear_organizacion`, `aceptar_invitacion_org`, `cambiar_rol_org`, `registrar_pago_org`, `transferir_org`, `revertir_org`, `generar_periodos_org`. Mantener firmas y comportamiento de RPC de hogar; `unirse_a_espacio` debe rechazar destino organización para impedir bypass por el código legado. Altas bloquean fila de espacio y perfil; aceptación bloquea además invitación, valida expiración/usos/límite, asigna rol fijado por admin e incrementa usos una sola vez. Reintento del mismo miembro es idempotente; no permitir mover a quien ya pertenece a otro espacio.
- Código/link comparten token aleatorio de alta entropía; servidor guarda hash, vence (propuesta 7 días), usos y revocación. Link `/invitacion#token=...`, retenido solo durante registro/login, eliminado del URL al consumir; nunca enviar a analítica/logs. Sin consulta anónima de espacios por código; limitar intentos en endpoint servidor. No enviar invitaciones automáticamente en este proyecto.
- Las políticas actuales `FOR ALL` en tablas familiares no implementan roles empresariales. Agregar una guarda **restrictiva de tipo hogar** en tablas financieras legadas y sus RPC para organizaciones; una política permisiva adicional no restringe las anteriores. Revisar también vías de superadmin, servicios y tareas automáticas. No cambiar acceso familiar normal.
- Bucket privado `org-comprobantes`; path `<espacio_uuid>/<periodo_uuid>/<adjunto_uuid>.<ext>`. Políticas `storage.objects` de SELECT exigen membresía/espacio vigente y metadato listo correspondiente; INSERT exige rol escritor y metadato pendiente reservado en ese espacio/período. Validar carpeta, bucket y relación real, no solo prefijo suministrado. UPDATE/upsert deshabilitado; sustitución crea otro objeto. DELETE solo admin/contador mediante flujo auditado.
- PDF/JPEG/PNG/WebP, máximo propuesto 10 MiB por archivo, validar tamaño y contenido/MIME en servidor. Originales descargables por URL firmada corta (propuesta 60 s), nunca públicas; no cachear archivos/URLs en la PWA. Una URL ya firmada vive hasta expirar aunque se quite al miembro.
- Storage y Postgres no comparten transacción: reservar metadato → subir → verificar objeto y confirmar `listo`. Mostrar fallo y reintento; no marcar comprobante presente hasta completar. Limpieza de pendientes huérfanos tras 24 h por tarea privilegiada limitada. Pago válido puede quedar «sin comprobante» y completarse luego; factura adjunta al período y recibo adjunto al pago.

## 5. Pantallas y flujos

Añadir router en un PR aislado, manteniendo pantallas familiares y navegación atrás. Pantallas empresariales separadas en `features/organizacion`, `tesoreria`, `compromisos`, `reportes`; servicios solo en `src/services`, reglas puras en `features/*/lib`, UI compartida existente. No cargar el libro entero al iniciar: consultas por espacio/mes y paginación; refresco tras mutaciones, sin depender de Realtime aún no verificado.

| Ruta propuesta | Flujo |
|---|---|
| `/crear-organizacion`, `/invitacion` | Registrarse/iniciar sesión → nombre/moneda → crear como admin; aceptar código/link → confirmar organización y rol. Explicar conflicto si ya tiene hogar. |
| `/org/resumen` | Mes, comprometido/pagado, cobrado/por cobrar, saldos de caja y próximos vencimientos. |
| `/org/integrantes`, `/org/invitaciones/nueva` | Lista de 5 o más miembros, roles, invitar, revocar y desactivar. |
| `/org/gastos`, `/org/gastos/nuevo`, `/org/periodos/:id` | Concepto, categoría, proveedor/RUC, moneda/monto, factura/timbrado opcionales, adjunto, vencimiento; guardar pendiente o registrar pago con cuenta y pagador. |
| `/org/recurrentes`, `/org/recurrentes/nuevo` | Frecuencia mensual/trimestral/anual y calendario; matriz por mes con pendiente/pagado. |
| `/org/ingresos/nuevo`, `/org/por-cobrar` | Cliente/proyecto → implementación única/cuotas o mensualidad → calendario → registrar cobro con cuenta y comprobante. |
| `/org/periodos/:id/pagar`, `/org/periodos/:id/cobrar` | Pantalla de abono, fecha, cuenta, responsable, cambio y recibo; distinguir fondos de empresa de pago personal del socio. |
| `/org/cuentas`, `/org/cuentas/nueva`, `/org/cuentas/:id`, `/org/transferencias/nueva`, `/org/socios` | Apertura, movimientos, transferir/cambiar moneda y saldos separados de custodia/deuda. |
| `/org/terceros`, `/org/categorias`, `/org/reportes` | Catálogos, filtros de mes/categoría/cliente/cuenta y descarga Excel. |

Formularios largos como páginas, con secciones, validación junto al campo y guardado explícito. Modales solo para confirmaciones breves. Móvil: 44 px táctiles, inputs de 16 px, sin scroll horizontal global; permisos aplicados en servidor y controles acordes en UI. Al fallar subida o conexión, conservar el formulario y permitir reintento idempotente.

Reportes: totales por competencia/mes y categoría desde períodos; comprometido vs pagado aplicado a esos períodos y pendientes; cobros/pagos efectivos por fecha para flujo de caja; saldo inicial + entradas − salidas = saldo final por cuenta. Separar transferencias internas, financiación/reembolsos y variación cambiaria de actividad operativa. No sumar un pago dos veces desde `org_pagos` y `org_apuntes`. Excel con hojas Resumen, Compromisos, Pagos, Cuentas, Socios: IDs, moneda original, tasa, base, competencia/fecha y filtros; mismo conjunto completo filtrado que reporte, sin limitar a la página visible ni exportar URLs firmadas; textos como celdas de texto para evitar fórmulas.

## 6. Entrega en PR pequeños (solo después de aprobar este plan)

Cada PR de implementación incluye criterios verificados, migración/rollback cuando corresponda y actualización de schema/documentación. Checks comunes: lint, unitarios de reglas y build; SQL de permisos/transacciones en entorno aislado; regresión familiar. No probar con datos de familias reales.

| PR | Entrega y aceptación |
|---|---|
| 1. Base compatible | Contrastar catálogo/políticas/RPC/Storage/Realtime en solo lectura y corregir divergencias antes de migrar; revisar P0 y establecer baseline del historial. Agregar `tipo`, membresía, RLS y guardas legadas. Todos los hogares conservan filas, límites y acceso; organización no accede a tablas familiares; sin UI pública todavía. |
| 2. Acceso empresarial | RPC de creación, invitación, bajas y roles; rutas de alta/integrantes y separación del cargador familiar. Crear organización y unir 5 usuarios; probar sexto si límite permite, límite concurrente, token vencido/revocado y último admin. Sin duplicados, escalamiento de rol ni cambio accidental de hogar. |
| 3. Tesorería mínima | Cuentas, operaciones, apuntes y deuda de socios con RPC atómicas, auditoría y reversión. Apertura, transferencia PYG/USD/BRL y pago personal simulado concilian; doble envío produce una operación; rol lectura y miembro no transfieren. |
| 4. Facturas y pagos | Terceros, categorías, compromisos únicos/períodos, pagos y Storage. Registrar hosting USD y factura PYG con PDF/imagen, proveedor/RUC y cuenta; pendientes no afectan caja, pagos sí. Dos usuarios pagando simultáneamente no exceden saldo pendiente; ajenos no leen ni suben comprobantes; fallos de subida se recuperan. |
| 5. Fijos por período | Generación mensual/trimestral/anual y tabla mensual de estados. Renombrar concepto no altera estado; dos sesiones generan una sola obligación; enero y febrero son independientes; parcial queda pendiente; día 31/año bisiesto/cancelación probados. |
| 6. Clientes y cobros | Implementación única/en cuotas, mensualidades y «por cobrar». Cuotas suman contrato, no se acredita por fecha ni al iniciar sesión; cobro parcial reduce deuda correcta y aumenta cuenta una sola vez. |
| 7. Reportes y Excel | Resumen, flujo y socios; totales coinciden con libro/competencia y Excel con más de una página. Monedas y transferencias no inflan ventas/gastos; prueba E2E completa y regresión familiar aprobadas antes de habilitar piloto. |

Migración no destructiva: agregar sin renombrar/eliminar tablas o columnas existentes, sin conversión automática de hogares ni copia de transacciones por prefijos. Ensayar en base aislada obtenida de esquema auditado: las migraciones históricas **no crean una base desde cero**. Según [README de migraciones](../supabase/migrations/README.md), producción carecía de historial y hay SQL histórico destructivo: no ejecutar `db push` antes de verificar baseline y marcar únicamente lo realmente aplicado. Backup restaurable, comparación de conteos/agregados y pruebas de aislamiento antes/después; acordar ventana para locks y permisos.

Piloto habilitado por lista de espacios desde servidor, inicialmente solo QA; activación real requiere aprobación del dueño y autorización separada de despliegue. Rollback preferido: apagar modo organización/UI conservando tablas, adjuntos e historial; mantener lectura/exportación administrativa para rescate. No ejecutar rollback que borre datos financieros; backfill de `tipo='hogar'` deja valores existentes intactos. Ningún PR habilita organizaciones a través del circuito familiar por accidente.

### Prueba de punta a punta obligatoria en QA

1. Usar noviembre de 2026 para el caso de caja y enero/febrero de 2027 para fijos. Registrar admin y crear **CaninDevs (QA)**, base PYG, límite 10; unir cuatro usuarios adicionales por código y link: admin, dos miembros, contador y lectura. Con una sexta identidad comprobar ampliación de equipo; con otro hogar comprobar aislamiento. Registrar explícitamente que un usuario con hogar no se mueve a la organización.
2. Abrir caja PYG con 1.000.000, cuenta USD con 100 y «Cuenta de Ana» PYG con cero; guardar saldos iniciales. Cargar factura de compra de 200.000 PYG con proveedor/RUC/número/timbrado y PDF, y hosting de USD 20 con imagen y tasa QA fija de 7.500 PYG/USD (también para apertura USD). Pagar compra desde caja y hosting desde USD; validar responsables, adjuntos y separación por espacio.
3. Crear contador mensual 300.000 PYG, SaaS trimestral USD 30 y servicio anual USD 120. Generar dos veces el calendario; pagar solo contador de enero: febrero pendiente, SaaS/anual solo en meses exigibles. Renombrar concepto y comprobar estados intactos.
4. Crear implementación de 3.000.000 PYG en tres cuotas de 1.000.000 y mensualidad de cliente de 500.000 PYG; cobrar primera cuota en «Cuenta de Ana» y dejar mensualidad pendiente. «Por cobrar» muestra 2.500.000 para ese conjunto de períodos generados; siguientes mensualidades se prueban aparte.
5. Ana paga multa DNIT de 100.000 PYG con fondos personales: custodia sigue 1.000.000 y deuda a Ana sube a 100.000. Reembolsar desde caja: caja queda 700.000 y deuda cero; transferir 400.000 de cuenta Ana a caja: custodia Ana 600.000, caja 1.100.000, USD 80. Transferencia/reembolso no crean otro gasto ni ingreso; gastos realizados suman 450.000 base (compra 200.000 + hosting 150.000 + multa 100.000), excluyendo el pago de contador del paso 3, que se verifica en otro mes.
6. Verificar reportes por competencia y fecha, caja y deuda por socio; exportar Excel y reconciliar esos importes. Probar BRL con tasa QA explícita, reversión, abono parcial, doble clic/carrera, sesión de lectura intentando escribir vía API, FK cruzada, tokens inválidos y acceso directo a Storage ajeno. Ningún intento no autorizado cambia filas/objetos.
7. Regresión hogar de dos integrantes en la misma base QA: crear/unirse, gasto compartido, fijo, salario programado, deudas, historial, exportación y cierre de sesión. Conservar comportamiento familiar y confirmar que entrar a organización no dispara acreditaciones salariales.

## 7. Riesgos y decisiones del dueño

Riesgos principales: divergencia del schema con producción/P0; pérdida de aislamiento por RPC elevadas o políticas permisivas legadas; confundir custodia con financiación personal; diferencias de cambio y redondeo; objetos huérfanos o enlaces aún válidos; alcance creciente hacia contabilidad fiscal. Las etapas anteriores ponen una prueba y una condición de salida a cada uno.

Preguntas para aprobar (defaults propuestos):

- ¿Aceptamos una identidad distinta para quien ya tiene hogar, o exigimos multi-espacio antes del piloto?
- ¿Todos ven finanzas y comprobantes, incluido lectura, con permisos de la matriz?
- ¿PYG base, límite inicial 10, invitaciones de 7 días y archivos de hasta 10 MiB?
- ¿Qué saldos iniciales y deudas personales reconocen los socios? ¿Cuándo son préstamos y cuándo capital/utilidades? Estos últimos se posponen.
- ¿Permitimos guardar pagos sin comprobante para completarlo luego? Propuesta: sí, con indicador visible.

Aprobación requerida: dueño valida este documento y las respuestas; después se abren PR de implementación por etapa. Este PR no aplica migraciones, no crea usuarios QA ni modifica producción.
