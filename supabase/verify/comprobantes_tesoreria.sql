-- Verificación NO destructiva. Usar db query --read-only con administración.
select jsonb_build_object(
  'historial',(select jsonb_agg(jsonb_build_object('version',version,'name',name) order by version) from supabase_migrations.schema_migrations),
  'contrato',jsonb_build_object(
    'adjuntos',to_regclass('public.org_adjuntos') is not null,
    'firma_personal_antigua_cerrada',to_regprocedure('public.registrar_pago_personal_socio_org(uuid,uuid,uuid,uuid,numeric,numeric,text,date,text)') is null,
    'firma_socio_antigua_cerrada',to_regprocedure('public.registrar_movimiento_socio_org(uuid,uuid,text,uuid,uuid,numeric,numeric,text,date,text,boolean)') is null,
    'escritura_nueva',has_function_privilege('authenticated','public.registrar_pago_personal_socio_org(uuid,uuid,uuid,uuid,numeric,uuid,numeric,text,date,text)','execute'),
    'confirmacion_privada',not has_function_privilege('authenticated','public.confirmar_comprobante_servidor_org(uuid,uuid,uuid,uuid,text,bigint,text)','execute'),
    'verificador_habilitado',has_function_privilege('service_role','public.confirmar_comprobante_servidor_org(uuid,uuid,uuid,uuid,text,bigint,text)','execute'),
    'metadatos_protegidos',not has_table_privilege('authenticated','public.org_adjuntos','update')),
  'bucket',(select jsonb_build_object('id',id,'privado',not public,'file_size_limit',file_size_limit,'allowed_mime_types',allowed_mime_types) from storage.buckets where id='org-comprobantes'),
  'politicas_storage',(select jsonb_agg(jsonb_build_object('nombre',policyname,'tipo',permissive,'cmd',cmd) order by policyname) from pg_policies where schemaname='storage' and policyname like 'org_comprobantes_%'),
  'operaciones_sin_evidencia_valida',(select count(*) from public.org_operaciones o left join public.org_adjuntos a on a.id=o.comprobante_id and a.espacio_id=o.espacio_id
    where o.tipo in ('financiacion_socio','reembolso_socio','retiro_socio') and (a.id is null or a.estado<>'consumido' or a.verificado_at is null or a.sha256 is null or a.storage_object_id is null)),
  'consumidos_sin_operacion',(select count(*) from public.org_adjuntos a where a.estado='consumido' and not exists(select 1 from public.org_operaciones o where o.espacio_id=a.espacio_id and o.comprobante_id=a.id)),
  'constraints',(select jsonb_agg(jsonb_build_object('nombre',conname,'validada',convalidated) order by conname) from pg_constraint where conrelid in ('public.org_adjuntos'::regclass,'public.org_operaciones'::regclass) and (conname like '%comprobante%' or conname like 'org_adjuntos_check%')),
  'triggers',(select jsonb_agg(jsonb_build_object('nombre',tgname,'habilitado',tgenabled) order by tgname) from pg_trigger where not tgisinternal and tgname in ('proteger_adjunto_org','validar_consumo_comprobante_org','validar_comprobante_operacion_org','proteger_objeto_comprobante_org'))
) as verificacion;
