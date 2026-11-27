"""Contrasta catálogo local y evidencia del MCP; nunca lee datos de familias."""
import json
from pathlib import Path
import re
import subprocess
import sys

container = sys.argv[1]
if not container.startswith('supabase_db_etapa1-test-'):
    raise SystemExit('Solo contenedores locales aislados etapa1-test-*')
root = Path(__file__).resolve().parents[2]
evidence = (root / 'supabase/baseline/catalogo_vivo_2026-11-27.md').read_text()
queries = re.findall(r'```sql\n(.*?)\n```', evidence, re.S)
expected = [json.loads(x) for x in re.findall(r'```json\n(.*?)\n```', evidence, re.S)]


def normalize_function(definition):
    without_comments = re.sub(r'--[^\n]*', '', definition)
    return re.sub(r'\s+', ' ', without_comments).strip()


# Storage interno lo administra Supabase y puede variar entre revisiones del
# stack. Compara public y confirma que no haya buckets ni políticas propias.
# El historial local vacío no pretende replicar las versiones de producción.
for section in range(9):
    query = queries[section].strip().rstrip(';')
    result = subprocess.run(
        ['docker', 'exec', '-i', container, 'psql', '-U', 'postgres', '-At',
         '-v', 'ON_ERROR_STOP=1'],
        input=f"select coalesce(json_agg(t),'[]') from ({query}) t;",
        text=True, capture_output=True, check=True,
    )
    local = json.loads(result.stdout)
    remote = expected[section]
    if section in (0, 2, 6):
        schema_key = 'schemaname' if section == 0 else 'nspname'
        local = [row for row in local if row[schema_key] == 'public']
        remote = [row for row in remote if row[schema_key] == 'public']
    for rows in (local, remote):
        for row in rows:
            if section == 1:
                row['definition'] = normalize_function(row['definition'])
            # MCP devuelve arrays PostgreSQL como texto; json_agg usa arrays JSON.
            for key in ('roles', 'proacl', 'relacl'):
                value = row.get(key)
                if isinstance(value, str) and value.startswith('{'):
                    row[key] = value[1:-1].split(',')
    if local != remote:
        raise SystemExit(f'El baseline local difiere del catálogo en sección {section + 1}')
    print(f'OK: baseline sección {section + 1}, {len(local)} objetos')
