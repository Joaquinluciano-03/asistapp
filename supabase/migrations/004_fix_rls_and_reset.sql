-- ================================================
-- Migration 004: Arreglar gaps de RLS (rol preceptor,
-- edición/borrado de alumnos), borrado = reset sin perder
-- historial, y reset anual de llegadas_tarde.
-- ================================================

-- ══════════════════════════════════════════════════
-- a) RLS: incluir 'preceptor' donde debió agregarse en 003
-- ══════════════════════════════════════════════════

drop policy if exists "llegadas: admin insert" on public.llegadas_tarde;
create policy "llegadas: staff insert"
  on public.llegadas_tarde for insert
  with check (public.get_role() in ('admin', 'superadmin', 'preceptor'));

drop policy if exists "llegadas: admin read" on public.llegadas_tarde;
create policy "llegadas: staff read"
  on public.llegadas_tarde for select
  using (public.get_role() in ('admin', 'superadmin', 'preceptor'));

drop policy if exists "students: admin read all" on public.students;
create policy "students: staff read all"
  on public.students for select
  using (public.get_role() in ('admin', 'superadmin', 'preceptor'));

drop policy if exists "profiles: admin update roles" on public.profiles;
create policy "profiles: admin update roles"
  on public.profiles for update
  using (
    public.get_role() in ('admin', 'superadmin')
    and id <> auth.uid()          -- cannot change own role
    and role <> 'superadmin'      -- cannot touch superadmin
  )
  with check (
    case
      when public.get_role() = 'admin'
        -- admin can assign estudiante, preceptor or admin
        then role in ('estudiante', 'preceptor', 'admin')
      when public.get_role() = 'superadmin'
        then true
      else false
    end
  );

-- ══════════════════════════════════════════════════
-- b) UPDATE en students para staff (no existía ninguna)
-- ══════════════════════════════════════════════════

create policy "students: staff update"
  on public.students for update
  using (public.get_role() in ('admin', 'superadmin', 'preceptor'))
  with check (public.get_role() in ('admin', 'superadmin', 'preceptor'));

-- Resguardo: ni siquiera el staff puede reasignar la identidad del alumno
-- (id / profile_id / created_at) a través de esta policy.
create or replace function public.lock_student_identity()
returns trigger
language plpgsql
as $$
begin
  if new.id <> old.id
     or new.profile_id is distinct from old.profile_id
     or new.created_at <> old.created_at then
    raise exception 'No se pueden modificar id/profile_id/created_at de un alumno';
  end if;
  return new;
end;
$$;

create trigger before_student_update_lock_identity
  before update on public.students
  for each row execute function public.lock_student_identity();

-- ══════════════════════════════════════════════════
-- c) UPDATE en llegadas_tarde para staff
--    (necesario para la sincronización retroactiva al editar un alumno)
-- ══════════════════════════════════════════════════

create policy "llegadas: staff update"
  on public.llegadas_tarde for update
  using (public.get_role() in ('admin', 'superadmin', 'preceptor'))
  with check (public.get_role() in ('admin', 'superadmin', 'preceptor'));

-- ══════════════════════════════════════════════════
-- d) Restructurar FKs: "eliminar" = reset sin perder historial
-- ══════════════════════════════════════════════════

-- students.profile_id ahora referencia profiles.id (no auth.users.id):
-- borrar un profiles row borra en cascada su students row automáticamente.
alter table public.students drop constraint students_profile_id_fkey;
alter table public.students
  add constraint students_profile_id_fkey
  foreign key (profile_id) references public.profiles(id) on delete cascade;

-- llegadas_tarde.student_id: SET NULL en vez de CASCADE. Cada fila ya
-- guarda el snapshot de nombre/apellido/grado/división, así que al
-- resetear un alumno el historial sobrevive (solo pierde el link).
alter table public.llegadas_tarde alter column student_id drop not null;
alter table public.llegadas_tarde drop constraint llegadas_tarde_student_id_fkey;
alter table public.llegadas_tarde
  add constraint llegadas_tarde_student_id_fkey
  foreign key (student_id) references public.students(id) on delete set null;

-- ══════════════════════════════════════════════════
-- e) DELETE policies que faltaban
-- ══════════════════════════════════════════════════

create policy "profiles: admin delete"
  on public.profiles for delete
  using (
    public.get_role() in ('admin', 'superadmin')
    and id <> auth.uid()
    and role <> 'superadmin'
  );

create policy "students: admin delete"
  on public.students for delete
  using (public.get_role() in ('admin', 'superadmin'));

-- ══════════════════════════════════════════════════
-- f) Auto-recuperación de perfil
--    Si a un usuario le "resetearon" su cuenta (se borró su profiles row)
--    y vuelve a loguearse, el trigger de auth.users no vuelve a disparar
--    (no hay un nuevo INSERT). Esta función cubre ese caso desde el cliente.
-- ══════════════════════════════════════════════════

create or replace function public.ensure_own_profile()
returns public.profiles
language plpgsql
security definer set search_path = public
as $$
declare
  existing  public.profiles;
  my_email  text;
  new_role  public.user_role;
begin
  select * into existing from public.profiles where id = auth.uid();
  if found then
    return existing;
  end if;

  select email into my_email from auth.users where id = auth.uid();

  if my_email is null then
    raise exception 'No hay usuario autenticado';
  end if;

  if my_email not like '%@donorionevictoria.com.ar' then
    raise exception 'Dominio no autorizado: solo se permiten cuentas @donorionevictoria.com.ar';
  end if;

  new_role := case
    when my_email = 'asistencia@donorionevictoria.com.ar'
    then 'superadmin'::public.user_role
    else 'estudiante'::public.user_role
  end;

  insert into public.profiles (id, email, role)
  values (auth.uid(), my_email, new_role)
  returning * into existing;

  return existing;
end;
$$;

grant execute on function public.ensure_own_profile() to authenticated;

-- ══════════════════════════════════════════════════
-- g) Reset anual de llegadas_tarde (31/12, hora Argentina)
--    Se invoca todos los días desde un cron externo; el guard de fecha
--    decide si realmente borra algo, así es seguro exponerla sin
--    necesitar la service_role key.
-- ══════════════════════════════════════════════════

create or replace function public.reset_llegadas_anual()
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  ahora timestamp := (now() at time zone 'America/Argentina/Buenos_Aires');
begin
  if extract(month from ahora) = 12 and extract(day from ahora) = 31 then
    delete from public.llegadas_tarde;
  end if;
end;
$$;

grant execute on function public.reset_llegadas_anual() to anon, authenticated;
