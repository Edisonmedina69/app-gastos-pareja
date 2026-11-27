-- Antes de la corrección: réplica sintética del estado de prod (1 organización
-- de prueba con su dueño como único admin y contexto de sesión). Se confirma.
begin;
insert into auth.users(id,email) values
 ('50000000-0000-4000-8000-000000000001','prueba-duenio@example.invalid'),
 ('50000000-0000-4000-8000-000000000002','prueba-nuevo@example.invalid');
insert into auth.sessions(id,user_id) select id,id from auth.users where email like 'prueba-%@example.invalid';
insert into public.org_piloto_usuarios values('50000000-0000-4000-8000-000000000001');
select set_config('request.jwt.claims','{"sub":"50000000-0000-4000-8000-000000000001","session_id":"50000000-0000-4000-8000-000000000001","role":"authenticated"}',true),
       set_config('request.headers','{"x-app-version":"2"}',true), set_config('role','authenticated',true);
select public.crear_espacio('Hogar del dueño','Dueño');
select public.crear_organizacion('CaninDevs (prueba)',2) as org \gset
select public.seleccionar_espacio(:'org');
commit;
