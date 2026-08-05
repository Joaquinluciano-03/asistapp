-- ================================================
-- Migration 003: Añadir rol preceptor
-- ================================================

-- Agregar 'preceptor' al enum de roles. 
-- PostgreSQL permite agregar valores al final del enum.
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'preceptor';
