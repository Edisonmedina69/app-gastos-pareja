"""Carreras consumo/descarte con barrera real, exclusivamente el stack efímero."""
import subprocess
import sys
import time

container, org, actor, session, member, account, first_doc, second_doc = sys.argv[1:]
if not container.startswith('supabase_db_etapa3-test-'):
    raise SystemExit('Solo stack local efímero')
psql = ['docker', 'exec', '-i', container, 'psql', '-U', 'postgres', '-Atq', '-v', 'ON_ERROR_STOP=1']
context = (f"set role authenticated; set request.jwt.claims='{{\"sub\":\"{actor}\",\"session_id\":\"{session}\",\"role\":\"authenticated\"}}';"
           "set request.headers='{\"x-app-version\":\"2\"}'; set statement_timeout='12s';")


def run(query):
    return subprocess.run(psql, input=query, text=True, capture_output=True, check=True).stdout.strip()


def wait_for(query):
    deadline = time.monotonic() + 8
    while time.monotonic() < deadline:
        if run(query) != '0':
            return
        time.sleep(.05)
    raise AssertionError('No se alcanzó barrera de carrera')


def race(first, second):
    barrier = subprocess.Popen(psql, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    children = []
    try:
        barrier.stdin.write('select pg_advisory_lock(741374);\n')
        barrier.stdin.flush()
        wait_for("select count(*) from pg_locks where locktype='advisory' and objid=741374 and granted")
        a = subprocess.Popen(psql, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        children.append(a)
        a.stdin.write('begin;' + context + first + 'select pg_advisory_lock(741374);commit;\n')
        a.stdin.close()
        wait_for("select count(*) from pg_stat_activity where wait_event='advisory' and query like '%741374%'")
        b = subprocess.Popen(psql, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        children.append(b)
        b.stdin.write(context + second + '\n')
        b.stdin.close()
        wait_for("select count(*) from pg_stat_activity where wait_event_type='Lock' and wait_event<>'advisory' and cardinality(pg_blocking_pids(pid))>0")
        barrier.stdin.write('select pg_advisory_unlock(741374);\n')
        barrier.stdin.flush()
        a.wait(timeout=15)
        b.wait(timeout=15)
        assert a.returncode == 0, a.stderr.read()
        assert b.returncode != 0, 'La segunda operación incompatible debió fallar'
    finally:
        for child in children:
            if child.poll() is None:
                child.kill()
            child.wait(timeout=15)
        barrier.stdin.close()
        barrier.wait(timeout=15)


def payment(doc):
    return (f"select public.registrar_pago_personal_socio_org('{org}',gen_random_uuid(),'{member}','{account}',"
            f"1,'{doc}',1,'manual_confirmada',current_date,'Carrera limpieza QA');")


def discard(doc):
    return f"select public.descartar_comprobante_org('{org}','{doc}');"


race(payment(first_doc), discard(first_doc))
assert run(f"select estado from public.org_adjuntos where id='{first_doc}'") == 'consumido'
race(discard(second_doc), payment(second_doc))
assert run(f"select estado from public.org_adjuntos where id='{second_doc}'") == 'descartado'
assert run(f"select count(*) from public.org_operaciones where comprobante_id='{second_doc}'") == '0'
print('OK: consumo gana a descarte sin perder archivo; descarte gana a consumo sin mover dinero')
