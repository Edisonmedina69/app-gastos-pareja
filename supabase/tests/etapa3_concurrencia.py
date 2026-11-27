"""Dos conexiones reales; solo stack Docker efímero, datos sintéticos."""
import subprocess
import sys
import time

container = sys.argv[1]
if not container.startswith('supabase_db_etapa3-test-'):
    raise SystemExit('Solo contenedores locales aislados etapa3-test-*')
psql = ['docker', 'exec', '-i', container, 'psql', '-U', 'postgres', '-Atq', '-v', 'ON_ERROR_STOP=1']


def run(query):
    return subprocess.run(psql, input=query, text=True, capture_output=True, check=True).stdout.strip()


uid = 'e6000000-0000-4000-8000-000000000001'
run(f"insert into auth.users(id,email) values('{uid}','race3@example.invalid');"
    f"insert into auth.sessions(id,user_id) values('{uid}','{uid}');"
    f"insert into public.org_piloto_usuarios values('{uid}');")
context = (f"set role authenticated; set request.jwt.claims='{{\"sub\":\"{uid}\","
           f"\"session_id\":\"{uid}\",\"role\":\"authenticated\"}}';"
           "set request.headers='{\"x-app-version\":\"2\"}'; set statement_timeout='12s';")
org = run(context + "select public.crear_organizacion('Carreras tesorería',2);").splitlines()[-1]
run(context + f"select public.seleccionar_espacio('{org}');")
origin = run(context + f"select public.crear_cuenta_org('{org}','Origen','efectivo','PYG');").splitlines()[-1]
dest = run(context + f"select public.crear_cuenta_org('{org}','Destino','efectivo','PYG');").splitlines()[-1]


def wait_until(query):
    deadline = time.monotonic() + 8
    while time.monotonic() < deadline:
        if run(query) != '0':
            return
        time.sleep(.05)
    raise AssertionError('No se alcanzó la barrera de concurrencia')


def race(first, second, second_ok=True, error=''):
    barrier = subprocess.Popen(psql, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    children = []
    try:
        barrier.stdin.write('select pg_advisory_lock(741373);\n')
        barrier.stdin.flush()
        wait_until("select count(*) from pg_locks where locktype='advisory' and objid=741373 and granted")
        a = subprocess.Popen(psql, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        children.append(a)
        a.stdin.write('begin;' + context + first + 'select pg_advisory_lock(741373); commit;\n')
        a.stdin.close()
        wait_until("select count(*) from pg_stat_activity where wait_event='advisory' and query like '%741373%'")
        b = subprocess.Popen(psql, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        children.append(b)
        b.stdin.write(context + second + '\n')
        b.stdin.close()
        wait_until("select count(*) from pg_stat_activity where wait_event_type='Lock' and wait_event<>'advisory' and cardinality(pg_blocking_pids(pid))>0")
        barrier.stdin.write('select pg_advisory_unlock(741373);\n')
        barrier.stdin.flush()
        a.wait(timeout=15)
        b.wait(timeout=15)
        assert a.returncode == 0, a.stderr.read()
        b_error = b.stderr.read()
        assert (b.returncode == 0) == second_ok and error in b_error, b_error
    finally:
        for child in children:
            if child.poll() is None:
                child.kill()
            child.wait(timeout=15)
        barrier.stdin.close()
        barrier.wait(timeout=15)


key = 'e6111111-1111-4111-8111-111111111111'
transfer = (f"select public.transferir_org('{org}','{key}','{origin}','{dest}',"
            "100,100,current_date,1,1,'manual_confirmada','Excepción QA',true);")
race(transfer, transfer)
assert run(f"select count(*) from public.org_operaciones where espacio_id='{org}'") == '1'
assert run(f"select count(*) from public.org_apuntes where espacio_id='{org}'") == '2'
print('OK: doble envío concurrente contabiliza una sola transferencia')

op = run(f"select id from public.org_operaciones where espacio_id='{org}'")
rev = f"select public.revertir_org('{org}','e6222222-2222-4222-8222-222222222222','{op}','Reversión QA');"
race(rev, rev)
assert run(f"select count(*) from public.org_operaciones where reversa_de='{op}'") == '1'
assert run(f"select sum(importe_firmado) from public.org_apuntes where espacio_id='{org}' and cuenta_id='{origin}'") == '0.000000'
print('OK: doble reversión concurrente crea un solo contraasiento y concilia a cero')

key2 = 'e6333333-3333-4333-8333-333333333333'
transfer2 = transfer.replace(key, key2)
race(transfer2, transfer2.replace('100,100', '200,200'), False, 'otra solicitud')
assert run(f"select count(*) from public.org_operaciones where espacio_id='{org}' and idempotencia='{key2}'") == '1'
print('OK: carrera con misma clave y otro importe rechaza la segunda solicitud')
