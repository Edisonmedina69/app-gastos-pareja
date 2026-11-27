-- =============================================================================
-- ROLLBACK de 20261126120000_p0_aislamiento_espacios.sql
-- Vuelve EXACTAMENTE al estado anterior (al 2026-11-26), CON los agujeros de
-- seguridad P0 incluidos. Usar solo si la migración rompe la app en producción.
-- =============================================================================
begin;

-- Triggers y RPC nuevas
drop trigger if exists tr_proteger_perfil on public.perfiles;
drop function if exists public.proteger_perfil();
drop function if exists public.unirse_a_espacio(text, text);
drop function if exists public.crear_espacio(text, text);

-- Funciones originales
set check_function_bodies = off;
create or replace function public.mi_espacio_id() returns uuid language sql stable security definer
  set search_path to 'public'
as $$ select espacio_id from public.perfiles where id = auth.uid() limit 1; $$;

create or replace function public.es_superadmin() returns boolean language sql stable security definer
as $$ select coalesce((select rol = 'superadmin' from public.perfiles where id = auth.uid()), false); $$;
alter function public.es_superadmin() reset search_path;

create or replace function public.mis_espacios() returns setof uuid language sql stable security definer
as $$ select espacio_id from public.usuarios_espacios where usuario_id = auth.uid(); $$;
alter function public.mis_espacios() reset search_path;

create or replace function public.verificar_espacio_disponible(p_espacio_id uuid) returns boolean
language plpgsql volatile security definer
as $$
declare v_limite integer; v_actual integer;
begin
  select limite_usuarios into v_limite from espacios where id = p_espacio_id;
  select count(*) into v_actual from perfiles where espacio_id = p_espacio_id;
  return v_actual < v_limite;
end; $$;
alter function public.verificar_espacio_disponible(uuid) reset search_path;

alter function public.generar_cuotas(text, numeric, text, integer, date, numeric, bigint, uuid) reset search_path;

create or replace function public.validar_limite_usuarios() returns trigger language plpgsql security invoker
as $$
declare limite integer; actual integer;
begin
  if tg_op = 'UPDATE' then
    if old.espacio_id is not distinct from new.espacio_id then return new; end if;
  end if;
  if new.espacio_id is null then return new; end if;
  select limite_usuarios into limite from public.espacios where id = new.espacio_id;
  if limite is null then return new; end if;
  select count(*)::integer into actual from public.perfiles where espacio_id = new.espacio_id and id <> new.id;
  if actual >= limite then
    raise exception 'Límite de usuarios alcanzado para este plan (%)', limite;
  end if;
  return new;
end; $$;
alter function public.validar_limite_usuarios() reset search_path;

grant execute on function public.mi_espacio_id(), public.es_superadmin(), public.mis_espacios(),
  public.verificar_espacio_disponible(uuid), public.validar_limite_usuarios(),
  public.generar_cuotas(text, numeric, text, integer, date, numeric, bigint, uuid)
  to public, anon, authenticated, service_role;

-- espacios
drop policy if exists "Ver mi propio espacio" on public.espacios;
drop policy if exists "Superadmin gestiona todo espacios" on public.espacios;
create policy "Ver mi propio espacio" on public.espacios for select to public using (id = mi_espacio_id());
create policy "Superadmin gestiona todo espacios" on public.espacios for all to public using (es_superadmin());
create policy "Permitir crear espacios a usuarios autenticados" on public.espacios for insert to public with check (auth.role() = 'authenticated');
create policy "RLS_Espacios_Insert" on public.espacios for insert to public with check (true);
create policy "RLS_Espacios_Select_Public" on public.espacios for select to public using (true);

-- perfiles
drop policy if exists "Ver perfiles de mi espacio" on public.perfiles;
drop policy if exists "Insertar perfil propio" on public.perfiles;
drop policy if exists "Actualizar perfil propio" on public.perfiles;
drop policy if exists "Borrar perfil propio" on public.perfiles;
drop policy if exists "Superadmin gestiona todo perfiles" on public.perfiles;
create policy "Ver perfiles de mi espacio" on public.perfiles for select to public using ((id = auth.uid()) or (espacio_id = mi_espacio_id()));
create policy "Insertar perfil propio" on public.perfiles for insert to public with check (id = auth.uid());
create policy "Actualizar perfil propio" on public.perfiles for update to public using (id = auth.uid());
create policy "Superadmin gestiona todo perfiles" on public.perfiles for all to public using (es_superadmin());
create policy "Ver o proprio perfil" on public.perfiles for select to public using (id = auth.uid());
create policy "RLS_Perfiles_Propio" on public.perfiles for all to public using (auth.uid() = id);
create policy "RLS_Perfiles_Hogar" on public.perfiles for select to public using (espacio_id = mi_espacio_id());

-- cuentas_maestras / cuentas_pendientes / prestamos_personales
drop policy if exists "Cuentas Maestras: Acceso a mi espacio" on public.cuentas_maestras;
create policy "Cuentas Maestras: Acceso a mi espacio" on public.cuentas_maestras for all to public using (espacio_id in (select mis_espacios()));
create policy "Permitir todo a usuarios autenticados en cuentas_maestras" on public.cuentas_maestras for all to authenticated using (true);
drop policy if exists "Cuentas: Acceso a mi espacio" on public.cuentas_pendientes;
create policy "Cuentas: Acceso a mi espacio" on public.cuentas_pendientes for all to public using (espacio_id in (select mis_espacios()));
create policy "Aislamiento por espacio" on public.cuentas_pendientes for all to public using (espacio_id in (select mis_espacios()));
drop policy if exists "Prestamos: Acceso a mi espacio" on public.prestamos_personales;
create policy "Prestamos: Acceso a mi espacio" on public.prestamos_personales for all to public using (espacio_id in (select mis_espacios()));

-- Tablas de datos
do $$
declare r record;
begin
  for r in select * from (values
      ('gastos', 'Gestionar gastos'), ('ingresos_mensuales', 'Gestionar ingresos'),
      ('notificaciones', 'Gestionar mis notificaciones'), ('deudas_maestras', 'Gestionar deudas'),
      ('cuotas_detalle', 'Gestionar cuotas'), ('ingresos_programados', 'Gestionar mis ingresos programados'),
      ('historial_salarios', 'Ver mi historial de salarios')) as t(tabla, politica)
  loop
    execute format('drop policy if exists %I on public.%I', r.politica, r.tabla);
    execute format('create policy %I on public.%I for all to public using (espacio_id = mi_espacio_id())', r.politica, r.tabla);
  end loop;
end $$;

commit;
