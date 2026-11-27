# Revisión de seguridad: Etapa 2 (multi-espacio y permisos)

Revisión independiente de la Etapa 2 (PR #33 DB, PR #34 UI), aplicada en producción el 2026-11-27 como `20261127131346_etapa2_multi_espacio`. Revisé código, catálogo vivo (solo lectura) y reproduje cada escenario en una base local.

## Alcance y método

- Leí `docs/PLAN_ORGANIZACION.md`, `docs/ETAPA2_MULTI_ESPACIO.md`, la migración y su rollback, `supabase/tests/etapa2_*`, `supabase/functions/*`, `supabase/baseline/schema_pre_etapa2.sql`, y en el front `supabaseClient.js`, `useEspacios`, `Espacios`, `Organizacion`, `AvisoVersion` y `vite.config.js`.
- **Catálogo de prod (MCP, solo lectura, sin datos de usuarios).** Revisé políticas, triggers, ACL y hash de cada función, las publicaciones y las Edge Functions. Lo único que consulté fuera del catálogo fueron conteos agregados.
  - Las ACL y las políticas de prod coinciden con la migración. Las 11 tablas familiares tienen la política restrictiva `Solo hogar activo` y el trigger `tr_validar_escritura_hogar` para INSERT, UPDATE y DELETE.
  - Estado de prod: piloto vacío, 0 organizaciones, 0 invitaciones, 0 usuarios con más de una membresía y 0 contextos de sesión inválidos. **Nada de lo que sigue fue explotado en prod**; el hallazgo alto bloquea habilitar el piloto.
- **Base local.** Levanté `supabase start` aislado y cargué `schema_pre_etapa2.sql`, la migración de Etapa 2 y sesiones reales en `auth.sessions`. Las pruebas imitan los JWT tal como los arma PostgREST.
- **PWA.** Probé con Chromium headless (Playwright) contra builds reales servidas localmente: la build anterior en `autoUpdate`, la de Etapa 2 y dos builds con la corrección.

## Resumen priorizado

| # | Severidad | Hallazgo | Estado |
|---|---|---|---|
| A1 | **Alto** | Una invitación sigue valiendo después de que su creador es dado de baja o degradado. Un admin removido puede volver a entrar y tomar el control de la organización. | Corregido en este PR |
| M1 | Medio (bug visible) | El aviso «Hay una versión nueva, recargar» reaparece en cada recarga | Corregido en este PR |
| M2 | Medio | Paso de `autoUpdate` a `prompt`: las PWA familiares quedan en el bundle viejo hasta cerrar todas sus ventanas | Corregido en este PR |
| M3 | Medio | Tras `salir_de_espacio`, el hogar que se crea o al que se une después no entra directo: la sesión queda sin espacio | Corregido en este PR |
| M4 | Medio | No se puede borrar un hogar con datos o con contexto de sesión (falla `SuperadminPanel`, incluso para service_role en el caso de la FK) | Corregido en este PR |
| M5 | Medio (preexistente) | El superadmin puede meterse en cualquier hogar y leer sus finanzas | Recomendación |
| M6 | Medio | Un integrante dado de baja vuelve a entrar con un link multiuso vigente emitido por otro admin | Recomendación |
| B1–B10 | Bajo | Ver la sección Bajo | Recomendaciones |

---

## Alto

### A1. Las invitaciones no dependen de la autoridad vigente de su creador (toma de control)

`aceptar_invitacion_org` solo valida el token, el vencimiento, la revocación y los usos. No comprueba que `creada_por` siga activo ni que conserve el rol o el permiso con el que emitió la invitación. `actualizar_permisos_miembro` tampoco revoca nada al dar de baja o degradar a alguien.

**Escenario reproducido (base local):**
1. El admin A crea `crear_invitacion_org(org,'admin',10)`: un link de admin con 10 usos y 7 días de vigencia.
2. El admin B da de baja a A: `actualizar_permisos_miembro(org, A, '[]', null, false)`. A queda con `activo = false`.
3. A, con su misma cuenta, ejecuta `aceptar_invitacion_org(token)`. El `on conflict … do update set activo = true, rol_plantilla = 'admin'` lo reactiva como admin.
4. A da de baja a B. La protección del último admin no lo impide porque A ya es admin otra vez.
5. Resultado: A es admin activo y B quedó fuera de la organización.

Con una segunda cuenta funciona igual. Pasa lo mismo con un delegado al que se le quita `integrantes.invitar`: sus links de `lectura` siguen sirviendo.

**Corrección** (`20261128120000_etapa2_correcciones_revision.sql`):
- `invitacion_vigente(id)` exige que el creador tenga membresía activa y sea admin, o que tenga `integrantes.invitar` para invitaciones de `lectura`. `aceptar_invitacion_org` la evalúa con el lock del espacio tomado. Si falla, marca la invitación como revocada y devuelve el error como dato.
- El trigger `tr_revocar_invitaciones_de_baja` (AFTER UPDATE de `activo` y `rol_plantilla`) revoca las invitaciones pendientes del creador cuando lo dan de baja. Si lo degradan, revoca las que no son de `lectura`. Así la UI ve el cambio y queda una segunda capa de defensa.
- Orden de locks: el trigger BEFORE ya bloquea `espacios`, así que el orden queda `espacios → espacio_miembros → org_invitaciones`. `aceptar` y `revocar` también toman `espacios` primero, por lo que no se agregan deadlocks.

## Medio

### M1. El aviso PWA reaparece en cada recarga (bug visible)

**Causa.** Con `registerType: 'prompt'`, el Service Worker nuevo queda en estado `waiting` hasta recibir `SKIP_WAITING`. Una recarga normal (F5, pull-to-refresh, volver a la PWA) **no** lo activa: el SW anterior sigue controlando la página y sirviendo su precache, es decir, la versión vieja. En cada carga, workbox-window detecta el SW que ya estaba en espera (`wasWaitingBeforeRegister`) y vuelve a emitir `waiting`, y `AvisoVersion` muestra el aviso otra vez. «Más tarde» solo lo oculta en memoria. Con una recarga forzada (Ctrl+Shift+R) la página carga la versión nueva desde la red pero sin controlador, y el SW sigue en espera. Por eso parece que «ya está la última versión».

Reproducción con Playwright (build A desplegada, luego build B):

| Paso | Antes | Con la corrección |
|---|---|---|
| 1.ª recarga tras desplegar B | aviso, `waiting=true`, bundle A | aviso (se detectó la versión durante esta carga: correcto) |
| 2.ª y 3.ª recarga | **aviso otra vez, `waiting=true`, sigue bundle A** | sin aviso, `waiting=false`, **bundle B** |

**Corrección** (`src/shared/ui/AvisoVersion.jsx`):
- Si al registrar ya hay un SW en espera, se activa sin preguntar y se recarga cuando toma el control. Al abrir o recargar todavía no hay cambios sin guardar.
- El aviso queda solo para versiones detectadas durante la sesión.
- El botón «Recargar» usa la misma rutina, que también cubre las páginas sin controlador vía `statechange`. `updateServiceWorker` de vite-plugin-pwa no recarga en ese caso.

### M2. Transición `autoUpdate` → `prompt`: familias atrapadas en el bundle viejo

El cliente anterior (inyectaba `registerSW.js` y su SW hacía `skipWaiting`) no conoce el aviso ni envía `SKIP_WAITING`. Al publicar Etapa 2, el SW nuevo queda en espera y **el bundle viejo se sigue sirviendo en cada recarga, sin aviso**, hasta cerrar todas las pestañas o ventanas. En Android, una PWA instalada puede seguir así por días.

Lo reproduje: tres recargas seguidas y la página sigue con `index-…js` y `registerSW.js` de la versión vieja, con `waiting=true`.

Hoy eso es funcional porque nadie tiene dos membresías. Pero esos clientes no envían `x-app-version` y no reciben correcciones.

**Corrección:**
- `public/sw-migracion.js`, cargado con `workbox.importScripts`, hace `skipWaiting` solo si el precache activo todavía contiene `registerSW.js`, la marca de la generación `autoUpdate`.
- Verificado: build vieja → build corregida, y a la segunda recarga se sirve el bundle nuevo. Las actualizaciones siguientes vuelven al flujo de aviso.

### M3. Contexto de sesión obsoleto tras `salir_de_espacio`

`salir_de_espacio` desactiva la membresía pero deja la fila de `sesiones_espacio` apuntando al espacio abandonado. En `mi_espacio_id()`, la rama `found` devuelve NULL y nunca llega al caso de una sola membresía.

**Escenario reproducido:** salir del hogar H1 y crear H2 da `mi_espacio_id() = NULL` aunque haya una sola membresía. El usuario cae en `/espacios` y tiene que elegir H2 a mano.

**Corrección:** `salir_de_espacio` borra los contextos del usuario que apuntaban a ese espacio. La baja que hace un admin conserva el contexto (denegación explícita, tal como lo documenta Etapa 2).

### M4. No se puede borrar un hogar con datos (`SuperadminPanel → eliminarEspacio`)

Hay dos bloqueos encadenados:
1. El `DELETE` en cascada desde `espacios` dispara `validar_escritura_hogar` en cada fila hija. El espacio borrado no es el `mi_espacio_id()` del superadmin, así que falla con «El espacio cambió; volvé a seleccionarlo» (42501).
2. `sesiones_espacio.espacio_id` tiene una FK **sin `ON DELETE`**. Cualquier hogar que alguna sesión haya seleccionado (en la práctica, todos) no se puede borrar, ni siquiera con service_role.

**Corrección:**
- La FK pasa a `ON DELETE CASCADE`: un contexto no es historial.
- El trigger deja pasar la acción referencial cuando el espacio padre ya no existe y la fila no cambia de espacio. Por RLS, solo el superadmin puede borrar espacios. Un usuario común sigue sin poder borrar filas ajenas (la RLS lo impide; hay test).

### M5. El superadmin puede leer las finanzas de cualquier hogar (preexistente desde P0)

Las restrictivas de Etapa 2 sí impiden la lectura directa: el superadmin ve 0 gastos ajenos. Pero:
- `Superadmin gestiona todo espacios` le muestra el `codigo_invitacion` de todos los hogares.
- `Superadmin gestiona todo perfiles` junto con el bypass de `proteger_perfil` le permite poner `perfiles.espacio_id` de un hogar ajeno. `sincronizar_membresia_perfil` crea entonces la membresía.

**Reproducido:** el superadmin hace `update perfiles set espacio_id = <hogar ajeno>` y pasa a leer sus gastos. Esto contradice el plan («superadmin no se convierte en admin de espacios ajenos»), aunque requiere un acto deliberado.

**Recomendación (decisión del dueño):** quitar al superadmin la escritura de `perfiles.espacio_id` y de `codigo_invitacion`, y reemplazarla por una RPC auditada de soporte que sea break-glass, con motivo y registro.

### M6. Un integrante dado de baja vuelve a entrar con un link multiuso ajeno vigente

Un link de `lectura` con 10 usos que otro admin compartió en un grupo sigue sirviendo después de dar de baja a alguien: el `on conflict` reactiva su membresía. Funciona como un token al portador.

**Recomendación:**
- Al dar de baja desde `/org/integrantes`, ofrecer «revocar links activos».
- O registrar `desactivado_at` en `espacio_miembros` y rechazar invitaciones con `created_at` anterior a la baja.

No lo cambié: requiere decidir el comportamiento esperado.

## Bajo

- **B1.** `perfiles` de compañeros de organización: cualquier integrante con `finanzas.ver` (incluida la plantilla `lectura`) ve la fila completa: `espacio_id` de su hogar y `rol` global, incluido si es superadmin. Conviene exponer solo el nombre mediante `listar_integrantes_org` y limitar la política a hogares.
- **B2.** `listar_integrantes_org` devuelve `usuario_id`. Para un admin de **hogar**, también muestra a los ex-integrantes inactivos, porque `es_admin_espacio` vale para hogares.
- **B3.** `supabase.rpc()` no pasa por el Proxy y no envía `x-espacio-id-esperado`. Hoy no hay RPC de escritura familiar en el front: `generar_cuotas` no se usa. Si se agrega una, fallará para usuarios con más de una membresía.
- **B4.** `sesion_auth_id()` no mira `auth.sessions.not_after` (timebox o inactividad). Hoy lo cubre la expiración del JWT. Revisar si se configura un timebox.
- **B5.** Costo del trigger por fila: unos 0,22 ms por fila (3000 UPDATE en 673 ms local). Las lecturas están bien: el planner resuelve `mi_espacio_id()` una sola vez (15 ms para 3000 filas). Solo afecta escrituras masivas.
- **B6.** `crear_espacio`, `unirse_a_espacio`, `crear_organizacion` y `aceptar_invitacion_org` hacen `FOR UPDATE` sobre `auth.users`. La contención con GoTrue es breve y aceptable, pero no conviene extender el patrón.
- **B7.** Realtime: en prod ninguna tabla de `public` está en `supabase_realtime`, así que `suscribirCambiosEspacio` nunca recibe eventos. No hay fuga. Si se publica alguna tabla, la RLS de Realtime recibe `session_id` pero no `request.headers`. Funciona, pero conviene probarlo antes.
- **B8.** Edge Functions `chat-ia` e `ingreso-magico`: no tocan la base y tienen `verify_jwt=true`. No validan espacio ni descuentan `tokens_ia_disponibles` en el servidor (preexistente). Un integrante de organización puede usar la IA familiar.
- **B9.** El rate limit de aceptación es por usuario y no hay límite para crear invitaciones. Con tokens de 192 bits la fuerza bruta no es viable. La tabla `org_intentos_invitacion` no se purga.
- **B10.** El rollback de Etapa 2 solo revoca 3 RPC (intencional). No revierte las restrictivas ni el trigger, así que hay que documentarlo como «apagar el piloto», no como «volver a etapa 1».

## Verificado sin hallazgos

- **Forzar otro espacio.**
  - `seleccionar_espacio` exige una membresía activa.
  - `sesiones_espacio` no tiene grants para `authenticated`.
  - El header `x-espacio-id-esperado` solo se compara contra `mi_espacio_id()` y nunca da autoridad.
  - `session_id` sale de un claim firmado y se verifica contra `auth.sessions` y `auth.uid()`.
- **SECURITY DEFINER.** Todas usan `search_path=''`. Las internas (`aplicar_plantilla_miembro`, `validar_contexto`, `validar_cliente_multi`, `validar_escritura_hogar`) no tienen EXECUTE para clientes, y las ACL de prod coinciden. Las RPC públicas validan contexto y permiso antes de escribir.
- **Políticas.** Las restrictivas cubren las 11 tablas familiares y `espacios` (organizaciones solo por RPC). Una organización no lee ni escribe finanzas familiares.
- **Concurrencia.**
  - Último cupo y último admin: el lock de `espacios` va antes de cualquier lectura, y `etapa2_concurrencia.py` pasa.
  - Dos aceptaciones del último uso de una invitación quedan serializadas.
  - El orden de locks `auth.users → espacios → org_invitaciones → espacio_miembros` es consistente en todas las RPC.
- **Clientes viejos y sesiones.**
  - Una familia con una sola membresía escribe sin headers.
  - Un JWT sin `session_id` ve 0 filas. Los tokens actuales de GoTrue siempre lo incluyen.
- **Invitaciones.** Solo se guarda `token_hash` (sin SELECT de columna). Vencimiento, revocación y usos se validan con la fila bloqueada, y el reintento idempotente no consume usos.

## Verificación de las correcciones

- `supabase/tests/etapa2_correcciones_test.sql` tiene 12 comprobaciones: toma de control bloqueada, permiso delegado retirado, degradación de admin, salir y crear, aislamiento entre hogares y borrado en cascada por superadmin.
- `run_etapa2.sh` ahora aplica la corrección y su test, hace rollback de la corrección y luego el de Etapa 2, y compara el catálogo contra `schema.sql` (actualizado).
- Front: `npm test`, lint de los archivos tocados y `vite build`.

## Plan de aplicación (requiere OK del dueño; no aplicado)

1. Desplegar el front. El fix PWA no depende de la base.
2. Aplicar solo `supabase/migrations/20261128120000_etapa2_correcciones_revision.sql`, que es transaccional, con `lock_timeout` de 5 s.
3. **No habilitar `org_piloto_usuarios` antes del paso 2** (A1).
4. Rollback: `supabase/rollback/20261128120000_etapa2_correcciones_revision.down.sql`. Vuelve a las definiciones de Etapa 2 y las invitaciones ya revocadas quedan revocadas.
