-- ================================================
-- Migration 006: Métricas del dashboard por período
-- (hoy / esta semana / este mes, con split por turno en cada una)
-- ================================================

create or replace function public.dashboard_metrics_periodos()
returns jsonb
language plpgsql
stable
as $$
declare
  hoy_ar        date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  -- Lunes de la semana actual (extract(isodow ...): lunes=1 ... domingo=7)
  inicio_semana date := hoy_ar - (extract(isodow from hoy_ar)::int - 1);
  inicio_mes    date := date_trunc('month', hoy_ar)::date;
begin
  return jsonb_build_object(
    'hoy', jsonb_build_object(
      'fecha', hoy_ar,
      'total', (select count(*) from public.llegadas_tarde where fecha = hoy_ar),
      'manana', (select count(*) from public.llegadas_tarde where fecha = hoy_ar and turno = 'mañana'),
      'tarde', (select count(*) from public.llegadas_tarde where fecha = hoy_ar and turno = 'tarde')
    ),
    'semana', jsonb_build_object(
      'desde', inicio_semana,
      'hasta', hoy_ar,
      'total', (select count(*) from public.llegadas_tarde where fecha between inicio_semana and hoy_ar),
      'manana', (select count(*) from public.llegadas_tarde where fecha between inicio_semana and hoy_ar and turno = 'mañana'),
      'tarde', (select count(*) from public.llegadas_tarde where fecha between inicio_semana and hoy_ar and turno = 'tarde')
    ),
    'mes', jsonb_build_object(
      'desde', inicio_mes,
      'hasta', hoy_ar,
      'total', (select count(*) from public.llegadas_tarde where fecha between inicio_mes and hoy_ar),
      'manana', (select count(*) from public.llegadas_tarde where fecha between inicio_mes and hoy_ar and turno = 'mañana'),
      'tarde', (select count(*) from public.llegadas_tarde where fecha between inicio_mes and hoy_ar and turno = 'tarde')
    ),
    'porGrado', (
      select coalesce(jsonb_object_agg(grado || ' ' || division, cnt), '{}'::jsonb)
      from (
        select grado, division, count(*) cnt
        from public.llegadas_tarde
        where fecha between inicio_mes and hoy_ar
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

grant execute on function public.dashboard_metrics_periodos() to authenticated;

-- Ya no se usa, todo el dashboard pasa a la nueva RPC por período.
drop function if exists public.dashboard_metrics_30d();
