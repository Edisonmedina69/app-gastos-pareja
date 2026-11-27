# M6: entrega incremental y estado verificable

El merge de #35 incluyó `801bcd7`, no `d45aeb6`. Se recupera el cambio de este último en una migración nueva `20261128130000_etapa2_m6_baja_invitaciones.sql`; la migración fusionada `20261128120000` y su rollback permanecen intactos. La capacidad del superadmin de entrar a cualquier espacio se mantiene por decisión del dueño. No se modifican cuentas demo ni roles del item 48.

## Estado de producción

Esta sesión no dispone de herramientas Supabase: **no se verificó ni se aplicó nada en ControlGastos**. Los reportes anteriores no prueban el catálogo actual. Antes de aplicar, ejecutar exclusivamente consultas de catálogo e historial como estas (sin filas de usuarios):

```sql
select version, name from supabase_migrations.schema_migrations order by version;
select column_name, data_type from information_schema.columns
where table_schema = 'public' and table_name = 'espacio_miembros'
  and column_name = 'desactivado_at';
select pg_get_functiondef('public.aceptar_invitacion_org(text,integer)'::regprocedure);
select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname='sellar_baja_membresia';
select tgname, pg_get_triggerdef(oid) from pg_trigger
where tgrelid='public.espacio_miembros'::regclass and not tgisinternal;
select column_default from information_schema.columns
where table_schema='public' and table_name='org_invitaciones' and column_name='created_at';
```

## Secuencia de integración y aplicación

1. Mergear el PR correctivo M6 sobre `main`, después integrar `main` en #36 y cambiar su base a `main`. No aplicar tesorería antes de M6. Estos merges requieren autorización y no se realizan en esta entrega.
2. Contrastar el historial real con las definiciones, no solo con los timestamps del repositorio: Etapa 2 se registró con otra versión en reportes anteriores (`20261127131346`). Si #35 no está aplicado, aplicar **solo** su SQL fusionado `20261128120000`, con la autorización previa del dueño; no reproducir el historial antiguo ni usar `db push`.
3. Si no existe `desactivado_at`, aplicar **solo** `20261128130000_etapa2_m6_baja_invitaciones.sql`. Es transaccional, con `lock_timeout=5s` y `statement_timeout=60s`; un fallo no deja la migración a medias. Registrar únicamente esa versión siguiendo el mecanismo de despliegue autorizado.
4. Si la columna ya existe pero la versión incremental no, detener la aplicación automática: podría haberse aplicado manualmente la variante de `d45aeb6`. Comparar función, trigger, default y ACL, y reconciliar el historial explícitamente; no ejecutar de nuevo un `ADD COLUMN` ni marcar versiones a ciegas.
5. Verificar en QA baja + link multiuso previo rechazado sin gastar usos, invitación posterior y reactivación directa permitidas, conservación de hogar y contexto. Recién entonces habilitar invitaciones del piloto.
6. Aplicar tesorería solo cuando pase su revisión y se autorice su migración por separado.

Las bajas previas de organizaciones se sellan conservadoramente al migrar, porque no se conoce su fecha real. No se asume que producción tenga cero bajas. Las membresías activas y los datos familiares no cambian.

## Validación local y rollback

`SKIP_PLAYWRIGHT_E2E=1 bash supabase/tests/run_etapa2.sh` pasó: pruebas SQL Etapa 2, correcciones originales y M6, organización existente antes de migrar, regresión P0, carreras de cupos y último admin, rollback y equivalencia exacta del catálogo contra `schema.sql`. Se usó un stack efímero con datos sintéticos; no hubo prueba contra producción ni E2E de navegador en esta ejecución.

El rollback `20261128130000_etapa2_m6_baja_invitaciones.down.sql` deshabilita la aceptación por clientes y conserva sellos, trigger y función: volver a la función vulnerable o borrar sellos permitiría reabrir links antiguos. Para reactivar tras una incidencia, verificar la definición M6 y restaurar únicamente `GRANT EXECUTE ON FUNCTION public.aceptar_invitacion_org(text,integer) TO authenticated`. No ejecutar después un rollback anterior en producción sin evaluar cómo redefine esa función.
