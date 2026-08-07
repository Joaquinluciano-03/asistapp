-- ================================================
-- Migration 013: Tendencia semanal del dashboard con split por turno
-- Antes: "porDia" eran los últimos 7 días corridos (incluía sábado y
-- domingo, sin turno). Ahora: solo lunes a viernes de la semana actual
-- (mismo rango que la tarjeta "Esta semana"), cada día con su
-- desglose mañana/tarde — para aprovechar el espacio que dejan los
-- dos días sin actividad escolar.
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
      -- Lunes a viernes de la semana actual (5 días, sin fin de semana),
      -- con desglose mañana/tarde por día.
      select coalesce(jsonb_agg(jsonb_build_object(
        'fecha', d,
        'manana', (select count(*) from public.llegadas_tarde where fecha = d and turno = 'mañana'),
        'tarde', (select count(*) from public.llegadas_tarde where fecha = d and turno = 'tarde')
      ) order by d), '[]'::jsonb)
      from (
        select (inicio_semana + i)::date as d
        from generate_series(0, 4) i
      ) x
    )
  );
end;
$$;

grant execute on function public.dashboard_metrics_periodos() to authenticated;
