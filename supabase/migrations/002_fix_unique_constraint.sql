-- ================================================
-- Migration 002: Corregir constraint de unicidad
-- Una llegada tarde por alumno por turno por día
-- ================================================

-- 1. Eliminar constraint antiguo (una llegada por alumno por día)
DROP INDEX IF EXISTS public.uniq_llegada_dia;

-- 2. Crear constraint correcto (una llegada por alumno por turno por día)
--    Usa los campos 'fecha' y 'turno' calculados por el trigger del servidor,
--    lo que garantiza consistencia independiente del reloj del cliente.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_llegada_turno
  ON public.llegadas_tarde (student_id, fecha, turno);
