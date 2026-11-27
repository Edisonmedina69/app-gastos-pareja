# Migraciones

Las migraciones hasta `20260804000024` son el **historial** de cambios que se aplicaron a mano en el SQL Editor de Supabase. Antes vivían sueltos en `supabase/*.sql` y en `docs/SQL_FASE_*.md`.

La P0 `20261126120000_p0_aislamiento_espacios.sql` fue la primera migración nueva y ya está aplicada en producción. La etapa 1 `20261127120000_etapa1_membresias_compatibles.sql` agrega membresías compatibles; su aplicación requiere aprobación separada. Ambas tienen rollback en `../rollback/` y pruebas en `../tests/`.

- **Nombre:** `AAAAMMDDHHMMSS_descripcion.sql`. El timestamp (UTC) es la fecha del commit que agregó el script; así quedan en el orden en que se aplicaron. Cuando varios scripts entraron en el mismo commit, se separan por un segundo, en orden de dependencia.
- **Nada se ejecutó** al moverlos. El contenido es el original, con una cabecera que indica el archivo de origen y el commit.
- **Esquema vigente:** está en [`../schema.sql`](../schema.sql). El baseline se contrastó con el catálogo vivo en solo lectura el 27/11/2026; el archivo documenta el resultado de etapa 1, todavía no aplicada en producción. Las migraciones no se pueden reproducir desde cero: la primera menciona tablas anteriores al proyecto (`usuarios_espacios`, `metas_ahorro`).

## ⚠️ Producción

El 27/11/2026 se confirmó que **existe** `supabase_migrations.schema_migrations` y que P0 está aplicada. La advertencia anterior de ausencia de historial quedó desactualizada. Todavía hay SQL histórico destructivo (fase 7 con `DROP TABLE ... CASCADE`): no ejecutar `supabase db push` ni marcar todas las versiones como aplicadas sin contrastar individualmente el historial real.

La consulta de baseline solo comprobó la existencia de la tabla, no sus versiones. Antes de cualquier aplicación, leer las versiones registradas y verificar qué está efectivamente aplicado; registrar únicamente la migración autorizada cuando sea necesario. No reproducir las migraciones históricas desde cero.

Ver [auditoría, pruebas y plan de aplicación de etapa 1](../../docs/ETAPA1_MEMBRESIAS.md). Para pruebas locales, `bash supabase/tests/run_etapa1.sh` crea un stack aislado con réplica de esquema auditada y datos ficticios; no utiliza `db push` ni accede a producción.
