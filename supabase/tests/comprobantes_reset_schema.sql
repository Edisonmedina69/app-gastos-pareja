-- SOLO stack de test efímero. Nunca aplicar esta fixture en producción.
begin;
set local storage.allow_delete_query = 'true';
drop trigger if exists proteger_objeto_comprobante_org on storage.objects;
drop policy if exists org_comprobantes_subir on storage.objects;
drop policy if exists org_comprobantes_insert_guard on storage.objects;
drop policy if exists org_comprobantes_read_guard on storage.objects;
drop policy if exists org_comprobantes_update_guard on storage.objects;
drop policy if exists org_comprobantes_delete_guard on storage.objects;
drop policy if exists org_comprobantes_anon_guard on storage.objects;
delete from storage.objects where bucket_id='org-comprobantes';
delete from storage.buckets where id='org-comprobantes';
drop schema public cascade;
create schema public;
grant usage on schema public to public;

commit;
