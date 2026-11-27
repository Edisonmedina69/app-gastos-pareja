"""Genera el payload atómico para una base que termina en M6; nunca se conecta a la BD."""
from hashlib import sha256
from pathlib import Path
import sys

root = Path(__file__).resolve().parents[2]
names = ['20261129120000_etapa3_tesoreria_minima.sql', '20261129130000_comprobantes_tesoreria.sql']
parts = ["""-- ENTREGA ATÓMICA desde M6: generada por preparar_tesoreria.py, no editar a mano.
-- Registrar la versión real que devuelva el aplicador; mapear este payload a ambos archivos fuente.
-- No ejecutar las migraciones fuente además de este payload.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';
do $$ begin
  if to_regclass('public.org_cuentas') is not null then
    raise exception 'Esta entrega exige M6 sin tesorería: verificar historial y catálogo';
  end if;
  if to_regprocedure('public.invitacion_vigente(uuid)') is null or not exists(
    select 1 from information_schema.columns where table_schema='public' and table_name='espacio_miembros' and column_name='desactivado_at'
  ) then raise exception 'Faltan correcciones de etapa 2 o M6'; end if;
end $$;
"""]
for name in names:
    raw = (root / 'supabase/migrations' / name).read_bytes()
    lines = raw.decode().splitlines(keepends=True)
    assert sum(line.strip() == 'begin;' for line in lines) == 1
    assert sum(line.strip() == 'commit;' for line in lines) == 1
    parts.append(f'\n-- Fuente {name}; SHA256 {sha256(raw).hexdigest()}\n')
    parts.extend(line for line in lines if line.strip() not in ('begin;', 'commit;'))
parts.append('\ncommit;\n')
payload = ''.join(parts)
target = root / 'supabase/releases/tesoreria_comprobantes_desde_m6.sql'
if '--check' in sys.argv:
    assert target.read_text() == payload, 'Regenerar entrega atómica'
else:
    target.write_text(payload)
print(f'{sha256(payload.encode()).hexdigest()}  {target.name}')
