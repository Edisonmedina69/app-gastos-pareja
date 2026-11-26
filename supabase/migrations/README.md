# Migraciones

Estos archivos son el **historial** de cambios que se aplicaron a mano en el SQL Editor de Supabase. Antes vivían sueltos en `supabase/*.sql` y en `docs/SQL_FASE_*.md`.

- **Nombre:** `AAAAMMDDHHMMSS_descripcion.sql`. El timestamp (UTC) es la fecha del commit que agregó el script; así quedan en el orden en que se aplicaron. Cuando varios scripts entraron en el mismo commit, se separan por un segundo, en orden de dependencia.
- **Nada se ejecutó** al moverlos. El contenido es el original, con una cabecera que indica el archivo de origen y el commit.
- **Esquema vigente:** está en [`../schema.sql`](../schema.sql), leído de la base en solo lectura. Las migraciones no se pueden reproducir desde cero: la primera menciona tablas anteriores al proyecto (`usuarios_espacios`, `metas_ahorro`).

## ⚠️ Producción

La base de producción **no tiene historial de migraciones** (`supabase_migrations.schema_migrations` está vacía). Si se corre `supabase db push` tal cual, el CLI intentaría aplicar todo de nuevo, incluida la fase 7, que hace `DROP TABLE ... CASCADE`.

Para evitarlo:

1. La primera migración y la de la fase 7 empiezan con una guarda que aborta si `public.espacios` ya existe.
2. Antes de usar el CLI contra producción, marcar el historial como aplicado:

   ```bash
   supabase migration repair --status applied \
     20260516193323 20260516205451 20260517144916 20260526004241 20260526004242 \
     20260526004243 20260526004244 20260526005432 20260526005930 20260526014734 \
     20260527013151 20260527220246 20260527220247 20260527220248 20260528031741 \
     20260528041823 20260709003546 20260804000024
   ```

A partir de ahí, cada cambio de esquema nuevo va en su propia migración con `supabase migration new <nombre>`.
