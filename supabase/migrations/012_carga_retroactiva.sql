-- ================================================
-- Migration 012: Carga retroactiva de llegadas tarde
-- Permite a un preceptor/admin asentar llegadas tarde de fechas
-- pasadas (recolectadas en papel durante una caída del sistema o
-- de la conexión a internet) sin depender del reloj del servidor.
-- ================================================

-- fill_llegada() decide su comportamiento según new.metodo:
--   - metodo = 'manual_retroactivo': el cliente indica fecha y turno a
--     mano. Se valida que no sea una fecha futura y se calcula una hora
--     nominal según el turno (no hay hora exacta real que registrar).
--   - cualquier otro metodo ('qr', 'manual'): comportamiento sin cambios,
--     fecha/hora/turno siempre se calculan con el reloj del servidor —
--     el cliente no puede spoofear un registro "en vivo".
create or replace function public.fill_llegada()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  s      record;
  ahora  timestamp := (now() at time zone 'America/Argentina/Buenos_Aires');
  hoy    date := ahora::date;
begin
  select nombre, apellido, grado, division
    into s
    from public.students
   where id = new.student_id;

  if not found then
    raise exception 'Estudiante no encontrado (id: %)', new.student_id;
  end if;

  new.nombre   := s.nombre;
  new.apellido := s.apellido;
  new.grado    := s.grado;
  new.division := s.division;

  if new.metodo = 'manual_retroactivo' then
    if new.fecha is null or new.turno is null then
      raise exception 'La carga retroactiva requiere fecha y turno';
    end if;
    if new.fecha > hoy then
      raise exception 'No se puede cargar una llegada tarde con fecha futura';
    end if;
    new.hora := case when new.turno = 'mañana' then time '08:00:00' else time '13:30:00' end;
  else
    new.fecha := hoy;
    new.hora  := ahora::time;
    new.turno := case
                   when extract(hour from ahora) >= 13
                   then 'tarde'::public.turno_tipo
                   else 'mañana'::public.turno_tipo
                 end;
  end if;

  return new;
end;
$$;
