-- ================================================
-- Migration 009: Agregar el rol 'usuario_nuevo' al enum
--
-- Va en un archivo aparte de la 010 (que lo usa en funciones nuevas)
-- porque Postgres no permite usar un valor de enum recién agregado
-- dentro de la misma transacción en la que se agregó.
-- ================================================

ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'usuario_nuevo';
