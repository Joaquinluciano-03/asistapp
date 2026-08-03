-- ================================================
-- Migration 001: Enums, Tables, Triggers, RLS
-- Escuela Don Orione Victoria — AsistApp
-- ================================================

-- ── Enums ─────────────────────────────────────────
create type public.user_role as enum ('estudiante', 'admin', 'superadmin');
create type public.turno_tipo as enum ('mañana', 'tarde');

-- ── Helper: get current user role ─────────────────
create or replace function public.get_role()
returns public.user_role
language sql
stable
security definer set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

-- ── Table: profiles ────────────────────────────────
create table public.profiles (
  id         uuid        primary key references auth.users(id) on delete cascade,
  email      text        unique not null,
  role       public.user_role not null default 'estudiante',
  created_at timestamptz not null default now()
);

-- ── Table: students ────────────────────────────────
create table public.students (
  id         uuid        primary key default gen_random_uuid(),
  profile_id uuid        unique references auth.users(id) on delete cascade,
  nombre     text        not null,
  apellido   text        not null,
  grado      text        not null,
  division   text        not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── Table: llegadas_tarde ──────────────────────────
create table public.llegadas_tarde (
  id                    uuid        primary key default gen_random_uuid(),
  student_id            uuid        not null references public.students(id) on delete cascade,
  nombre                text        not null,
  apellido              text        not null,
  grado                 text        not null,
  division              text        not null,
  fecha                 date        not null,
  hora                  time        not null,
  turno                 public.turno_tipo not null,
  metodo                text        not null default 'qr',
  registrado_por        uuid        references auth.users(id),
  registrado_por_email  text,
  created_at            timestamptz not null default now()
);

-- Unique: one late arrival per student per day
create unique index uniq_llegada_dia on public.llegadas_tarde (student_id, fecha);

-- ── Trigger 1: domain check + profile creation ─────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  -- Enforce domain restriction (allow specific gmail for testing)
  if new.email not like '%@donorionevictoria.com.ar' and new.email != 'asistenciaido@gmail.com' then
    raise exception 'Dominio no autorizado: solo se permiten cuentas @donorionevictoria.com.ar';
  end if;

  insert into public.profiles (id, email, role)
  values (
    new.id,
    new.email,
    case
      when new.email = 'asistencia@donorionevictoria.com.ar' or new.email = 'asistenciaido@gmail.com'
      then 'superadmin'::public.user_role
      else 'estudiante'::public.user_role
    end
  );

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Trigger 2: auto-fill llegada data server-side ──
create or replace function public.fill_llegada()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  s      record;
  ahora  timestamp := (now() at time zone 'America/Argentina/Buenos_Aires');
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
  new.fecha    := ahora::date;
  new.hora     := ahora::time;
  new.turno    := case
                    when extract(hour from ahora) >= 13
                    then 'tarde'::public.turno_tipo
                    else 'mañana'::public.turno_tipo
                  end;

  return new;
end;
$$;

create trigger before_llegada_insert
  before insert on public.llegadas_tarde
  for each row execute function public.fill_llegada();

-- ── Enable RLS ─────────────────────────────────────
alter table public.profiles       enable row level security;
alter table public.students       enable row level security;
alter table public.llegadas_tarde enable row level security;

-- ══════════════════════════════════════════════════
-- RLS Policies: profiles
-- ══════════════════════════════════════════════════

-- Own row read
create policy "profiles: own read"
  on public.profiles for select
  using (id = auth.uid());

-- Admin/superadmin read all
create policy "profiles: admin read all"
  on public.profiles for select
  using (public.get_role() in ('admin', 'superadmin'));

-- Admin can update role between estudiante and admin only
create policy "profiles: admin update roles"
  on public.profiles for update
  using (
    public.get_role() in ('admin', 'superadmin')
    and id <> auth.uid()          -- cannot change own role
    and role <> 'superadmin'      -- cannot touch superadmin
  )
  with check (
    case
      when public.get_role() = 'admin'
        -- admin can only assign estudiante or admin
        then role in ('estudiante', 'admin') and role <> 'superadmin'
      when public.get_role() = 'superadmin'
        then true
      else false
    end
  );

-- ══════════════════════════════════════════════════
-- RLS Policies: students
-- ══════════════════════════════════════════════════

-- Student reads/writes their own row
create policy "students: own read"
  on public.students for select
  using (profile_id = auth.uid());

create policy "students: own insert"
  on public.students for insert
  with check (profile_id = auth.uid());

create policy "students: own update"
  on public.students for update
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- Admin/superadmin read all (needed for scanning and manual entry)
create policy "students: admin read all"
  on public.students for select
  using (public.get_role() in ('admin', 'superadmin'));

-- ══════════════════════════════════════════════════
-- RLS Policies: llegadas_tarde
-- ══════════════════════════════════════════════════

-- Only admin/superadmin can insert
create policy "llegadas: admin insert"
  on public.llegadas_tarde for insert
  with check (public.get_role() in ('admin', 'superadmin'));

-- Only admin/superadmin can read all
create policy "llegadas: admin read"
  on public.llegadas_tarde for select
  using (public.get_role() in ('admin', 'superadmin'));
