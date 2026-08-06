-- ================================================
-- Migration 008: Limpiar ficha de alumno al ascender a staff
--
-- Cambiar el rol de un perfil de 'estudiante' a otro rol (preceptor/
-- admin) es un UPDATE sobre profiles.role — no dispara la cascada que
-- sí dispara un DELETE. Sin este trigger, la fila en students queda
-- huérfana: invisible en GestionUsuarios.tsx (que filtra por
-- role === 'estudiante'), pero sigue apareciendo entera en el
-- buscador de AdminScanner.tsx y su carnet QR físico viejo sigue
-- siendo válido — alguien podría terminar registrado como "llegada
-- tarde" con datos de alumno que ya no le corresponden.
--
-- Mismo mecanismo que el reset manual (migración 004): borrar
-- students dispara ON DELETE SET NULL en llegadas_tarde.student_id,
-- así que el historial de esa persona se conserva, solo pierde el
-- link al alumno que ya no existe.
-- ================================================

create or replace function public.cleanup_student_on_role_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if old.role = 'estudiante' and new.role <> 'estudiante' then
    delete from public.students where profile_id = new.id;
  end if;
  return new;
end;
$$;

create trigger after_profile_role_change_cleanup
  after update on public.profiles
  for each row execute function public.cleanup_student_on_role_change();
