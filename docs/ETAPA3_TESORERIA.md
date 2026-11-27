# Etapa 3: Tesorería mínima

Implementa la **Etapa 3: Tesorería mínima** de [PLAN_ORGANIZACION.md](PLAN_ORGANIZACION.md) sobre la base de [ETAPA2_MULTI_ESPACIO.md](ETAPA2_MULTI_ESPACIO.md) y las correcciones de seguridad de [REVIEW_ETAPA2.md](REVIEW_ETAPA2.md). No aplica cambios en producción ni realiza merge sin autorización expresa del dueño.

> Preparación de continuación: main y M6 integrados; PR #36 conserva sus flujos de socios mientras el dueño decide el alcance de comprobantes. Falta la reserva/subida/verificación/consumo de archivos exigida por el plan: ver [COMPROBANTES_TESORERIA.md](COMPROBANTES_TESORERIA.md). Esa condición impide habilitarlos en producción; los checks técnicos por sí solos no autorizan aplicación.

## 1. Modelo de datos, inmutabilidad y seguridad (RLS / RPC)

La migración [20261129120000_etapa3_tesoreria_minima.sql](../supabase/migrations/20261129120000_etapa3_tesoreria_minima.sql) agrega el libro de tesorería y cuenta corriente de socios en una sola transacción con `lock_timeout = 5s` y `statement_timeout = 60s`:

- **Tablas empresariales (`org_cuentas`, `org_operaciones`, `org_apuntes`, `org_movimientos_socios`):**
  - Importes `numeric(20,6)`, tasas `numeric(20,10)`, monedas restringidas a `PYG`, `USD` y `BRL`.
  - Cada tabla padre expone `UNIQUE (espacio_id, id)` y cada referencia hija utiliza **FK compuesta** `(espacio_id, parent_id)` para impedir cruces de organización a nivel de motor Postgres.
  - **`org_cuentas`:** tipos `banco`, `billetera`, `efectivo` y `socio`. Para `tipo = 'socio'` el `titular_miembro_id` es obligatorio (`CHECK` + FK compuesta a `espacio_miembros`); para los demás tipos debe ser `NULL`. Todas las cuentas arrancan en cero sin saldo inicial ni asiento de apertura.
  - **`org_operaciones`:** cabecera atómica con `tipo`, `fecha_efectiva`, `registrado_por`, `idempotencia` (`UNIQUE (espacio_id, idempotencia)`) y `solicitud_hash` (SHA-256 de la solicitud), `reversa_de` (`UNIQUE`, FK compuesta a `org_operaciones`) y `motivo`.
  - **`org_apuntes`:** libro de caja con `importe_firmado` (`<> 0`), `tasa_base` (`> 0`), `importe_base_firmado` (`<> 0`, mismo signo que `importe_firmado`), `fuente_tasa` y `fecha_tasa`.
  - **`org_movimientos_socios`:** libro de deuda de socios con `clase` (`prestamo`, `reembolso`, `retiro`, `devolucion`, `ajuste`), `moneda`, `importe_deuda_firmado` (positivo: la empresa le debe al socio; negativo: el socio le debe a la empresa / reduce deuda a su favor), `tasa_base` e `importe_base_firmado`.
- **Inmutabilidad del libro y moneda base:**
  - Los triggers `tr_inmutable_org_operaciones`, `tr_inmutable_org_apuntes` y `tr_inmutable_org_movimientos_socios` bloquean cualquier `UPDATE` o `DELETE` sobre registros contabilizados, incluso para roles privilegiados. Las correcciones se realizan exclusivamente mediante reversión referenciada (`revertir_org`).
  - `tr_proteger_cuenta_org` impide borrar cuentas o alterar su espacio, moneda, tipo o titular.
  - `tr_proteger_moneda_base_org` impide cambiar `espacios.moneda_principal` una vez que existe el primer asiento en `org_apuntes`.
- **Vistas calculadas con `security_invoker = true`:**
  - `org_saldos_cuentas`: calcula `saldo`, `saldo_base_historico` y `cantidad_movimientos` sumando `org_apuntes` y exige `mi_espacio_id()`, `tiene_permiso(espacio_id, 'finanzas', 'ver')` y `tiene_permiso(espacio_id, 'cuentas', 'ver')`.
  - `org_reporte_socios`: expone por socio y moneda las **tres columnas separadas** (`custodia`, `empresa_debe_al_socio`, `socio_debe_a_empresa` y sus equivalentes históricos base), sin compensarlas silenciosamente, exigiendo `finanzas.ver` y `socios.ver`.
- **Permisos y aislamiento:**
  - `REVOKE ALL` para `public`, `anon` y `authenticated` en todas las tablas y funciones nuevas; `authenticated` solo posee `SELECT` en las tablas/vistas (protegido por políticas restrictivas de sesión vigente `sesion_auth_id() IS NOT NULL` y `tiene_permiso`) y `EXECUTE` únicamente en las 6 RPC públicas.

## 2. RPC atómicas e idempotentes

Todas las RPC son `SECURITY DEFINER SET search_path = ''`, invocan `validar_contexto(p_espacio_id_esperado)`, bloquean la fila del espacio (`tipo = 'organizacion'`), verifican permisos efectivos por persona con `tiene_permiso`, validan padres en el mismo espacio, registran en `org_auditoria` y resuelven reintentos por `(espacio_id, idempotencia)` con el lock del espacio tomado. Solo devuelven el ID anterior si coinciden actor y solicitud; otra RPC, importe, cuenta, fecha, motivo o destino con la misma clave se rechaza. Los permisos se comprueban de nuevo antes de devolver el reintento:

1. **`crear_cuenta_org` y `actualizar_cuenta_org`:** requieren `cuentas.crear` y `cuentas.editar`/`cuentas.configurar` respectivamente. No ofrecen ni aceptan saldo de apertura.
2. **`transferir_org`:** requiere simultáneamente `cuentas.pagar` (salida) y `cuentas.cobrar` (entrada). Los roles `lectura` y `miembro` (e incluso `contador` por plantilla salvo que se le delegue `cuentas.pagar` y `cuentas.cobrar`) no pueden transferir.
   - En transferencias de la misma moneda conserva el importe.
   - En cambios entre `PYG`, `USD` y `BRL` exige ambos importes y tasa manual confirmada en unidades de `PYG` por `1` unidad de moneda origen/destino (`validar_importe_tasa_org` rechaza `tasa <= 1` en `USD`/`BRL`, impidiendo usar `1` como fallback).
   - Si el saldo calculado de la cuenta origen es insuficiente, aborta salvo que se confirme explícitamente la excepción (`p_confirmar_saldo_insuficiente = true`) con `p_motivo` obligatorio.
3. **`registrar_pago_personal_socio_org`:** registra en una sola operación (`tipo = 'financiacion_socio'`) la entrada de financiación (`+importe`) y la salida del gasto (`-importe`) en la cuenta de custodia del socio, más el movimiento de deuda (`clase = 'prestamo'`, `+importe`) a favor del socio. La custodia neta no cambia y la empresa pasa a deberle ese importe al socio. Quien tiene `gastos.pagar` puede registrar su propio pago personal; para otro socio exige además `socios.crear` o `socios.pagar`.
4. **`registrar_movimiento_socio_org`:** requiere `cuentas.pagar` y `socios.pagar`.
   - `reembolso_socio`: descuenta de la cuenta empresarial (`-importe`) y reduce lo que la empresa le debe al socio (`-importe`), verificando que no supere la deuda pendiente en esa moneda. La caja conserva la tasa efectiva del reembolso y la deuda cancela su valoración histórica proporcional; el último abono absorbe el redondeo. La diferencia de cambio queda explícita en auditoría, sin dejar deuda base residual cuando la moneda original queda saldada.
   - `retiro_socio`: descuenta de la cuenta empresarial (`-importe`) y aumenta lo que el socio debe a la empresa (`-importe`).
5. **`revertir_org`:** crea una operación `tipo = 'reversion'` con `reversa_de = p_operacion_id` (`UNIQUE`) y motivo obligatorio, insertando los contraasientos en `org_apuntes` y `org_movimientos_socios` con signo opuesto y las mismas tasas históricas. Exige exactamente `cuentas.anular` para transferencia, `gastos.anular` para pago personal (`financiacion_socio`) y `socios.anular` para reembolso/retiro. Otros tipos se deniegan por defecto. La UI aplica la misma matriz.

## 3. Pantallas y flujos de UI

- **Rutas en organización (`Organizacion.jsx`, `TesoreriaOrg.jsx`):**
  - `/org/cuentas`: posición consolidada por moneda (`PYG`, `USD`, `BRL` y equivalente histórico base) y tabla de cuentas con acceso al detalle y movimientos.
  - `/org/cuentas/nueva`: pantalla propia (`FormPage`) para crear cuentas de banco, billetera, efectivo o custodia de socio (con selector de titular activo), siempre en cero.
  - `/org/cuentas/:id`: detalle de cuenta con saldo calculado, equivalente base histórico, libro de apuntes y acción de reversión referenciada con modal de confirmación y motivo.
  - `/org/transferencias/nueva`: pantalla propia (`FormPage`) para transferencia de misma moneda o cambio `PYG`/`USD`/`BRL` con confirmación explícita de tasa manual, alerta de saldo insuficiente y clave de idempotencia por formulario.
  - `/org/socios`: reporte por socio con las **tres columnas separadas** (custodia, lo que la empresa le debe y lo que el socio le debe), historial de movimientos de deuda y formularios como pantalla propia para pago personal de socio, reembolso y retiro.

## 4. Verificación reproducible

```bash
bash supabase/tests/run_etapa3.sh
npm run lint
npm test
npm run build
```

Cobertura verificada en `run_etapa3.sh` (contenedor Supabase local efímero en puertos `55520–55527`, sin datos reales):
1. **Migración sobre baseline de Etapa 1 + Etapa 2 + correcciones de revisión + M6 incremental** y **regresión completa de Etapa 2 (`etapa2_multi_test.sql`, `etapa2_correcciones_test.sql`)**.
2. **Pruebas SQL de Tesorería (`etapa3_tesoreria_test.sql`)**: cuentas y socios en cero, validación de titular en cuentas de socio, rechazo de transferencia para roles `lectura`, `miembro` y `contador` sin `cuentas.pagar`/`cuentas.cobrar`, idempotencia ante doble envío, conflicto de clave con otro contenido/actor/RPC, permisos de reversión sin atajos por reintento, rechazo de NaN/infinito y precisión excesiva antes de redondear, conciliación de saldos y cambios `PYG`/`USD`/`BRL`, rechazo de tasa `1` o `NULL` en `USD`/`BRL`, pago personal de socio (custodia neta `0` + deuda `+100.000`), reembolso parcial, retiro de socio, inmutabilidad por trigger incluso para superusuario, reversión referenciada, aislamiento RLS y bloqueo de FK compuestas cruzadas entre espacios.
3. **E2E en navegador real con Playwright headless (`qa/etapa3-e2e.mjs`)**: creación de cuentas en cero, transferencia, cambio a USD con tasa manual confirmada, pago personal de socio, regresión del hogar original y capturas completas sin scroll horizontal ni errores de consola a **390, 768, 1440 y 1920 px** (`docs/qa/etapa3-org-*.png`).
4. **Concurrencia real (`etapa3_concurrencia.py`)**: doble transferencia idéntica, doble reversión y clave concurrente con importe distinto, verificando filas y conciliación.
5. **Rollback funcional y equivalencia de esquema**: verificación de `20261129120000_etapa3_tesoreria_minima.down.sql`, suite P0 antes y después del rollback, y `diff -u` exacto entre el catálogo migrado y `supabase/schema.sql`.

## 5. Plan de aplicación para el dueño (requiere su OK; no aplicado en prod)

1. **Precondición:** haber aplicado en producción la migración de correcciones de Etapa 2 (`20261128120000_etapa2_correcciones_revision.sql`, PR #35) y M6 incremental (`20261128130000_etapa2_m6_baja_invitaciones.sql`, PR #37), verificadas individualmente contra historial y catálogo. Orden de merge: #37 antes de #36 (ahora con base main). No se verificó ControlGastos en esta sesión; no hay MCP disponible.
2. **Backup y ventana:** confirmar backup restaurable y ventana breve de mantenimiento.
3. **Aplicar migración de Etapa 3:** ejecutar únicamente `supabase/migrations/20261129120000_etapa3_tesoreria_minima.sql`. Configura `lock_timeout = '5s'` y `statement_timeout = '60s'`; no modifica ninguna tabla ni política familiar (`gastos`, `ingresos_mensuales`, `deudas_maestras`, etc.).
4. **Desplegar frontend actualizado:** publica las pantallas `/org/cuentas`, `/org/cuentas/nueva`, `/org/cuentas/:id`, `/org/transferencias/nueva` y `/org/socios`.
5. **Verificación post-aplicación:**
   - Comprobar que los hogares existentes continúan operando sin cambios.
   - Con la organización piloto en QA, crear una cuenta en PYG y una en USD, verificar que ambas inician en `0`, probar una transferencia y comprobar el reporte de socios en tres columnas.
6. **Rollback funcional ante contingencia:** ejecutar `supabase/rollback/20261129120000_etapa3_tesoreria_minima.down.sql`. Revoca `EXECUTE` sobre las 6 RPC de escritura de tesorería para frenar nuevos movimientos empresariales, **conservando** `org_cuentas`, `org_operaciones`, `org_apuntes`, `org_movimientos_socios` y las vistas de lectura para auditoría y rescate sin borrar ningún dato financiero.
