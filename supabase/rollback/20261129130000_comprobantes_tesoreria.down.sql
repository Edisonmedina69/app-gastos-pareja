-- Rollback operativo compatible con el complemento: pausa escrituras, conserva toda evidencia.
-- No ejecutar el rollback original de #36 después del complemento: sus firmas ya no existen.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';
revoke execute on function
  public.crear_cuenta_org(uuid,text,text,text,uuid,text),
  public.actualizar_cuenta_org(uuid,uuid,text,text,boolean),
  public.transferir_org(uuid,uuid,uuid,uuid,numeric,numeric,date,numeric,numeric,text,text,boolean),
  public.registrar_pago_personal_socio_org(uuid,uuid,uuid,uuid,numeric,uuid,numeric,text,date,text),
  public.registrar_movimiento_socio_org(uuid,uuid,text,uuid,uuid,numeric,uuid,numeric,text,date,text,boolean),
  public.revertir_org(uuid,uuid,uuid,text,date),
  public.reservar_comprobante_org(uuid,text,uuid,text,text,bigint),
  public.obtener_reserva_comprobante_org(uuid,uuid),
  public.listar_reservas_comprobante_org(uuid,text,uuid),
  public.descartar_comprobante_org(uuid,uuid)
from authenticated;
revoke execute on function public.descartar_reservas_vencidas_org(integer) from service_role;
revoke execute on function public.confirmar_comprobante_servidor_org(uuid,uuid,uuid,uuid,text,bigint,text) from service_role;
drop policy org_comprobantes_subir on storage.objects;
-- Se conservan la política restrictiva de subida, toda protección de borrado y la lectura autorizada.
commit;
