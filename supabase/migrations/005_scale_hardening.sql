-- ================================================
-- Migration 005: Preparar el sistema para alto volumen
-- (~600 llegadas tarde/día, ~144.000/año antes del reset).
-- ================================================

-- ══════════════════════════════════════════════════
-- a) Métricas del dashboard vía agregación SQL
--    Reemplaza el "traer todas las filas de 30 días y reducir en el
--    cliente" de AdminDashboard.tsx, que se corta en silencio al pasar
--    las 1000 filas por request de Supabase/PostgREST. security invoker
--    (default): respeta RLS igual que hoy, solo staff puede leer.
-- ══════════════════════════════════════════════════

create or replace function public.dashboard_metrics_30d()
returns jsonb
language plpgsql
stable
as $$
declare
  hoy_ar date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  desde  date := hoy_ar - interval '30 days';
begin
  return jsonb_build_object(
    'total', (select count(*) from public.llegadas_tarde where fecha >= desde),
    'hoy', (select count(*) from public.llegadas_tarde where fecha = hoy_ar),
    'manana', (select count(*) from public.llegadas_tarde where fecha >= desde and turno = 'mañana'),
    'tarde', (select count(*) from public.llegadas_tarde where fecha >= desde and turno = 'tarde'),
    'porGrado', (
      select coalesce(jsonb_object_agg(grado || ' ' || division, cnt), '{}'::jsonb)
      from (
        select grado, division, count(*) cnt
        from public.llegadas_tarde
        where fecha >= desde
        group by grado, division
      ) g
    ),
    'porDia', (
      select coalesce(jsonb_agg(jsonb_build_object('fecha', d, 'count', cnt) order by d), '[]'::jsonb)
      from (
        select
          gs::date as d,
          (select count(*) from public.llegadas_tarde where fecha = gs::date) as cnt
        from generate_series(hoy_ar - interval '6 days', hoy_ar, interval '1 day') gs
      ) x
    )
  );
end;
$$;

grant execute on function public.dashboard_metrics_30d() to authenticated;

-- ══════════════════════════════════════════════════
-- b) Índices para sostener el volumen
-- ══════════════════════════════════════════════════

-- Planillas ordena/filtra por fecha+hora — es la consulta más pesada
-- del sistema a este volumen.
create index if not exists idx_llegadas_fecha_hora
  on public.llegadas_tarde (fecha desc, hora desc);

-- Búsqueda de alumnos por nombre/apellido (ilike '%...%') en
-- AdminScanner/AdminManual — trigram + GIN para que siga siendo rápida
-- si el padrón de alumnos también crece.
create extension if not exists pg_trgm;

create index if not exists idx_students_nombre_trgm
  on public.students using gin (nombre gin_trgm_ops);

create index if not exists idx_students_apellido_trgm
  on public.students using gin (apellido gin_trgm_ops);

-- ══════════════════════════════════════════════════
-- c) Reset anual: TRUNCATE en vez de DELETE
--    Mismo resultado (vacía la tabla), pero no escanea fila por fila —
--    a ~150.000 filas/año la diferencia es real. Redefinir la función
--    es seguro aunque la 004 ya se haya aplicado.
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
    truncate public.llegadas_tarde;
  end if;
end;
$$;
