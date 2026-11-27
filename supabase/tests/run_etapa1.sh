#!/usr/bin/env bash
# Entorno desechable: no acepta DB_URL, project-ref ni credenciales remotas.
set -euo pipefail
cd "$(dirname "$0")/../.."
local_dir=$(mktemp -d /tmp/etapa1-test-XXXXXXXX)
project_id=$(basename "$local_dir")
container="supabase_db_${project_id}"
cli=(npx --yes supabase@3.4.0)
cleanup() {
  "${cli[@]}" stop --workdir "$local_dir" --no-backup >/dev/null 2>&1 || true
  rm -rf "$local_dir"
}
trap cleanup EXIT
# Algunos runners de GitHub no incluyen ripgrep; grep es suficiente para logs.
if command -v rg >/dev/null 2>&1; then
  log_filter=(rg)
else
  log_filter=(grep -E)
fi
"${cli[@]}" init --workdir "$local_dir" >"$local_dir/init.log" 2>&1
# El init actual produce config.jsonc; cambia solo el stack local efímero.
python3 - "$local_dir/supabase/config.jsonc" <<'PY'
import sys
p=sys.argv[1]
s=open(p).read()
# Puertos propios de QA; fallar si otro proceso los ocupa, nunca tocar ese proceso.
for a,b in [('54321','55421'),('54322','55422'),('54320','55420'),('54323','55423'),('54324','55424'),('54327','55427')]:
    s=s.replace(a,b)
open(p,'w').write(s)
PY
# No imprimir salida de start/status: incluye credenciales del stack local.
if ! "${cli[@]}" start --workdir "$local_dir" -x studio,imgproxy,edge-runtime,logflare,vector,supavisor >"$local_dir/start.log" 2>&1; then
  echo 'Falló supabase start local; revisar Docker/puertos 55420–55427.' >&2
  exit 1
fi
sql() { docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 "$@"; }
sql < supabase/baseline/schema_pre_etapa1.sql >"$local_dir/bootstrap.log" 2>&1
python3 supabase/tests/verificar_baseline.py "$container"
sql < supabase/tests/p0_aislamiento_espacios_test.sql >"$local_dir/p0-antes.log" 2>&1 || { cat "$local_dir/p0-antes.log"; exit 1; }
cat supabase/tests/etapa1_fixture.sql \
    supabase/migrations/20261127120000_etapa1_membresias_compatibles.sql \
    supabase/tests/etapa1_membresias_test.sql | sql >"$local_dir/etapa1.log" 2>&1 || { cat "$local_dir/etapa1.log"; exit 1; }
"${log_filter[@]}" 'NOTICE:  OK' "$local_dir/etapa1.log"
sql < supabase/tests/p0_aislamiento_espacios_test.sql >"$local_dir/p0-despues.log" 2>&1 || { cat "$local_dir/p0-despues.log"; exit 1; }
python3 supabase/tests/etapa1_concurrencia.py "$container"
python3 supabase/tests/catalogo_local.py "$container" >"$local_dir/catalogo-migrado.json"
# Una estructura de etapa 2 hace abortar el rollback completo, sin tocar datos.
if { printf 'begin; create table public.sesiones_espacio (id uuid);\n'; cat supabase/rollback/20261127120000_etapa1_membresias_compatibles.down.sql; } | sql >"$local_dir/rollback-guard.log" 2>&1; then
  echo 'FALLO: rollback aceptó estructuras de etapa 2' >&2; exit 1
fi
"${log_filter[@]}" -q 'Rollback incompatible' "$local_dir/rollback-guard.log"
# Captura de datos sin tocar información de Auth o Storage.
sql -Atc "select md5(string_agg(row_to_json(m)::text, '' order by id)) from public.espacio_miembros m" >"$local_dir/miembros-antes.txt"
sql < supabase/rollback/20261127120000_etapa1_membresias_compatibles.down.sql >"$local_dir/rollback.log" 2>&1 || { cat "$local_dir/rollback.log"; exit 1; }
sql -Atc "select md5(string_agg(row_to_json(m)::text, '' order by id)) from public.espacio_miembros m" >"$local_dir/miembros-despues.txt"
diff -u "$local_dir/miembros-antes.txt" "$local_dir/miembros-despues.txt"
sql < supabase/tests/p0_aislamiento_espacios_test.sql >"$local_dir/p0-rollback.log" 2>&1 || { cat "$local_dir/p0-rollback.log"; exit 1; }
# Reconstruye solo public dentro del contenedor efímero; no admite destino externo.
printf 'drop schema public cascade; create schema public; grant usage on schema public to public;\n' | sql >"$local_dir/recrear.log" 2>&1
sql < supabase/schema.sql >"$local_dir/schema.log" 2>&1 || { cat "$local_dir/schema.log"; exit 1; }
python3 supabase/tests/catalogo_local.py "$container" >"$local_dir/catalogo-schema.json"
diff -u "$local_dir/catalogo-migrado.json" "$local_dir/catalogo-schema.json"
sql < supabase/tests/p0_aislamiento_espacios_test.sql >"$local_dir/p0-schema.log" 2>&1 || { cat "$local_dir/p0-schema.log"; exit 1; }
echo 'OK: P0 antes/después/rollback; backfill, RLS, compatibilidad, concurrencia y equivalencia de schema.sql.'
