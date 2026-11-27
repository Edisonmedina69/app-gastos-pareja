"""Pruebas reales con dos conexiones READ COMMITTED para Etapa 2, exclusivamente Docker local."""
import subprocess
import sys
import time

container = sys.argv[1]
if not container.startswith('supabase_db_etapa2-test-'):
    raise SystemExit('Solo contenedores locales aislados etapa2-test-*')
psql = ['docker', 'exec', '-i', container, 'psql', '-U', 'postgres', '-At', '-v', 'ON_ERROR_STOP=1']

def run(sql):
    return subprocess.run(psql, input=sql, text=True, capture_output=True, check=True).stdout.strip()

def as_user(uid, sql):
    return (
        f"set role authenticated; "
        f"set request.jwt.claims='{{\"sub\":\"{uid}\",\"session_id\":\"{uid}\",\"role\":\"authenticated\"}}'; "
        f"set request.headers='{{\"x-app-version\":\"2\"}}'; {sql}"
    )

def wait_for_barrier_and_lock(a, b, deadline):
    while time.monotonic() < deadline:
        if run("select count(*) from pg_stat_activity where wait_event='advisory' and query like '%741272%'") != '0':
            break
        time.sleep(.05)
    else:
        a.kill()
        raise AssertionError('Primera mutación no alcanzó la barrera')

def wait_for_second_blocking(a, b, deadline):
    while time.monotonic() < deadline:
        if run("select count(*) from pg_stat_activity where wait_event_type='Lock' and cardinality(pg_blocking_pids(pid))>0 and wait_event<>'advisory'") != '0':
            break
        time.sleep(.05)
    else:
        a.kill(); b.kill()
        raise AssertionError('Segunda mutación no esperó al lock')

run("""
insert into auth.users(id,email) select
 ('e5000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,
 'race2-'||i||'@example.invalid' from generate_series(1,5)i;
insert into auth.sessions(id,user_id) select id,id from auth.users where email like 'race2-%@example.invalid';
insert into public.org_piloto_usuarios values
 ('e5000000-0000-4000-8000-000000000001'),
 ('e5000000-0000-4000-8000-000000000002');
""")

org_id = run(as_user('e5000000-0000-4000-8000-000000000001', "select public.crear_organizacion('Org Carrera', 2);")).splitlines()[-1]
run(f"update public.espacios set limite_usuarios = 2 where id = '{org_id}';")
token = run(
    as_user(
        'e5000000-0000-4000-8000-000000000001',
        f"select public.seleccionar_espacio('{org_id}'); select token from public.crear_invitacion_org('{org_id}','admin',5);"
    )
).splitlines()[-1]

barrier = subprocess.Popen(psql, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
try:
    # Caso 1: Límite concurrente en organización (1 cupo restante, 2 usuarios aceptan al mismo tiempo)
    barrier.stdin.write('select pg_advisory_lock(741272);\n'); barrier.stdin.flush()
    deadline = time.monotonic() + 5
    while run("select count(*) from pg_locks where locktype='advisory' and objid=741272 and granted") == '0':
        if time.monotonic() > deadline: raise AssertionError('No se adquirió barrera')
        time.sleep(.05)

    a = subprocess.Popen(psql, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    a.stdin.write('begin; ' + as_user('e5000000-0000-4000-8000-000000000002', f"select public.aceptar_invitacion_org('{token}',2);") + " select pg_advisory_lock(741272); commit;\n")
    a.stdin.close()
    wait_for_barrier_and_lock(a, None, time.monotonic() + 8)

    b = subprocess.Popen(psql, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    b.stdin.write(as_user('e5000000-0000-4000-8000-000000000003', f"select public.aceptar_invitacion_org('{token}',2);") + '\n')
    b.stdin.close()
    wait_for_second_blocking(a, b, time.monotonic() + 8)

    barrier.stdin.write('select pg_advisory_unlock(741272);\n'); barrier.stdin.flush()
    a.wait(timeout=10); b.wait(timeout=10)
    a_out = a.stdout.read(); b_out = b.stdout.read()
    assert a.returncode == 0 and 'espacio_id' in a_out, a_out
    assert b.returncode == 0 and 'Límite de usuarios alcanzado' in b_out, b_out
    assert run(f"select count(*) from public.espacio_miembros where espacio_id='{org_id}' and activo") == '2'
    print('OK: carrera serializada: límite concurrente de organización')

    # Caso 2: Último admin concurrente (2 admins intentan degradarse mutuamente al mismo tiempo)
    m1_id = run(f"select id from public.espacio_miembros where espacio_id='{org_id}' and usuario_id='e5000000-0000-4000-8000-000000000001'")
    m2_id = run(f"select id from public.espacio_miembros where espacio_id='{org_id}' and usuario_id='e5000000-0000-4000-8000-000000000002'")
    run(as_user('e5000000-0000-4000-8000-000000000001', f"select public.seleccionar_espacio('{org_id}');"))
    run(as_user('e5000000-0000-4000-8000-000000000002', f"select public.seleccionar_espacio('{org_id}');"))

    barrier.stdin.write('select pg_advisory_lock(741272);\n'); barrier.stdin.flush()
    deadline = time.monotonic() + 5
    while run("select count(*) from pg_locks where locktype='advisory' and objid=741272 and granted") == '0':
        if time.monotonic() > deadline: raise AssertionError('No se adquirió barrera')
        time.sleep(.05)

    a = subprocess.Popen(psql, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    a.stdin.write('begin; ' + as_user('e5000000-0000-4000-8000-000000000001', f"select public.actualizar_permisos_miembro('{org_id}','{m2_id}','[]','lectura');") + " select pg_advisory_lock(741272); commit;\n")
    a.stdin.close()
    wait_for_barrier_and_lock(a, None, time.monotonic() + 8)

    b = subprocess.Popen(psql, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    b.stdin.write(as_user('e5000000-0000-4000-8000-000000000002', f"select public.actualizar_permisos_miembro('{org_id}','{m1_id}','[]','lectura');") + '\n')
    b.stdin.close()
    wait_for_second_blocking(a, b, time.monotonic() + 8)

    barrier.stdin.write('select pg_advisory_unlock(741272);\n'); barrier.stdin.flush()
    a.wait(timeout=10); b.wait(timeout=10)
    b_err = b.stderr.read()
    assert a.returncode == 0
    assert b.returncode != 0 and ('Solo admin puede gestionar integrantes' in b_err or 'No se puede quitar al último admin' in b_err), b_err
    assert run(f"select count(*) from public.espacio_miembros where espacio_id='{org_id}' and activo and rol_plantilla='admin'") == '1'
    print('OK: carrera serializada: protección de último admin concurrente')
finally:
    barrier.stdin.close()
    barrier.wait(timeout=10)
