-- =====================================================================
--  USUARIOS Y ROLES — PASO 1 de 2  (seguro de correr en cualquier momento)
--  Supabase → SQL Editor → New query → pega y ejecuta.
--  No cambia el acceso actual: el sitio sigue funcionando igual.
-- =====================================================================

-- Perfil de cada usuario del estudio. Solo quien tiene perfil puede entrar a los datos:
-- una cuenta creada por fuera (registro público) sin perfil no ve nada.
create table if not exists profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  nombre     text not null default '',
  rol        text not null default 'operador' check (rol in ('admin', 'operador')),
  created_at timestamptz default now()
);
alter table profiles enable row level security;

-- Helpers para las políticas (security definer: leen profiles sin depender de su RLS)
create or replace function public.is_staff() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid())
$$;

create or replace function public.is_admin() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and rol = 'admin')
$$;

-- Cada quien lee su propio perfil; el admin ve todos. Las altas/cambios van por /api/users.
drop policy if exists "profiles_select" on profiles;
create policy "profiles_select" on profiles for select using (id = auth.uid() or is_admin());

-- Quién registró cada cobro (permite que el operador deshaga solo su cobro recién hecho)
alter table session_pagos add column if not exists created_by uuid default auth.uid();

-- El trigger de abajo lee esta columna: asegurar que exista (ya la crea alter_sessions_add_descuento.sql)
alter table sessions add column if not exists descuento numeric(10,2) default 0;

-- Descuentos: solo el admin puede aplicarlos o quitarlos.
-- (Las llamadas del servidor con service key no pasan por aquí: auth.uid() es null y
--  esas rutas nunca tocan el descuento.)
create or replace function public.guard_descuento() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or is_admin() then return new; end if;
  if tg_op = 'INSERT' and coalesce(new.descuento, 0) <> 0 then
    raise exception 'Solo el administrador puede aplicar descuentos';
  end if;
  if tg_op = 'UPDATE' and new.descuento is distinct from old.descuento then
    raise exception 'Solo el administrador puede aplicar descuentos';
  end if;
  return new;
end $$;

drop trigger if exists sessions_guard_descuento on sessions;
create trigger sessions_guard_descuento before insert or update on sessions
  for each row execute function guard_descuento();

-- =====================================================================
--  PRIMER ADMINISTRADOR
--  1. Supabase → Authentication → Users → "Add user" → "Create new user"
--     (tu correo + contraseña, marca "Auto Confirm User").
--  2. Cambia el correo abajo y ejecuta SOLO estas líneas:
-- =====================================================================
-- insert into profiles (id, nombre, rol)
-- select id, 'Dueño', 'admin' from auth.users where email = 'TU_CORREO@ejemplo.com'
-- on conflict (id) do update set rol = 'admin';
