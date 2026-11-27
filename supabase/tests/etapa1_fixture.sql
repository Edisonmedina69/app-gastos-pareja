-- SOLO LOCAL. Datos ficticios anteriores a la migración; se cargan con el runner.
begin;
insert into auth.users (id,email)
select ('e1000000-0000-4000-8000-' || lpad(i::text,12,'0'))::uuid,
       'etapa1-' || i || '@example.invalid' from generate_series(1,8) i;
insert into public.espacios (id,nombre_familia,codigo_invitacion,limite_usuarios) values
 ('e2000000-0000-4000-8000-000000000001','Familia sintética A','ETAPA1A',2),
 ('e2000000-0000-4000-8000-000000000002','Familia sintética B','ETAPA1B',3),
 ('e2000000-0000-4000-8000-000000000003','Hogar vacío','ETAPA1C',1);
insert into public.perfiles (id,espacio_id,nombre,rol) values
 ('e1000000-0000-4000-8000-000000000001','e2000000-0000-4000-8000-000000000001','Admin A','admin_hogar'),
 ('e1000000-0000-4000-8000-000000000002','e2000000-0000-4000-8000-000000000001','Miembro A','miembro'),
 ('e1000000-0000-4000-8000-000000000003','e2000000-0000-4000-8000-000000000002','Plataforma','superadmin'),
 ('e1000000-0000-4000-8000-000000000004',null,'Sin hogar','miembro');
insert into public.gastos (espacio_id,usuario_id,pagador_id,monto,moneda,concepto)
select espacio_id,id,id,1000,'PYG',nombre from public.perfiles where espacio_id is not null;
insert into public.ingresos_mensuales (espacio_id,usuario_id,monto,moneda,concepto)
select espacio_id,id,10000,'PYG','Ingreso ' || nombre from public.perfiles where espacio_id is not null;
create temporary table etapa1_snapshot (tabla text primary key, filas jsonb) on commit preserve rows;
do $$ declare r record; begin
 for r in select tablename from pg_tables where schemaname='public' loop
  execute format('insert into etapa1_snapshot select %L, coalesce(jsonb_agg(to_jsonb(t) order by t.id), ''[]''::jsonb) from public.%I t',r.tablename,r.tablename);
 end loop;
end $$;
commit;
