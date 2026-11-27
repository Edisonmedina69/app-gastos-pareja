-- Solo esquema aislado reconstruido: comprobar que no se reabre el bypass legado.
do $$ begin
  if to_regprocedure('public.registrar_pago_personal_socio_org(uuid,uuid,uuid,uuid,numeric,numeric,text,date,text)') is not null
    or to_regprocedure('public.registrar_movimiento_socio_org(uuid,uuid,text,uuid,uuid,numeric,numeric,text,date,text,boolean)') is not null then
    raise exception 'Firmas legadas abiertas';
  end if;
  if has_function_privilege('authenticated','public.confirmar_comprobante_servidor_org(uuid,uuid,uuid,uuid,text,bigint,text)','execute')
    or has_function_privilege('anon','public.reservar_comprobante_org(uuid,text,uuid,text,text,bigint)','execute')
    or has_table_privilege('authenticated','public.org_adjuntos','update') then raise exception 'Grants inseguros'; end if;
  if not exists(select 1 from storage.buckets where id='org-comprobantes' and not public and file_size_limit=10485760) then
    raise exception 'Bucket inseguro'; end if;
  raise notice 'OK schema: bucket privado, firmas antiguas cerradas, confirmación exclusiva servidor y metadatos sin UPDATE cliente';
end $$;
