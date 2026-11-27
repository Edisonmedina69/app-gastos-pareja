"""Snapshot del catálogo public para contrastar migración y schema.sql, sin datos."""
import json
import re
import subprocess
import sys

container=sys.argv[1]
if not container.startswith('supabase_db_etapa1-test-'):
    raise SystemExit('Solo contenedores locales aislados etapa1-test-*')
queries=[
 "select table_name,column_name,data_type,is_nullable,column_default from information_schema.columns where table_schema='public' order by table_name,ordinal_position",
 "select c.relname,con.conname,pg_get_constraintdef(con.oid) definition from pg_constraint con join pg_class c on c.oid=con.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' order by 1,2",
 "select * from pg_indexes where schemaname='public' order by tablename,indexname",
 "select * from pg_policies where schemaname='public' order by tablename,policyname",
 "select p.proname,pg_get_functiondef(p.oid) definition,p.proacl from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind in ('f','p') order by p.proname",
 "select c.relname,t.tgname,pg_get_triggerdef(t.oid) definition from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and not t.tgisinternal order by 1,2",
 "select c.relname,c.relrowsecurity,c.relforcerowsecurity,c.relacl from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p','v') order by 1",
]
result=[]
for query in queries:
    p=subprocess.run(['docker','exec','-i',container,'psql','-U','postgres','-At','-v','ON_ERROR_STOP=1'],input="select coalesce(json_agg(t),'[]') from ("+query+")t;",text=True,capture_output=True,check=True)
    rows=json.loads(p.stdout)
    for row in rows:
        if 'definition' in row:
            row['definition']=re.sub(r'\s+',' ',re.sub(r'--[^\n]*','',row['definition'])).strip()
    result.append(rows)
print(json.dumps(result,sort_keys=True,ensure_ascii=False,indent=2))
