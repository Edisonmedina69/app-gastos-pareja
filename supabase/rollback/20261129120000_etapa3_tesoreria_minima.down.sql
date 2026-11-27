-- Rollback funcional de Etapa 3: desactiva las RPC de escritura de tesorería
-- conservando todas las tablas, asientos, apuntes, deudas y vistas de lectura
-- administrativa para rescate. Nunca borra datos financieros (PLAN_ORGANIZACION.md §6).
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';
revoke execute on function
  public.crear_cuenta_org(uuid,text,text,text,uuid,text),
  public.actualizar_cuenta_org(uuid,uuid,text,text,boolean),
  public.transferir_org(uuid,uuid,uuid,uuid,numeric,numeric,date,numeric,numeric,text,text,boolean),
  public.registrar_pago_personal_socio_org(uuid,uuid,uuid,uuid,numeric,numeric,text,date,text),
  public.registrar_movimiento_socio_org(uuid,uuid,text,uuid,uuid,numeric,numeric,text,date,text,boolean),
  public.revertir_org(uuid,uuid,uuid,text,date)
from authenticated;
commit;
