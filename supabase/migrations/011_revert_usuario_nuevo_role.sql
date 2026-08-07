-- ================================================
-- Migration 011: Revertir el rol 'usuario_nuevo' — vuelta a que todo
-- login nuevo entre directo como 'estudiante', como antes de la 009/010.
--
-- Postgres no permite borrar un valor de un enum (`ALTER TYPE ... DROP
-- VALUE` no existe), así que 'usuario_nuevo' queda definido en el tipo
-- pero deja de usarse en ningún lado — inofensivo, ninguna fila nueva
-- lo va a tener.
--
-- Segura de correr tanto si las migraciones 009/010 se aplicaron como
-- si nunca se aplicaron (el UPDATE de más abajo solo se ejecuta si el
-- enum realmente tiene el valor 'usuario_nuevo').
-- ================================================

-- a) handle_new_user(): vuelve a defaultear 'estudiante'.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.email not like '%@donorionevictoria.com.ar' then
    raise exception 'Dominio no autorizado: solo se permiten cuentas @donorionevictoria.com.ar';
  end if;

  insert into public.profiles (id, email, role)
  values (
    new.id,
    new.email,
    case
      when new.email = 'asistencia@donorionevictoria.com.ar'
      then 'superadmin'::public.user_role
      else 'estudiante'::public.user_role
    end
  );

  return new;
end;
$$;

-- b) ensure_own_profile(): mismo default.
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

-- c) Ya no hace falta ascender a nadie — dropear el trigger/función.
drop trigger if exists after_student_insert_promote on public.students;
drop function if exists public.promote_to_estudiante_on_registro();

-- d) Si llegó a haber perfiles reales creados como 'usuario_nuevo'
--    (o sea, si la 009/010 se aplicaron y alguien se logueó mientras
--    tanto), migrarlos de vuelta a 'estudiante'. El chequeo contra
--    pg_enum hace que este bloque sea un no-op seguro si el enum
--    nunca llegó a tener el valor 'usuario_nuevo'.
do $$
begin
  if exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'user_role' and e.enumlabel = 'usuario_nuevo'
  ) then
    update public.profiles set role = 'estudiante' where role = 'usuario_nuevo';
  end if;
end $$;
