-- ================================================
-- Migration 010: 'usuario_nuevo' como rol por defecto al ingresar,
-- con auto-promoción a 'estudiante' al cargar sus datos.
--
-- Antes, todo login nuevo entraba directo como 'estudiante'. Ahora
-- entra como 'usuario_nuevo' (sin ningún permiso — no aparece en
-- ninguna policy RLS con privilegios, así que queda sin acceso a nada
-- salvo lo que ya tiene cualquier usuario autenticado sobre su propia
-- fila). Tiene dos caminos, ninguno forzado:
--   a) Carga sus datos en /estudiante -> un trigger lo asciende a
--      'estudiante' automáticamente en el mismo INSERT.
--   b) No hace nada -> sigue pudiendo loguearse indefinidamente como
--      'usuario_nuevo' hasta que un admin le asigne un rol a mano
--      desde Gestión de Usuarios.
-- ================================================

-- a) handle_new_user(): default 'usuario_nuevo' en vez de 'estudiante'
--    (el caso especial del email superadmin no cambia).
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
      else 'usuario_nuevo'::public.user_role
    end
  );

  return new;
end;
$$;

-- b) ensure_own_profile(): mismo default, para cuando se recrea un
--    perfil (reset o primer login sin trigger).
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
    else 'usuario_nuevo'::public.user_role
  end;

  insert into public.profiles (id, email, role)
  values (auth.uid(), my_email, new_role)
  returning * into existing;

  return existing;
end;
$$;

-- c) Auto-promoción: cargar los datos de alumno (students insert) es
--    lo que efectivamente "registra" a alguien como estudiante.
create or replace function public.promote_to_estudiante_on_registro()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  update public.profiles
     set role = 'estudiante'
   where id = new.profile_id
     and role = 'usuario_nuevo';
  return new;
end;
$$;

create trigger after_student_insert_promote
  after insert on public.students
  for each row execute function public.promote_to_estudiante_on_registro();
