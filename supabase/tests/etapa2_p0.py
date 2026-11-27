"""Reutiliza TODOS los ataques P0; agrega sesiones reales sintéticas al fixture.
La selección administrativa ahora usa RPC de sesión, nunca el perfil legado.
"""
from pathlib import Path
s = Path('supabase/tests/p0_aislamiento_espacios_test.sql').read_text()
s = s.replace('begin;\n', '''begin;
create function pg_temp.fixture_session() returns trigger language plpgsql as $$
begin
 insert into auth.sessions(id,user_id) values(new.id,new.id);
 return new;
end $$;
create trigger fixture_session after insert on auth.users for each row execute function pg_temp.fixture_session();
''', 1)
s = s.replace("'sub', p_uid, 'role', 'authenticated'", "'sub', p_uid, 'session_id', p_uid, 'role', 'authenticated'")
s = s.replace("select pg_temp.check(public.mi_espacio_id() = '00000000-0000-4000-8000-00000000e5e1'", "select public.seleccionar_espacio('00000000-0000-4000-8000-00000000e5e1');\nselect pg_temp.check(public.mi_espacio_id() = '00000000-0000-4000-8000-00000000e5e1'")
print(s)
