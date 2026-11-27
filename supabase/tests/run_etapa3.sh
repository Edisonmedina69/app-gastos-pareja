#!/usr/bin/env bash
# Stack Supabase efímero con réplica de esquema; sin URLs ni datos de producción.
set -euo pipefail
cd "$(dirname "$0")/../.."
local_dir=$(mktemp -d /tmp/etapa3-test-XXXXXXXX)
container="supabase_db_$(basename "$local_dir")"
cli=(npx --yes supabase@3.4.0)
cleanup() {
  "${cli[@]}" stop --workdir "$local_dir" --no-backup >/dev/null 2>&1 || true
  rm -rf "$local_dir"
}
trap cleanup EXIT
if command -v rg >/dev/null 2>&1; then
  log_filter=(rg)
else
  log_filter=(grep -E)
fi
"${cli[@]}" init --workdir "$local_dir" >"$local_dir/init.log" 2>&1
python3 - "$local_dir/supabase/config.jsonc" <<'PY'
import sys
p=sys.argv[1];s=open(p).read()
for a,b in [('54321','55521'),('54322','55522'),('54320','55520'),('54323','55523'),('54324','55524'),('54327','55527')]: s=s.replace(a,b)
open(p,'w').write(s)
PY
if ! "${cli[@]}" start --workdir "$local_dir" -x studio,imgproxy,edge-runtime,logflare,vector,supavisor >/dev/null 2>&1; then
  echo 'Falló supabase start aislado; revisar Docker/puertos 55520–55527.' >&2; exit 1
fi
sql() { docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 "$@"; }
sql < supabase/baseline/schema_pre_etapa2.sql >"$local_dir/baseline.log" 2>&1 || { cat "$local_dir/baseline.log"; exit 1; }
sql < supabase/migrations/20261127180000_etapa2_multi_espacio.sql >"$local_dir/etapa2.log" 2>&1 || { cat "$local_dir/etapa2.log"; exit 1; }
sql < supabase/migrations/20261128120000_etapa2_correcciones_revision.sql >"$local_dir/correcciones2.log" 2>&1 || { cat "$local_dir/correcciones2.log"; exit 1; }
sql < supabase/migrations/20261128130000_etapa2_m6_baja_invitaciones.sql >"$local_dir/m6.log" 2>&1 || { cat "$local_dir/m6.log"; exit 1; }
sql < supabase/migrations/20261129120000_etapa3_tesoreria_minima.sql >"$local_dir/etapa3.log" 2>&1 || { cat "$local_dir/etapa3.log"; exit 1; }
echo 'OK: migración etapa 3 aplicada sobre etapa 2 y correcciones.'

sql < supabase/tests/etapa2_multi_test.sql >"$local_dir/etapa2-sql.log" 2>&1 || { cat "$local_dir/etapa2-sql.log"; exit 1; }
sql < supabase/tests/etapa2_correcciones_test.sql >"$local_dir/correcciones-test.log" 2>&1 || { cat "$local_dir/correcciones-test.log"; exit 1; }
echo 'OK: regresión SQL etapa 2 y correcciones.'

sql < supabase/tests/etapa3_tesoreria_test.sql >"$local_dir/etapa3-sql.log" 2>&1 || { cat "$local_dir/etapa3-sql.log"; exit 1; }
"${log_filter[@]}" 'NOTICE:  OK' "$local_dir/etapa3-sql.log" || true
echo 'OK: pruebas SQL de tesorería mínima (conciliación, idempotencia, permisos, FK cruzadas, reversión).'
python3 supabase/tests/etapa3_concurrencia.py "$container"

python3 supabase/tests/etapa2_p0.py | sql >"$local_dir/p0.log" 2>&1 || { cat "$local_dir/p0.log"; exit 1; }
echo 'OK: regresión P0 con sesiones Auth válidas.'

python3 supabase/tests/catalogo_local.py "$container" >"$local_dir/catalogo-migrado.json"
if [[ -f qa/etapa3-e2e.mjs ]] && [[ "${SKIP_PLAYWRIGHT_E2E:-0}" != "1" ]] && [[ -n "${PLAYWRIGHT_MODULE:-}" || -d /tmp/gastos-playwright || -d "$HOME/.cache/ms-playwright" ]]; then
  node qa/etapa3-e2e.mjs "$local_dir" "$container"
fi

sql < supabase/rollback/20261129120000_etapa3_tesoreria_minima.down.sql >"$local_dir/rollback3.log" 2>&1 || { cat "$local_dir/rollback3.log"; exit 1; }
sql -Atc "select not has_function_privilege('authenticated','public.transferir_org(uuid,uuid,uuid,uuid,numeric,numeric,date,numeric,numeric,text,text,boolean)','execute') and exists(select 1 from public.org_operaciones)" | grep -qx t
python3 supabase/tests/etapa2_p0.py | sql >"$local_dir/p0-rollback.log" 2>&1 || { cat "$local_dir/p0-rollback.log"; exit 1; }
echo 'OK: rollback funcional de etapa 3 conserva datos, lectura y acceso familiar.'

# Reconstrucción desde schema.sql en este contenedor efímero para verificar equivalencia exacta.
printf 'drop schema public cascade; create schema public; grant usage on schema public to public;\n' | sql >/dev/null 2>&1
sql < supabase/schema.sql >"$local_dir/schema.log" 2>&1 || { cat "$local_dir/schema.log"; exit 1; }
python3 supabase/tests/catalogo_local.py "$container" >"$local_dir/catalogo-schema.json"
diff -u "$local_dir/catalogo-migrado.json" "$local_dir/catalogo-schema.json"
sql < supabase/tests/etapa3_tesoreria_test.sql >"$local_dir/etapa3-schema-sql.log" 2>&1 || { cat "$local_dir/etapa3-schema-sql.log"; exit 1; }
python3 supabase/tests/etapa2_p0.py | sql >"$local_dir/p0-schema.log" 2>&1 || { cat "$local_dir/p0-schema.log"; exit 1; }
echo 'OK: schema.sql equivalente al catálogo migrado; tests Etapa 3 y P0 pasan sobre schema.sql.'
