# Aplicación de tesorería y comprobantes desde M6

El dueño autorizó implementar y aplicar tesorería con comprobantes. #36 ya está fusionado en `dc8c7f89a6eb2f237802cd446caffb422c8b7ca0`; no se modifica su migración. La entrega complementaria parte de ese main. Este documento no solicita otra autorización.

## Base y compatibilidad de transición

Según lectura remota comunicada por coordinación, ControlGastos `uyiyhmxezgekntyquksi` termina en M6: P0, etapa 1, etapa 2, correcciones #35 (`20261127174432`) y M6 #37 (`20261127174445`). No hay `org_cuentas` ni `org_adjuntos`. Releer historial y catálogo antes de aplicar: los timestamps reales anteriores difieren de los archivos y no se renumeran ni se vuelven a aplicar.

El frontend de #36 puede estar publicado antes de la base: el hogar conserva su backend, pero las consultas de tesorería empresarial fallan por tablas ausentes. Eso no mueve dinero. Aplicar **solo #36** expondría temporalmente RPC sin comprobante; por eso desde M6 se usa el payload atómico que instala #36 y el complemento bajo **un solo commit**, sin ventana para firmas antiguas. Después del commit, clientes cacheados sin comprobante reciben rechazo; el frontend complementario y la Edge habilitan los formularios completos.

Si ya existen tablas de tesorería, **no usar el payload desde M6**. El complemento incremental solo se puede aplicar tras auditar que no hay operaciones de socios previas sin evidencia; su precondición aborta ante ellas, sin fabricar archivos ni modificar historial.

## Fuentes y hashes SHA-256

Raíz absoluta: `/home/edisonubutun/orca/workspaces/app-gastos-pareja/continuar-seguridad-tesoreria/`.

| Archivo relativo a la raíz | SHA-256 |
| --- | --- |
| `supabase/migrations/20261129120000_etapa3_tesoreria_minima.sql` (#36, intacto) | `bfb2596332d24d5186284cec482428742dd144d603ab0999253f0b60a7e6b849` |
| `supabase/migrations/20261129130000_comprobantes_tesoreria.sql` | `f02feff22ccfbf13dab87a81c4e5aa402ea640ccff26aeea4610de440b18e291` |
| `supabase/releases/tesoreria_comprobantes_desde_m6.sql` | `8dfbfa277afa13b1728799a5e58b6edc3ff5a64ca54692fa65c4cfb4878197d1` |
| `supabase/rollback/20261129130000_comprobantes_tesoreria.down.sql` | `2870d6c2e0f5dd4efe49d332a28eb58bdee5363938da2e48171830cf5c506728` |

El generador `python3 supabase/releases/preparar_tesoreria.py --check` verifica que el release coincide exactamente con ambas fuentes, conservando sus cuerpos y quitando únicamente BEGIN/COMMIT externos para envolverlos juntos. El runner reconstruye desde M6 y contrasta su catálogo con las migraciones separadas y `schema.sql`. El release no contiene fixtures ni credenciales.

## Orden de aplicación

1. Fijar SHA del PR y comprobar estos hashes. Confirmar backup restaurable y ventana breve; releer historial y catálogo con administración. Verificar M6, ausencia de tesorería y bucket `org-comprobantes` ausente. No ejecutar `db push` ni reproducir SQL histórico.
2. Aplicar **solo** `supabase/releases/tesoreria_comprobantes_desde_m6.sql` con detención al primer error. Incluye `lock_timeout=5s`, `statement_timeout=60s`, precondiciones y commit único. Orden interno: #36 → complemento. Si el lock vence, revierte todo; reintentar tras resolver contención.
3. Registrar la versión real del aplicador y su correspondencia con **ambos** archivos fuente. Si el aplicador registra automáticamente, no insertar versiones ficticias ni otra fila por cada timestamp del repo. No aplicar las fuentes después del release.
4. Ejecutar `supabase/verify/comprobantes_tesoreria.sql` en solo lectura. Ambas firmas antiguas deben estar cerradas; nuevas abiertas; confirmación exclusiva servidor; bucket privado/10 MiB/PDF-JPEG-PNG; seis políticas de Storage y cuatro triggers. Ambos contadores de evidencia inválida deben ser cero y constraints validadas. Reconfirmar políticas familiares y acceso superadmin sin modificarlos.
5. Desplegar Edge desde el mismo SHA: `supabase functions deploy comprobantes --remote=uyiyhmxezgekntyquksi --no-verify-jwt`. Valida JWT contra Auth y sesión en SQL; usa los `SUPABASE_*` reservados del runtime, sin nuevos secretos. Nunca publicar service_role en Vite. Comprobar petición sin sesión → 401 y OPTIONS; no crear movimientos/archivos ficticios en producción.
6. Con SQL/Edge verificados y CI verde, mergear el PR y verificar frontend. Confirmar login/navegación del hogar y selector, formularios con comprobante obligatorio, consulta privada y recuperación de errores. Registrar operaciones económicas reales solo cuando correspondan a actividad autorizada; flujos sintéticos cubiertos en el stack aislado.

## Rollback operativo

Usar únicamente `supabase/rollback/20261129130000_comprobantes_tesoreria.down.sql`: revoca escrituras de cuentas/transferencias/socios/reversión/reservas y verificación/limpieza de servidor; desactiva la política permisiva de subida. Conserva libro, deudas, adjuntos, bucket, lectura y protecciones. **No usar el rollback de #36 tras el complemento**, porque sus firmas ya no existen; nunca restaurarlas sin comprobante. Apagar UI empresarial si hace falta, conservando cliente multi-espacio y acceso familiar. Recuperación posterior mediante migración de reactivación revisada, sin repetir release sobre tablas existentes.

URLs emitidas duran como máximo 60 s. No hay scheduler de limpieza instalado; retener reservas es seguro. La validación de formatos no reemplaza análisis antivirus. No se crean datos QA, usuarios demo ni cambios de roles en producción.
