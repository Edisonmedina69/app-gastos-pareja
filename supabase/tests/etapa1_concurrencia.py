"""Pruebas reales con dos conexiones READ COMMITTED, exclusivamente Docker local."""
import subprocess
import sys
import time

container = sys.argv[1]
if not container.startswith('supabase_db_etapa1-test-'):
    raise SystemExit('Solo contenedores locales aislados etapa1-test-*')
psql = ['docker', 'exec', '-i', container, 'psql', '-U', 'postgres', '-At', '-v', 'ON_ERROR_STOP=1']

def run(sql):
    return subprocess.run(psql, input=sql, text=True, capture_output=True, check=True).stdout.strip()

def as_user(uid, sql):
    return f"set role authenticated; set request.jwt.claims='{{\"sub\":\"{uid}\",\"role\":\"authenticated\"}}'; {sql}"

def race(first, second, expected_error):
    # Primera conexión retiene los locks de la mutación. Verificamos desde
    # otra conexión que la segunda realmente espera antes de liberar la primera.
    a = subprocess.Popen(psql, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    a.stdin.write('begin; '+first+" select pg_advisory_lock(741271); commit;\n")
    a.stdin.close()
    # Un lock consultivo solo sirve como barrera del test; no participa en las RPC.
    # La conexión de barrera ya debe existir antes de arrancar este helper (abajo).
    deadline = time.monotonic()+8
    while time.monotonic() < deadline:
        if run("select count(*) from pg_stat_activity where wait_event='advisory' and query like '%741271%'") != '0':
            break
        time.sleep(.05)
    else:
        a.kill()
        raise AssertionError('Primera mutación no alcanzó la barrera')
    b = subprocess.Popen(psql, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    b.stdin.write(second+'\n'); b.stdin.close()
    while time.monotonic() < deadline:
        if run("select count(*) from pg_stat_activity where wait_event_type='Lock' and cardinality(pg_blocking_pids(pid))>0 and wait_event<>'advisory'") != '0':
            break
        time.sleep(.05)
    else:
        a.kill(); b.kill()
        raise AssertionError('Segunda mutación no esperó al lock')
    barrier.stdin.write('select pg_advisory_unlock(741271);\n'); barrier.stdin.flush()
    a.wait(timeout=10); b.wait(timeout=10)
    a_error=a.stderr.read(); b_error=b.stderr.read()
    assert a.returncode == 0, a_error
    assert b.returncode != 0 and expected_error in b_error, b_error
    print('OK: carrera serializada:', expected_error)

run("""
insert into auth.users(id,email) select
 ('e3000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,
 'race-'||i||'@example.invalid' from generate_series(1,5)i;
insert into public.espacios(id,nombre_familia,codigo_invitacion,limite_usuarios) values
 ('e4000000-0000-4000-8000-000000000001','Carrera cupo','CARRERA1',1),
 ('e4000000-0000-4000-8000-000000000002','Carrera A','CARRERA2',2),
 ('e4000000-0000-4000-8000-000000000003','Carrera B','CARRERA3',2);
""")
barrier = subprocess.Popen(psql, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
try:
    for case in range(3):
        barrier.stdin.write('select pg_advisory_lock(741271);\n'); barrier.stdin.flush()
        # Espera adquisición real antes de arrancar la carrera.
        deadline=time.monotonic()+5
        while run('select count(*) from pg_locks where locktype=\'advisory\' and objid=741271 and granted') == '0':
            if time.monotonic()>deadline: raise AssertionError('No se adquirió barrera')
            time.sleep(.05)
        if case==0:
            race(as_user('e3000000-0000-4000-8000-000000000001',"select public.unirse_a_espacio('CARRERA1');"),
                 as_user('e3000000-0000-4000-8000-000000000002',"select public.unirse_a_espacio('CARRERA1');"), 'Límite de usuarios alcanzado')
        elif case==1:
            race(as_user('e3000000-0000-4000-8000-000000000003',"select public.crear_espacio('Nuevo A');"),
                 as_user('e3000000-0000-4000-8000-000000000003',"select public.crear_espacio('Nuevo B');"), 'Ya pertenecés a otro espacio')
        else:
            race(as_user('e3000000-0000-4000-8000-000000000004',"select public.unirse_a_espacio('CARRERA2');"),
                 as_user('e3000000-0000-4000-8000-000000000004',"select public.unirse_a_espacio('CARRERA3');"), 'Ya pertenecés a otro espacio')
    assert run("select count(*) from public.espacio_miembros where espacio_id='e4000000-0000-4000-8000-000000000001' and activo") == '1'
    assert run("select count(*) from public.espacios where nombre_familia in ('Nuevo A','Nuevo B')") == '1'
    assert run('select count(*) from (select usuario_id from public.espacio_miembros where activo group by usuario_id having count(*)>1)t') == '0'
finally:
    barrier.stdin.close()
    barrier.wait(timeout=10)
