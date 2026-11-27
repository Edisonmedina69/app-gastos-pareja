# Etapa 1: membresías compatibles

Implementa únicamente el PR 1 de [PLAN_ORGANIZACION.md](PLAN_ORGANIZACION.md), aprobado por el dueño. No introduce UI, selector, permisos empresariales, segundas membresías ni datos reales de prueba. No aplica cambios en producción.

## Baseline auditado

El 27/11/2026 otro trabajador del coordinador consultó el MCP de Supabase en **solo lectura** sobre ControlGastos (`uyiyhmxezgekntyquksi`). La salida original de las diez consultas, sin filas de familias ni secretos, está en [catálogo vivo](../supabase/baseline/catalogo_vivo_2026-11-27.md). Este trabajador no dispone del MCP; recibió el archivo del coordinador.

Se cargó el `schema.sql` anterior en un `supabase start` aislado y se comparó con ese catálogo mediante [verificar_baseline.py](../supabase/tests/verificar_baseline.py). Se normalizaron comentarios y representación JSON de arrays del MCP; no se normalizaron condiciones RLS, cuerpos SQL, atributos ni grants.

| Objeto | Resultado frente a `schema.sql` anterior |
|---|---|
| Tablas/columnas | Coinciden: 13 tablas de `public`, 168 columnas. |
| Constraints/índices | Coinciden: 52 constraints, 14 índices, todos PK/UNIQUE; sin índices secundarios. |
| Funciones | Coinciden las nueve definiciones y ACL: P0 aplicada, `SECURITY DEFINER` y `search_path` según el archivo. Solo difieren comentarios sin efecto. |
| Triggers de aplicación | Coinciden los dos triggers de `perfiles`; no hay triggers propios en Auth. |
| Políticas | Coinciden las 21 políticas de `public`, incluidos los cuatro permisos de `gastos_programados`. |
| RLS/ACL de tablas | RLS habilitada y no forzada en las 13 tablas; grants amplios heredados a `anon`, `authenticated` y `service_role`, limitados efectivamente por RLS. El archivo anterior omitía documentar estas ACL; se explicitan en el nuevo. |
| Storage | No hay buckets ni políticas propias. Hay once triggers internos de Supabase en `buckets`/`objects` y RLS en las diez tablas de Storage; no estaban documentados en `schema.sql`, que cubre `public`. No se modifican ni se copian las estructuras internas gestionadas por Supabase. |
| Publicaciones | No hay tablas `public` en publicaciones: se mantiene la advertencia de Realtime. |
| Historial | `supabase_migrations.schema_migrations` **existe**. Contradice la advertencia histórica del README. La consulta solo acredita existencia, no versiones registradas; no autoriza reparar ni reproducir todo el historial. |
| Encabezado del schema | Decía P0 pendiente al 26/11. El coordinador confirmó P0 aplicada el 27/11 mediante `apply_migration`; el catálogo coincide con ella. |

[schema_pre_etapa1.sql](../supabase/baseline/schema_pre_etapa1.sql) congela la réplica auditada de `public` para bootstrap local. El stack Supabase local aporta Auth/Storage administrados; puede tener una revisión distinta de sus triggers internos de Storage, sin impacto en esta migración, que no los utiliza. La réplica no contiene datos ni historial remoto y no se debe ejecutar en producción.

## Transición y compatibilidad

La migración agrega `espacios.tipo NOT NULL DEFAULT 'hogar'` con CHECK y `espacio_miembros` con identificador UUID, espacio, perfil, rol de plantilla, activo y fecha. Mapea `admin_hogar → admin`; `miembro` y `superadmin → miembro`. El rol global del perfil permanece igual. Agrega UNIQUE por espacio/usuario, UNIQUE por espacio/ID para futuras FK compuestas e índices para usuario/activo y conteos por espacio.

Un índice UNIQUE parcial impide más de una membresía activa por usuario durante etapa 1. La futura etapa 2 deberá retirarlo expresamente, una vez que selector, contexto, helpers y RLS estén completos. Las membresías inactivas se conservan al salir; reingresar reactiva la misma fila.

Se bloquean `espacios` y `perfiles` antes de crear la tabla y del backfill. Backfill, triggers, RPC y validación final ocurren en **una transacción**: no hay ventana entre copia y altas concurrentes. `ON CONFLICT DO NOTHING` vuelve idempotente el backfill y conserva IDs/fechas/roles existentes; la migración estructural se ejecuta una sola vez.

`perfiles.espacio_id`, `mi_espacio_id()`, `mis_espacios()`, `proteger_perfil()` y todas las políticas familiares conservan su funcionamiento P0. Un trigger AFTER de perfiles refleja altas, cambios administrativos de rol/espacio y salida a NULL. Borrar perfil elimina su membresía por FK, como exige el modelo legado durante esta etapa. RPC crear/unirse escriben perfil y membresía en la misma transacción por ese trigger.

Los contadores de RPC, `validar_limite_usuarios()` y `verificar_espacio_disponible()` usan **membresías activas**. Las altas bloquean el espacio para serializar el último cupo. Las RPC también bloquean primero la fila de Auth: existe antes del perfil y evita que dos altas simultáneas de una identidad sin perfil creen hogares huérfanos o cambien de hogar. No se alteran límites existentes. Los hogares que ya excedieran su límite conservan sus miembros y no admiten nuevas altas.

RLS de la nueva tabla permite consultar únicamente membresías propias. `authenticated` solo recibe SELECT; INSERT/UPDATE/DELETE/TRUNCATE se revocan y no tienen políticas. `anon` no recibe acceso. Funciones de trigger elevadas usan `search_path=''` y no son ejecutables por `PUBLIC`, `anon` ni `authenticated`. Un trigger valida pertenencia compatible y límite también en escrituras privilegiadas; RPC familiar rechaza códigos de organizaciones.

## Verificación reproducible

Requisitos: Docker operativo, Node/npm, Python 3, Bash y `rg`. Ejecutar desde el repositorio:

```bash
bash supabase/tests/run_etapa1.sh
npm ci --no-audit --no-fund
npm run lint
npm test
npm run build
```

El runner fija Supabase CLI 3.4.0, crea un proyecto efímero `etapa1-test-*` con puertos 55420–55427, ejecuta `supabase start`, carga únicamente el baseline auditado y elimina el stack/volúmenes al terminar. No acepta URLs ni credenciales remotas, no enlaza el proyecto de producción y no ejecuta migraciones históricas. La salida de start se oculta porque contiene credenciales locales.

Cobertura SQL:

- Comparación automatizada del baseline local con el catálogo recibido.
- Comparación de todas las filas originales de las 13 tablas antes/después de migrar, además de conteos por espacio, hogares vacíos, perfiles sin espacio y roles sin promoción de superadmin.
- Backfill repetido conserva filas completas; salida/reingreso sin duplicación y membresías inactivas sin consumir cupo.
- Acceso familiar, RLS propia, grants y RPC compatibles; rechazo de segunda membresía y de organizaciones por código familiar.
- Suite P0 antes de migrar, después, después del rollback y sobre `schema.sql`: autoasignación de espacio/rol, upsert, lectura/escritura ajena, anon, límites por RPC/trigger y operaciones familiares.
- Dos conexiones reales con barrera y comprobación de espera de locks: último cupo, dos creaciones de identidad sin perfil y dos uniones de la misma identidad a hogares distintos.
- Rollback funcional sin borrar filas y comparación del catálogo completo de `schema.sql` con el resultado migrado: columnas, constraints, índices, funciones/ACL, triggers, políticas y RLS/ACL de tablas.

Resultado local: runner completo aprobado, 37 comprobaciones de etapa 1, tres carreras serializadas y regresión P0 antes/después/rollback/schema; catálogo de referencia equivalente al migrado. También pasan lint, 41 tests unitarios y build.

Se corrigieron dos falsos positivos de la suite P0: sus handlers `raise_exception` también atrapaban el propio mensaje `FALLO`. Ahora exigen que la excepción empiece por el mensaje real del límite. Las pruebas usan solo identidades `example.invalid`/fixtures originales locales, nunca familias reales.

## Plan de aplicación para el dueño (requiere su OK)

1. Revisar este PR y sus checks. Confirmar nuevamente el catálogo/P0 y consultar **versiones** de `supabase_migrations.schema_migrations` en solo lectura. No ejecutar `db push` ni `migration repair` masivo con el historial destructivo; verificar individualmente qué está registrado/aplicado.
2. Obtener backup restaurable y confirmar restauración en un entorno aislado. Tomar conteos por espacio/rol y agregados financieros con acceso administrativo, sin volcarlos a PR/logs; detectar perfiles sobre límite y resolver si corresponde antes de ampliar miembros.
3. Acordar una ventana breve para locks de escrituras de hogares. Aplicar **solo** `20261127120000_etapa1_membresias_compatibles.sql` mediante el mecanismo de migración autorizado. `lock_timeout=5s` y `statement_timeout=60s`: si vence un timeout, toda la transacción se revierte; investigar y reintentar en otra ventana. Registrar únicamente esta versión cuando el mecanismo no lo haga automáticamente.
4. Verificar que todos los espacios anteriores sean `hogar`; que los conteos de perfiles con espacio y membresías activas coincidan **por espacio**; que los roles estén correctamente mapeados y no haya segunda membresía activa. Comparar conteos/agregados financieros y probar crear/unirse/salir/reingresar con cuentas QA autorizadas, conservando acceso de familias. No habilitar organizaciones ni selector.
5. Ante regresión, aplicar únicamente [rollback de etapa 1](../supabase/rollback/20261127120000_etapa1_membresias_compatibles.down.sql), también previa autorización. Restaura RPC/contadores P0 y conserva `tipo`, tabla, datos, índices, RLS y sincronización de membresías. **Nunca ejecutar el rollback P0**, que reabre fallas. El rollback aborta si existen organizaciones, segunda membresía o tablas de contexto/permisos de etapa 2. Después verificar P0 y acceso familiar; coordinar el registro de reversión con el mecanismo utilizado. Para reactivar la etapa 1 tras ese rollback funcional, reinstalar únicamente sus cuatro definiciones `CREATE OR REPLACE` de RPC/contadores y validar, sin repetir DDL/backfill estructural.

No se aplicó la migración ni el rollback en producción; este PR no despliega frontend, no cambia secretos y no hace merge.
