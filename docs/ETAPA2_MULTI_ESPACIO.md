# Etapa 2: Multi-espacio y permisos

Implementa la **Etapa 2: Multi-espacio y permisos** de [PLAN_ORGANIZACION.md](PLAN_ORGANIZACION.md) sobre el baseline de [ETAPA1_MEMBRESIAS.md](ETAPA1_MEMBRESIAS.md). No aplica cambios en producción ni realiza merge sin autorización expresa del dueño.

## 1. Modelo de datos, contexto de sesión y seguridad (RLS / P0)

La migración [20261127180000_etapa2_multi_espacio.sql](../supabase/migrations/20261127180000_etapa2_multi_espacio.sql) extiende la base de Etapa 1 en una sola transacción con `lock_timeout = 5s` y `statement_timeout = 60s`:

- **Retiro de la guarda temporal de Etapa 1:** se elimina `espacio_miembros_un_activo_por_usuario`, permitiendo que una misma identidad Auth participe simultáneamente en su hogar y en una o más organizaciones.
- **Espacio activo por sesión (`sesiones_espacio`):** clave primaria `(session_id, usuario_id)` referenciando `auth.sessions(id) ON DELETE CASCADE` y `auth.users(id) ON DELETE CASCADE`.
  - `sesion_auth_id()` extrae el claim firmado `auth.jwt()->>'session_id'` y verifica que la fila exista en `auth.sessions` y pertenezca a `auth.uid()`. Una sesión cerrada o un `session_id` ajeno o malformado devuelve `NULL`.
  - `mi_espacio_id()` resuelve `sesion_auth_id() → sesiones_espacio → espacio_miembros (activo = true)`. Si el usuario tiene una sola membresía activa y aún no fijó contexto en `sesiones_espacio`, resuelve esa única membresía por compatibilidad con clientes familiares; con dos o más membresías sin selección devuelve `NULL` (denegación). Nunca usa `perfiles.espacio_id` como fuente de autorización.
  - `listar_mis_espacios()` devuelve únicamente `(id, nombre, tipo)` de las membresías activas del usuario con sesión vigente para poblar el selector antes de elegir contexto, sin exponer datos financieros.
  - `seleccionar_espacio(p_espacio_id)` toma lock sobre la fila de `sesiones_espacio`, verifica membresía activa en `espacio_miembros` y actualiza el contexto de esa sesión.
  - `validar_contexto(p_espacio_id_esperado)` serializa cambios de espacio bloqueando la fila de `sesiones_espacio` durante la transacción y comparando `p_espacio_id_esperado` con `mi_espacio_id()`.
- **Adaptación de RLS y P0:**
  - Políticas restrictivas `Sesión vigente perfiles` y `Sesión vigente membresías` exigen `sesion_auth_id() IS NOT NULL`. `es_superadmin()` también exige sesión vigente.
  - En las 11 tablas financieras familiares (`gastos`, `gastos_programados`, `ingresos_mensuales`, `ingresos_programados`, `historial_salarios`, `deudas_maestras`, `cuotas_detalle`, `notificaciones`, `cuentas_maestras`, `cuentas_pendientes`, `prestamos_personales`), se añade la política **restrictiva** `"Solo hogar activo"` (`espacio_id = mi_espacio_id() AND es_hogar(espacio_id)`) y el trigger `tr_validar_escritura_hogar` que valida la cabecera `x-espacio-id-esperado` y serializa contra el contexto de sesión. Ninguna organización puede leer ni escribir en tablas familiares.
  - `crear_espacio` y `unirse_a_espacio` mantienen firmas compatibles, exigen cliente `x-app-version: 2` cuando el usuario ya posee una membresía activa (`validar_cliente_multi()`), rechazan códigos de organizaciones y completan `perfiles.espacio_id` solo si estaba vacío, sin pisar el hogar anterior.
  - `salir_de_espacio(p_espacio_id_esperado)` desactiva únicamente la membresía seleccionada.

## 2. Organizaciones, invitaciones y permisos por persona

- **Creación de organizaciones (`crear_organizacion`):** restringida durante el piloto a `org_piloto_usuarios`; crea el espacio con `tipo = 'organizacion'`, `moneda_principal = 'PYG'` y `limite_usuarios = 10` (protegido por constraint `espacios_org_base_check`), inserta la membresía `admin`, copia los permisos efectivos de la plantilla `admin` y registra auditoría en `org_auditoria`.
- **Invitaciones por código y enlace (`org_invitaciones`, `crear_invitacion_org`, `aceptar_invitacion_org`, `revocar_invitacion_org`):**
  - Token aleatorio de 24 bytes (48 caracteres hexadecimales); en base de datos solo se almacena `token_hash` (SHA-256) y `authenticated` no tiene `SELECT` sobre la columna `token_hash`.
  - Vencimiento de 7 días, `max_usos` entre 1 y 10, control de revocación y rate-limit persistente por usuario en `org_intentos_invitacion` (máximo 20 intentos por ventana de 15 minutos, devolviendo error como dato JSON para no revertir el contador).
  - Orden estricto de bloqueo en aceptación (`auth.users → espacios → org_invitaciones → espacio_miembros`) para serializar el último cupo sin deadlocks. Reintentos del mismo miembro activo son idempotentes y no consumen otro uso.
  - Si quien invita no es `admin` pero tiene el permiso delegado `integrantes.invitar`, el servidor exige que la invitación otorgue únicamente la plantilla `lectura`.
- **Permisos por integrante (`miembro_permisos`, `tiene_permiso`, `aplicar_plantilla_miembro`, `actualizar_permisos_miembro`):**
  - Recursos validados por CHECK: `finanzas`, `gastos`, `ingresos`, `cuentas`, `socios`, `catalogos`, `recurrencias`, `integrantes`.
  - Acciones validadas por CHECK: `ver`, `crear`, `editar`, `anular`, `pagar`, `cobrar`, `configurar`, `invitar`.
  - `tiene_permiso(espacio, recurso, accion)` consulta filas efectivas en `miembro_permisos` para la membresía activa en el espacio activo de tipo organización; permisos ausentes se deniegan por defecto.
  - El trigger `tr_validar_membresia_compatible` sobre `espacio_miembros` serializa por espacio e impide eliminar, desactivar o degradar al **último admin** de una organización, incluso en concurrencia.

## 3. Separación de cargadores, rutas UI y aviso de nueva versión PWA

- **Separación de cargadores (`useEspacios`, `App.jsx`, `HogarApp.jsx`, `Organizacion.jsx`):**
  - `useEspacios` gestiona sesión Auth, lista de espacios, selección de contexto en servidor, sincronización entre pestañas (`BroadcastChannel`) y revalidación al recuperar visibilidad.
  - `supabaseClient.js` adjunta `x-app-version: 2` y captura `x-espacio-id-esperado` al construir cada consulta (`from()`), descartando respuestas de contextos anteriores mediante contador de generación (`vigenciaContexto`).
  - Cuando el espacio activo es `organizacion`, `App.jsx` monta `Organizacion` y **no** monta `HogarApp` ni `useHogar`: no se ejecutan reparto de pareja, cierres de tarjetas familiares ni acreditaciones automáticas de salarios.
- **Flujos y rutas:**
  - Con un solo espacio, el login entra directo; con varios espacios (o sin ninguno), muestra `/espacios`.
  - Barra superior con el nombre del espacio activo y acceso permanente a **Cambiar espacio** (`/espacios`).
  - `/crear-organizacion` e `/invitacion` (soporta código manual y enlace `/invitacion#token=...`, reteniendo el fragmento en memoria durante el login y limpiando `window.location.hash` con `history.replaceState` al consumirlo).
  - `/org/resumen`, `/org/integrantes`, `/org/integrantes/:id` y `/org/invitaciones/nueva`: resumen vacío con integrantes del equipo, gestión de plantillas y matriz de permisos individuales, generación de código/enlace y revocación.
- **Aviso de versión nueva de la PWA (`vite.config.js`, `AvisoVersion.jsx`):**
  - `VitePWA` configurado con `registerType: 'prompt'`, `cleanupOutdatedCaches: true` y `runtimeCaching: []` (jamás cachea respuestas financieras ni Storage).
  - `AvisoVersion` consulta actualizaciones del Service Worker al volver online y cada hora, mostrando el aviso accesible *"Hay una versión nueva, recargar"* con acción explícita.

## 4. Verificación reproducible

```bash
bash supabase/tests/run_etapa2.sh
npm run lint
npm test
npm run build
```

Cobertura verificada en `run_etapa2.sh` (contenedor Supabase local efímero en puertos `55520–55527`, sin datos reales):
1. **Migración sobre baseline de Etapa 1 (`schema_pre_etapa2.sql`)** y **42 comprobaciones SQL (`etapa2_multi_test.sql`)**: entrada directa con 1 espacio, denegación sin selección con 2 espacios, preservación de hogar y organización en la misma cuenta, bloqueo de tablas familiares en organización, tokens vencidos/revocados/inexistentes, unión de 5 integrantes adicionales (6 miembros activos), almacenamiento exclusivo de `token_hash`, permisos por persona (`gastos.pagar` vs `ingresos.cobrar`), invitación delegada restringida a `lectura`, protección del último admin, baja inmediata, dos sesiones independientes de la misma identidad, rechazo de espacio ajeno, bloqueo de escritura directa a tablas de contexto/membresías/permisos, rechazo de cliente viejo sin `x-espacio-id-esperado`, rechazo de mutación con contexto obsoleto y revocación al cerrar sesión en `auth.sessions`.
2. **Concurrencia real con dos conexiones (`etapa2_concurrencia.py`)**: serialización de límite concurrente al aceptar invitación por el último cupo y protección concurrente cuando dos administradores intentan degradarse mutuamente al mismo tiempo.
3. **E2E en navegador real con Playwright headless (`qa/etapa2-e2e.mjs`)**: login contra Supabase local, creación de hogar, entrada directa con 1 espacio, creación de **"CaninDevs (QA)"**, unión de 5 integrantes por código y por link `/invitacion#token=...`, verificación de 0 acreditaciones salariales en organización y capturas completas sin scroll horizontal ni errores de consola a **390, 768, 1440 y 1920 px** (`docs/qa/etapa2-*.png`).
4. **Regresión familiar y P0**: suite P0 completa con sesiones Auth válidas antes y después del rollback funcional (`20261127180000_etapa2_multi_espacio.down.sql`), equivalencia exacta (`diff -u`) entre el catálogo migrado y `supabase/schema.sql`, regresión visual/layout del hogar en los 4 anchos (`qa/capture-playwright.mjs`), lint, 43 tests unitarios y build PWA.

## 5. Plan de aplicación para el dueño (requiere su OK)

1. **Precondición y despliegue de cliente:** verificar que Etapa 1 esté aplicada y registrada en `supabase_migrations.schema_migrations`. Desplegar primero el frontend actualizado (que envía `x-app-version: 2`, `x-espacio-id-esperado` y activa el prompt de actualización PWA) para que los clientes existentes carguen la versión compatible.
2. **Backup y ventana:** confirmar backup restaurable del proyecto y acordar una ventana breve de mantenimiento.
3. **Aplicar migración:** ejecutar únicamente `supabase/migrations/20261127180000_etapa2_multi_espacio.sql` mediante el canal autorizado. La transacción configura `lock_timeout = '5s'` y `statement_timeout = '60s'`; si no obtiene los locks en 5 s, aborta limpiamente sin cambios parciales.
4. **Habilitación controlada del piloto:** la tabla `public.org_piloto_usuarios` queda vacía al migrar, por lo que ningún hogar existente cambia su flujo ni puede crear organizaciones accidentalmente. Insertar en `public.org_piloto_usuarios (usuario_id)` únicamente el UUID de la cuenta autorizada para el piloto QA/CaninDevs.
5. **Verificación post-aplicación:** comprobar que los hogares existentes con 1 sola membresía siguen entrando directo; con la cuenta habilitada en `org_piloto_usuarios`, verificar creación de organización, selector de espacios y aislamiento entre hogar y organización.
6. **Rollback funcional ante contingencia:** si se requiere apagar el módulo empresarial, aplicar `supabase/rollback/20261127180000_etapa2_multi_espacio.down.sql`. Revoca `EXECUTE` sobre `crear_organizacion`, `crear_invitacion_org` y `aceptar_invitacion_org` para frenar nuevas altas empresariales, **conservando** `sesiones_espacio`, `espacio_miembros`, `miembro_permisos`, los datos existentes y `mi_espacio_id()` basado en sesión y membresía (nunca volver a `perfiles.espacio_id`).
