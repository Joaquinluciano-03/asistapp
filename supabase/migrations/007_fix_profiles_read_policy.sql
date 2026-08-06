-- ================================================
-- Migration 007: Incluir 'preceptor' en la lectura de profiles
--
-- La 004 actualizó las policies de students/llegadas_tarde/cambio de
-- roles para incluir 'preceptor', pero se salteó "profiles: admin read
-- all". Efecto: GestionUsuarios.tsx hace un SELECT * sobre profiles
-- para armar la lista de usuarios/alumnos; para un preceptor esa
-- policy filtraba el resultado a una sola fila (la propia), dejando
-- la pantalla de Gestión de Usuarios prácticamente vacía pese a que
-- la ruta y el resto de las policies sí le dan acceso.
-- ================================================

drop policy if exists "profiles: admin read all" on public.profiles;

create policy "profiles: staff read all"
  on public.profiles for select
  using (public.get_role() in ('admin', 'superadmin', 'preceptor'));
