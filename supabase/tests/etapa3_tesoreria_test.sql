-- Pruebas de Etapa 3: Tesorería mínima. Solo datos sintéticos; termina en rollback.
begin;
insert into auth.users(id,email)
 select ('50000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'etapa3-'||i||'@example.invalid' from generate_series(1,8) i;
insert into auth.sessions(id,user_id) select id,id from auth.users where email like 'etapa3-%@example.invalid';
insert into public.org_piloto_usuarios values
 ('50000000-0000-4000-8000-000000000001'),
 ('50000000-0000-4000-8000-000000000005');

create function pg_temp.como(i integer) returns void language plpgsql as $$
begin
 perform set_config('request.jwt.claims',jsonb_build_object('sub',('50000000-0000-4000-8000-'||lpad(i::text,12,'0')),'session_id',('50000000-0000-4000-8000-'||lpad(i::text,12,'0')),'role','authenticated')::text,true);
 perform set_config('request.headers','{"x-app-version":"2"}',true);
 perform set_config('role','authenticated',true);
end $$;
create function pg_temp.check(ok boolean,msg text) returns void language plpgsql as $$
begin if ok is not true then raise exception 'FALLO %',msg; end if; raise notice 'OK %',msg; end $$;
grant execute on function pg_temp.como(integer),pg_temp.check(boolean,text) to authenticated,anon;

-- 1. Crear organización A (Ana admin) y unir miembro (2), contador (3) y lectura (4).
select pg_temp.como(1);
select public.crear_organizacion('CaninDevs Tesorería QA',2) as org_a \gset
select public.seleccionar_espacio(:'org_a');
select token from public.crear_invitacion_org(:'org_a','miembro',1) \gset inv_miembro_
select token from public.crear_invitacion_org(:'org_a','contador',1) \gset inv_contador_
select token from public.crear_invitacion_org(:'org_a','lectura',1) \gset inv_lectura_
select id from public.espacio_miembros where espacio_id=:'org_a' and usuario_id=auth.uid() \gset m_ana_
reset role;

select pg_temp.como(2);
select public.aceptar_invitacion_org(:'inv_miembro_token',2)->>'espacio_id' as j2 \gset
select public.seleccionar_espacio(:'org_a');
select id from public.espacio_miembros where espacio_id=:'org_a' and usuario_id=auth.uid() \gset m_bruno_
reset role;

select pg_temp.como(3);
select public.aceptar_invitacion_org(:'inv_contador_token',2)->>'espacio_id' as j3 \gset
select public.seleccionar_espacio(:'org_a');
reset role;

select pg_temp.como(4);
select public.aceptar_invitacion_org(:'inv_lectura_token',2)->>'espacio_id' as j4 \gset
select public.seleccionar_espacio(:'org_a');
reset role;

-- Crear organización B independiente (usuario 5) para probar aislamiento y FK cruzadas.
select pg_temp.como(5);
select public.crear_organizacion('Otra Org B',2) as org_b \gset
select public.seleccionar_espacio(:'org_b');
select public.crear_cuenta_org(:'org_b','Caja Org B','efectivo','PYG') as cuenta_b \gset
select id from public.espacio_miembros where espacio_id=:'org_b' and usuario_id=auth.uid() \gset m_org_b_
reset role;

-- 2. Crear cuentas en cero en Org A (caja PYG, banco USD, billetera BRL, cuenta socio Ana PYG, cuenta socio Bruno PYG).
select pg_temp.como(1);
select public.crear_cuenta_org(:'org_a','Caja Operativa PYG','efectivo','PYG',null,'Caja central') as c_pyg \gset
select public.crear_cuenta_org(:'org_a','Banco Itaú USD','banco','USD',null,'Cta. 100-200') as c_usd \gset
select public.crear_cuenta_org(:'org_a','Billetera Pix BRL','billetera','BRL',null,'Pix corporativo') as c_brl \gset
select public.crear_cuenta_org(:'org_a','Custodia Ana PYG','socio','PYG',:'m_ana_id','Fondos empresa en Ana') as c_ana \gset
select public.crear_cuenta_org(:'org_a','Custodia Bruno PYG','socio','PYG',:'m_bruno_id','Fondos empresa en Bruno') as c_bruno \gset

select pg_temp.check((select count(*)=5 and bool_and(saldo=0 and saldo_base_historico=0 and cantidad_movimientos=0) from public.org_saldos_cuentas where espacio_id=:'org_a'),'todas las cuentas arrancan en cero sin asientos de apertura');
select pg_temp.check((select bool_and(custodia=0 and empresa_debe_al_socio=0 and socio_debe_a_empresa=0) from public.org_reporte_socios where espacio_id=:'org_a'),'reporte de socios arranca en cero en las 3 columnas');

-- Validar que cuenta tipo socio exige titular y banco rechaza titular.
do $$ begin
 perform public.crear_cuenta_org(public.mi_espacio_id(),'Socio sin titular','socio','PYG',null);
 raise exception 'FALLO socio sin titular';
exception when invalid_parameter_value then raise notice 'OK cuenta socio exige titular activo'; end $$;

do $$ begin
 perform public.crear_cuenta_org(public.mi_espacio_id(),'Banco con titular','banco','PYG',(select id from public.espacio_miembros where espacio_id=public.mi_espacio_id() limit 1));
 raise exception 'FALLO banco con titular';
exception when invalid_parameter_value then raise notice 'OK cuenta no-socio rechaza titular'; end $$;

-- 3. Roles lectura y miembro no pueden crear cuentas ni transferir.
reset role; select pg_temp.como(4);
do $$ begin
 perform public.crear_cuenta_org(public.mi_espacio_id(),'Cuenta Lectura','efectivo','PYG');
 raise exception 'FALLO lectura creó cuenta';
exception when insufficient_privilege then raise notice 'OK rol lectura no puede crear cuenta'; end $$;

do $$ begin
 perform public.transferir_org(public.mi_espacio_id(),gen_random_uuid(),(select id from public.org_cuentas limit 1),(select id from public.org_cuentas offset 1 limit 1),10000);
 raise exception 'FALLO lectura transfirió';
exception when insufficient_privilege then raise notice 'OK rol lectura no puede transferir'; end $$;

reset role; select pg_temp.como(2);
do $$ begin
 perform public.transferir_org(public.mi_espacio_id(),gen_random_uuid(),(select id from public.org_cuentas limit 1),(select id from public.org_cuentas offset 1 limit 1),10000);
 raise exception 'FALLO miembro transfirió';
exception when insufficient_privilege then raise notice 'OK rol miembro no puede transferir'; end $$;

-- Contador tiene cuentas.crear/editar/configurar pero NO tiene cuentas.pagar ni cuentas.cobrar por plantilla.
reset role; select pg_temp.como(3);
select public.crear_cuenta_org(:'org_a','Banco GNB PYG','banco','PYG') as c_gnb \gset
do $$ begin
 perform public.transferir_org(public.mi_espacio_id(),gen_random_uuid(),(select id from public.org_cuentas limit 1),(select id from public.org_cuentas offset 1 limit 1),10000);
 raise exception 'FALLO contador sin cuentas.pagar/cobrar transfirió';
exception when insufficient_privilege then raise notice 'OK cuentas.crear no concede transferir (requiere cuentas.pagar y cuentas.cobrar)'; end $$;

-- 4. Transferencia entre cuentas de la misma moneda + idempotencia (doble envío crea una sola operación) + alerta saldo insuficiente.
reset role; select pg_temp.como(1);
do $$ begin
 perform public.transferir_org(public.mi_espacio_id(),gen_random_uuid(),(select id from public.org_cuentas where nombre='Custodia Ana PYG'),(select id from public.org_cuentas where nombre='Caja Operativa PYG'),400000);
 raise exception 'FALLO transfirió con saldo insuficiente sin confirmación';
exception when invalid_parameter_value then raise notice 'OK saldo insuficiente exige confirmación y motivo explícito'; end $$;

select public.transferir_org(
 :'org_a','11111111-1111-4111-8111-111111111111',
 :'c_ana',:'c_pyg',400000,400000,current_date,1,1,'manual_confirmada',
 'Adelanto de custodia a caja con confirmación de descubierto temporal',true
) as op_transf_1 \gset

-- Doble envío con la misma clave de idempotencia devuelve la misma operación y no duplica apuntes.
select public.transferir_org(
 :'org_a','11111111-1111-4111-8111-111111111111',
 :'c_ana',:'c_pyg',400000,400000,current_date,1,1,'manual_confirmada',
 'Adelanto de custodia a caja con confirmación de descubierto temporal',true
) as op_transf_retry \gset
select pg_temp.check(:'op_transf_1' = :'op_transf_retry','doble envío devuelve el mismo ID de operación');
select pg_temp.check((select count(*) from public.org_operaciones where espacio_id=:'org_a' and idempotencia='11111111-1111-4111-8111-111111111111') = 1,'doble envío crea una sola operación');
select pg_temp.check((select count(*) from public.org_apuntes where operacion_id=:'op_transf_1') = 2,'doble envío crea solo dos apuntes');
select pg_temp.check((select saldo from public.org_saldos_cuentas where id=:'c_pyg') = 400000 and (select saldo from public.org_saldos_cuentas where id=:'c_ana') = -400000,'saldos de transferencia misma moneda concilian');

-- 5. Cambio de moneda PYG -> USD y PYG -> BRL con tasa manual confirmada (rechaza fallback 1).
do $$ begin
 perform public.transferir_org(
  public.mi_espacio_id(),gen_random_uuid(),
  (select id from public.org_cuentas where nombre='Caja Operativa PYG'),
  (select id from public.org_cuentas where nombre='Banco Itaú USD'),
  150000,20,current_date,1,1,'fallback_invalido','Cambio con tasa 1'
 );
 raise exception 'FALLO aceptó tasa 1 para USD';
exception when invalid_parameter_value then raise notice 'OK prohibido usar tasa 1 como fallback para USD/BRL'; end $$;

do $$ begin
 perform public.transferir_org(
  public.mi_espacio_id(),gen_random_uuid(),
  (select id from public.org_cuentas where nombre='Caja Operativa PYG'),
  (select id from public.org_cuentas where nombre='Billetera Pix BRL'),
  150000,100,current_date,1,null,'manual_confirmada','Cambio sin tasa BRL'
 );
 raise exception 'FALLO aceptó tasa NULL para BRL';
exception when invalid_parameter_value then raise notice 'OK cambio a BRL exige tasa manual confirmada'; end $$;

-- Cambio real: 150.000 PYG -> 20 USD a tasa 7.500 PYG/USD
select public.transferir_org(
 :'org_a','22222222-2222-4222-8222-222222222222',
 :'c_pyg',:'c_usd',150000,20,current_date,1,7500,'manual_confirmada','Compra de 20 USD para hosting'
) as op_fx_usd \gset

-- Cambio real: 75.000 PYG -> 50 BRL a tasa 1.500 PYG/BRL
select public.transferir_org(
 :'org_a','33333333-3333-4333-8333-333333333333',
 :'c_pyg',:'c_brl',75000,50,current_date,1,1500,'manual_confirmada','Compra de 50 BRL para proveedor'
) as op_fx_brl \gset

select pg_temp.check(
 (select saldo from public.org_saldos_cuentas where id=:'c_pyg') = 175000
 and (select saldo from public.org_saldos_cuentas where id=:'c_usd') = 20
 and (select saldo_base_historico from public.org_saldos_cuentas where id=:'c_usd') = 150000
 and (select saldo from public.org_saldos_cuentas where id=:'c_brl') = 50
 and (select saldo_base_historico from public.org_saldos_cuentas where id=:'c_brl') = 75000,
 'saldos multimoneda PYG/USD/BRL y equivalentes base históricos concilian'
);

-- 6. Pago personal de socio (financiación + gasto en una sola operación): no altera custodia neta y aumenta lo que la empresa debe al socio.
-- Bruno (miembro con gastos.pagar) registra su propio pago personal de 100.000 PYG.
reset role; select pg_temp.como(2);
select public.registrar_pago_personal_socio_org(
 :'org_a','44444444-4444-4444-8444-444444444444',
 :'m_bruno_id',:'c_bruno',100000,1,'manual_confirmada',current_date,'Multa DNIT pagada con bolsillo personal de Bruno'
) as op_pago_bruno \gset

-- Doble envío de pago personal es idempotente.
select pg_temp.check(
 public.registrar_pago_personal_socio_org(
  :'org_a','44444444-4444-4444-8444-444444444444',
  :'m_bruno_id',:'c_bruno',100000,1,'manual_confirmada',current_date,'Multa DNIT pagada con bolsillo personal de Bruno'
 ) = :'op_pago_bruno',
 'doble envío en pago personal de socio es idempotente'
);

-- Bruno no puede registrar pago personal a nombre de Ana sin permiso socios.crear/pagar.
select set_config('vars.m_ana_id', :'m_ana_id', true);
do $$ begin
 perform public.registrar_pago_personal_socio_org(
  public.mi_espacio_id(),gen_random_uuid(),
  current_setting('vars.m_ana_id')::uuid,
  (select id from public.org_cuentas where nombre='Custodia Ana PYG'),
  50000,1,'manual_confirmada',current_date,'Intento a nombre de otro socio'
 );
 raise exception 'FALLO miembro registró deuda a nombre de otro socio';
exception when insufficient_privilege then raise notice 'OK miembro solo registra pago personal propio'; end $$;

reset role; select pg_temp.como(1);
select pg_temp.check(
 (select saldo from public.org_saldos_cuentas where id=:'c_bruno') = 0
 and (select cantidad_movimientos from public.org_saldos_cuentas where id=:'c_bruno') = 2
 and (select custodia from public.org_reporte_socios where miembro_id=:'m_bruno_id' and moneda='PYG') = 0
 and (select empresa_debe_al_socio from public.org_reporte_socios where miembro_id=:'m_bruno_id' and moneda='PYG') = 100000
 and (select socio_debe_a_empresa from public.org_reporte_socios where miembro_id=:'m_bruno_id' and moneda='PYG') = 0,
 'pago personal deja custodia neta en 0 y registra deuda de la empresa al socio por 100.000 PYG'
);

-- 7. Reembolso parcial y retiro de socio: verificar las 3 columnas sin compensación silenciosa.
-- Reembolsar 60.000 PYG a Bruno desde Caja Operativa PYG: caja baja a 115.000, deuda baja a 40.000.
select public.registrar_movimiento_socio_org(
 :'org_a','55555555-5555-4555-8555-555555555555',
 'reembolso_socio',:'m_bruno_id',:'c_pyg',60000,1,'manual_confirmada',current_date,'Reembolso parcial multa DNIT'
) as op_reemb_bruno \gset

-- No permitir reembolsar más de lo que la empresa le debe al socio.
do $$ begin
 perform public.registrar_movimiento_socio_org(
  public.mi_espacio_id(),gen_random_uuid(),
  'reembolso_socio',(select id from public.espacio_miembros where espacio_id=public.mi_espacio_id() and usuario_id='50000000-0000-4000-8000-000000000002'),
  (select id from public.org_cuentas where nombre='Caja Operativa PYG'),
  50000,1,'manual_confirmada',current_date,'Reembolso excesivo'
 );
 raise exception 'FALLO reembolsó más de la deuda pendiente';
exception when invalid_parameter_value then raise notice 'OK reembolso no puede superar lo que la empresa debe al socio'; end $$;

-- Ana hace un retiro personal de 50.000 PYG desde Caja Operativa PYG: Ana debe 50.000 a la empresa.
select public.registrar_movimiento_socio_org(
 :'org_a','66666666-6666-4666-8666-666666666666',
 'retiro_socio',:'m_ana_id',:'c_pyg',50000,1,'manual_confirmada',current_date,'Retiro personal de Ana a cuenta'
) as op_retiro_ana \gset

select pg_temp.check(
 (select saldo from public.org_saldos_cuentas where id=:'c_pyg') = 65000
 and (select empresa_debe_al_socio from public.org_reporte_socios where miembro_id=:'m_bruno_id' and moneda='PYG') = 40000
 and (select socio_debe_a_empresa from public.org_reporte_socios where miembro_id=:'m_ana_id' and moneda='PYG') = 50000
 and (select custodia from public.org_reporte_socios where miembro_id=:'m_ana_id' and moneda='PYG') = -400000,
 'reporte por socio mantiene separadas custodia, deuda de empresa al socio y deuda del socio a la empresa'
);

-- 8. Reversión referenciada e inmutabilidad del libro.
do $$ begin
 update public.org_apuntes set importe_firmado = 1 where espacio_id = public.mi_espacio_id();
 raise exception 'FALLO editó apunte contabilizado';
exception when insufficient_privilege or check_violation then raise notice 'OK apuntes son inmutables (UPDATE bloqueado)'; end $$;

do $$ begin
 delete from public.org_operaciones where espacio_id = public.mi_espacio_id();
 raise exception 'FALLO borró operación contabilizada';
exception when insufficient_privilege or check_violation then raise notice 'OK operaciones son inmutables (DELETE bloqueado)'; end $$;

-- Incluso con rol privilegiado (postgres), el trigger impide UPDATE/DELETE de registros contabilizados.
reset role;
do $$ begin
 update public.org_operaciones set motivo = 'alterado';
 raise exception 'FALLO postgres editó operación';
exception when check_violation then raise notice 'OK trigger bloquea edición incluso a roles privilegiados'; end $$;

do $$ begin
 delete from public.org_movimientos_socios;
 raise exception 'FALLO postgres borró movimiento de socio';
exception when check_violation then raise notice 'OK trigger bloquea borrado incluso a roles privilegiados'; end $$;

-- Revertir el retiro de Ana (op_retiro_ana): caja vuelve a 115.000 y deuda de Ana vuelve a 0.
select pg_temp.como(1);
select public.revertir_org(
 :'org_a','77777777-7777-4777-8777-777777777777',
 :'op_retiro_ana','Carga por error, se revierte el retiro'
) as op_rev_retiro \gset

select pg_temp.check(
 (select saldo from public.org_saldos_cuentas where id=:'c_pyg') = 115000
 and (select socio_debe_a_empresa from public.org_reporte_socios where miembro_id=:'m_ana_id' and moneda='PYG') = 0
 and (select reversa_de from public.org_operaciones where id=:'op_rev_retiro') = :'op_retiro_ana',
 'reversión referenciada invierte apuntes y deuda de socio y concilia saldos'
);

-- No se puede revertir dos veces la misma operación ni revertir una reversión.
do $$ begin
 perform public.revertir_org(public.mi_espacio_id(),gen_random_uuid(),(select id from public.org_operaciones where reversa_de is not null limit 1),'Revertir la reversión');
 raise exception 'FALLO revirtió una reversión';
exception when invalid_parameter_value then raise notice 'OK no se puede revertir una reversión'; end $$;

do $$ begin
 perform public.revertir_org(public.mi_espacio_id(),gen_random_uuid(),(select reversa_de from public.org_operaciones where reversa_de is not null limit 1),'Segunda reversión con otra clave');
 raise exception 'FALLO revirtió dos veces la misma operación';
exception when unique_violation then raise notice 'OK no se puede revertir dos veces la misma operación'; end $$;

-- 9. Aislamiento entre espacios y prohibición de FK cruzadas.
-- Ana (Org A) intenta leer cuentas de Org B o transferir hacia cuenta_b de Org B.
select pg_temp.check((select count(*) from public.org_cuentas where espacio_id=:'org_b') = 0,'RLS impide ver cuentas de otra organización');
select pg_temp.check((select count(*) from public.org_saldos_cuentas where espacio_id=:'org_b') = 0,'vista saldos_cuentas impide ver otra organización');
select pg_temp.check((select count(*) from public.org_reporte_socios where espacio_id=:'org_b') = 0,'vista reporte_socios impide ver otra organización');

select set_config('vars.cuenta_b', :'cuenta_b', true);
do $$ begin
 perform public.transferir_org(
  public.mi_espacio_id(),gen_random_uuid(),
  (select id from public.org_cuentas where nombre='Caja Operativa PYG'),
  current_setting('vars.cuenta_b')::uuid,
  10000
 );
 raise exception 'FALLO transfirió a cuenta de otro espacio';
exception when check_violation then raise notice 'OK RPC rechaza cuenta de otro espacio'; end $$;

-- Prueba de FK compuesta en base de datos: un apunte en Org A no puede referenciar cuenta_b de Org B ni siquiera como superusuario.
reset role;
do $$
declare v_op uuid; v_cb uuid;
begin
 select id into v_op from public.org_operaciones where motivo like 'Compra de 20 USD%' limit 1;
 select id into v_cb from public.org_cuentas where nombre = 'Caja Org B' limit 1;
 insert into public.org_apuntes(espacio_id,operacion_id,cuenta_id,importe_firmado,tasa_base,importe_base_firmado,fuente_tasa)
  values((select espacio_id from public.org_operaciones where id=v_op),v_op,v_cb,1000,1,1000,'manual');
 raise exception 'FALLO FK compuesta permitió cuenta de otro espacio';
exception when foreign_key_violation then raise notice 'OK FK compuesta impide apuntes con cuenta de otro espacio'; end $$;

do $$
declare v_op uuid; v_mb uuid;
begin
 select id into v_op from public.org_operaciones where motivo like 'Compra de 20 USD%' limit 1;
 select id into v_mb from public.espacio_miembros where espacio_id <> (select espacio_id from public.org_operaciones where id=v_op) limit 1;
 insert into public.org_movimientos_socios(espacio_id,operacion_id,miembro_id,clase,moneda,importe_deuda_firmado,tasa_base,importe_base_firmado)
  values((select espacio_id from public.org_operaciones where id=v_op),v_op,v_mb,'prestamo','PYG',1000,1,1000);
 raise exception 'FALLO FK compuesta permitió miembro de otro espacio';
exception when foreign_key_violation then raise notice 'OK FK compuesta impide movimientos de socio de otro espacio'; end $$;

-- 10. Permisos de anon/public revocados.
select pg_temp.check(not has_function_privilege('anon','public.crear_cuenta_org(uuid,text,text,text,uuid,text)','execute'),'anon no ejecuta crear_cuenta_org');
select pg_temp.check(not has_function_privilege('anon','public.transferir_org(uuid,uuid,uuid,uuid,numeric,numeric,date,numeric,numeric,text,text,boolean)','execute'),'anon no ejecuta transferir_org');
select pg_temp.check(not has_function_privilege('anon','public.revertir_org(uuid,uuid,uuid,text,date)','execute'),'anon no ejecuta revertir_org');
select pg_temp.check(not has_table_privilege('anon','public.org_cuentas','select'),'anon no lee org_cuentas');
select pg_temp.check(not has_table_privilege('authenticated','public.org_apuntes','insert'),'authenticated no inserta directo en org_apuntes');
select pg_temp.check(not has_table_privilege('authenticated','public.org_operaciones','insert'),'authenticated no inserta directo en org_operaciones');

-- Regresiones de revisión: reintentos, permisos efectivos y validación numérica.
reset role;
select pg_temp.como(1);
select set_config('vars.org_a', :'org_a', true),
       set_config('vars.c_ana', :'c_ana', true),
       set_config('vars.c_pyg', :'c_pyg', true),
       set_config('vars.op_reemb', :'op_reemb_bruno', true),
       set_config('vars.op_pago', :'op_pago_bruno', true),
       set_config('vars.op_fx', :'op_fx_usd', true);
reset role;
create function pg_temp.rechaza(consulta text, codigo text, mensaje text)
returns void language plpgsql as $$
begin
  begin
    execute consulta;
  exception when others then
    if sqlstate = codigo then raise notice 'OK %', mensaje; return; end if;
    raise;
  end;
  raise exception 'FALLO %', mensaje;
end $$;
grant execute on function pg_temp.rechaza(text,text,text) to authenticated;
select pg_temp.como(1);

select pg_temp.rechaza(format(
 'select public.transferir_org(%L,%L,%L,%L,400001,400001,current_date,1,1,%L,%L,true)',
 :'org_a','11111111-1111-4111-8111-111111111111',:'c_ana',:'c_pyg','manual_confirmada',
 'Adelanto de custodia a caja con confirmación de descubierto temporal'),
 '22023','misma clave con otro importe no confirma una transferencia anterior');

select pg_temp.rechaza(format(
 'select public.registrar_pago_personal_socio_org(%L,%L,%L,%L,100000,1,%L,current_date,%L)',
 :'org_a','11111111-1111-4111-8111-111111111111',:'m_ana_id',:'c_ana','manual_confirmada','Otro flujo'),
 '22023','clave de transferencia no sirve como reintento de un pago personal');

-- Reversión idéntica reintenta; cambio de destino con la misma clave se rechaza.
select pg_temp.check(public.revertir_org(:'org_a','77777777-7777-4777-8777-777777777777',
 :'op_retiro_ana','Carga por error, se revierte el retiro') = :'op_rev_retiro',
 'reintento de reversión devuelve el mismo ID');
select pg_temp.rechaza(format('select public.revertir_org(%L,%L,%L,%L)',
 :'org_a','77777777-7777-4777-8777-777777777777',:'op_fx_usd','Carga por error, se revierte el retiro'),
 '22023','clave de reversión no confirma otro destino');

-- Un contador autorizado a transferir no puede reutilizar la clave de otra persona.
reset role;
select id as revisor_id from public.espacio_miembros
 where espacio_id=:'org_a' and usuario_id <> '00000000-0000-0000-0000-000000000000'
   and rol_plantilla='contador' \gset
select pg_temp.como(1);
select public.actualizar_permisos_miembro(:'org_a',:'revisor_id',
 '[{"recurso":"cuentas","accion":"pagar","permitido":true},{"recurso":"cuentas","accion":"cobrar","permitido":true},{"recurso":"gastos","accion":"anular","permitido":true},{"recurso":"socios","accion":"anular","permitido":false},{"recurso":"cuentas","accion":"anular","permitido":false}]');
reset role; select pg_temp.como(3);
select pg_temp.rechaza(format(
 'select public.transferir_org(%L,%L,%L,%L,400000,400000,current_date,1,1,%L,%L,true)',
 :'org_a','11111111-1111-4111-8111-111111111111',:'c_ana',:'c_pyg','manual_confirmada',
 'Adelanto de custodia a caja con confirmación de descubierto temporal'),
 '22023','otro actor no reutiliza una clave conocida');
select pg_temp.rechaza(format('select public.revertir_org(%L,gen_random_uuid(),%L,%L)',
 :'org_a',:'op_reemb_bruno','Anulación con permiso de gastos'),
 '42501','gastos.anular no permite revertir reembolsos de socios');
select pg_temp.rechaza(format('select public.revertir_org(%L,%L,%L,%L)',
 :'org_a','77777777-7777-4777-8777-777777777777',:'op_retiro_ana','Carga por error, se revierte el retiro'),
 '42501','un reintento conocido también revalida permiso de socios');
select pg_temp.rechaza(format('select public.revertir_org(%L,gen_random_uuid(),%L,%L)',
 :'org_a',:'op_fx_usd','Anulación con permiso de gastos'),
 '42501','gastos.anular no permite revertir transferencias');
select public.revertir_org(:'org_a',gen_random_uuid(),:'op_pago_bruno','Revertir pago personal con gastos.anular');
select pg_temp.check(true,'gastos.anular permite revertir pago personal');

reset role; select pg_temp.como(1);
select public.actualizar_permisos_miembro(:'org_a',:'revisor_id',
 '[{"recurso":"socios","accion":"anular","permitido":true},{"recurso":"gastos","accion":"anular","permitido":false}]');
reset role; select pg_temp.como(3);
select public.revertir_org(:'org_a',gen_random_uuid(),:'op_reemb_bruno','Reversión autorizada de reembolso');
select pg_temp.check(true,'socios.anular permite revertir reembolso');

-- La validación debe rechazar no finitos y precisión excesiva antes de redondear.
reset role;
select pg_temp.rechaza('select public.validar_importe_tasa_org(''USD'',''NaN''::numeric,7500,''manual'')',
 '22023','rechaza importes NaN');
select pg_temp.rechaza('select public.validar_importe_tasa_org(''USD'',1,''Infinity''::numeric,''manual'')',
 '22023','rechaza tasas infinitas');
select pg_temp.rechaza('select public.validar_importe_tasa_org(''USD'',1,7500.00000000001,''manual'')',
 '22023','rechaza tasa con más precisión que el libro');
select pg_temp.como(1);
select pg_temp.rechaza(format(
 'select public.transferir_org(%L,gen_random_uuid(),%L,%L,100,0.0000004,current_date,1,7500,%L,%L)',
 :'org_a',:'c_pyg',:'c_usd','manual_confirmada','Fracción no permitida'),
 '22023','rechaza importe destino antes de redondearlo a seis decimales');

-- Un reembolso USD a otra tasa no deja una deuda fantasma en PYG.
reset role; select pg_temp.como(1);
select public.crear_cuenta_org(:'org_a','Custodia Ana USD','socio','USD',:'m_ana_id') as c_ana_usd \gset
select public.registrar_pago_personal_socio_org(:'org_a',gen_random_uuid(),:'m_ana_id',:'c_ana_usd',
 10,7500,'manual_confirmada',current_date,'Pago USD histórico') as op_usd_personal \gset
select public.registrar_movimiento_socio_org(:'org_a',gen_random_uuid(),'reembolso_socio',:'m_ana_id',:'c_usd',
 10,8000,'manual_confirmada',current_date,'Reembolso USD a tasa nueva') as op_usd_reemb \gset
select pg_temp.check((select empresa_debe_al_socio=0 and socio_debe_a_empresa=0
 and empresa_debe_al_socio_base=0 and socio_debe_a_empresa_base=0
 from public.org_reporte_socios where miembro_id=:'m_ana_id' and moneda='USD'),
 'reembolso USD salda deuda original y base histórica sin deuda residual');
select pg_temp.check((select importe_base_firmado=-80000 from public.org_apuntes where operacion_id=:'op_usd_reemb')
 and (select importe_base_firmado=-75000 from public.org_movimientos_socios where operacion_id=:'op_usd_reemb'),
 'reembolso conserva tasa efectiva de caja y valoración histórica de deuda');
select pg_temp.check((select (cambios->>'diferencia_cambio_base')::numeric=5000
 from public.org_auditoria where entidad_id=:'op_usd_reemb'),
 'diferencia de cambio del reembolso queda explícita en auditoría');

-- Sin finanzas.ver no se filtra el libro ni sus vistas calculadas.
select public.actualizar_permisos_miembro(:'org_a',:'revisor_id',
 '[{"recurso":"finanzas","accion":"ver","permitido":false}]');
reset role; select pg_temp.como(3);
select pg_temp.check(not exists(select from public.org_cuentas)
 and not exists(select from public.org_operaciones)
 and not exists(select from public.org_apuntes)
 and not exists(select from public.org_movimientos_socios)
 and not exists(select from public.org_saldos_cuentas)
 and not exists(select from public.org_reporte_socios),
 'finanzas.ver revocado oculta tablas y reportes sin renovar JWT');
rollback;
