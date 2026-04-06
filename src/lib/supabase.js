import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

/*
==================================================
  EJECUTA ESTE SQL EN SUPABASE → SQL EDITOR
==================================================

-- Tabla principal de sesiones
create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  telefono text not null,
  fecha date not null,
  hora time not null,
  personas integer default 1,
  estatus text default 'Reservada',
  anticipo numeric default 0,
  restante numeric default 0,
  notas text default '',
  link text default '',
  seguimiento text default '',
  reminder_sent boolean default false,
  link_sent boolean default false,
  created_at timestamptz default now()
);

-- Tabla de configuración
create table if not exists config (
  id integer primary key default 1,
  studio_name text default 'HAUS',
  open_time text default '09:00',
  close_time text default '20:00',
  block_minutes integer default 30,
  session_minutes integer default 20,
  reminder_message text default 'Hola, {nombre}. Te damos la bienvenida a HAUS. Te recordamos que tu sesión está agendada para el día {fecha} a las {hora}. Te pedimos presentarte 10 minutos antes de tu horario. La duración de tu sesión es de 20 minutos y cada espacio se agenda cada media hora para poder atender cualquier contratiempo de forma puntual. ¡Te esperamos!',
  delivery_message text default 'Hola, {nombre}. Muchas gracias por visitar HAUS. Tus fotos ya están listas. Te compartimos el vínculo de entrega: {link} Gracias por confiar en nosotros.'
);

-- Inserta config por defecto (solo una fila)
insert into config (id) values (1) on conflict (id) do nothing;

-- Índices para búsqueda rápida
create index if not exists sessions_fecha_idx on sessions(fecha);
create index if not exists sessions_estatus_idx on sessions(estatus);
create index if not exists sessions_nombre_idx on sessions using gin(to_tsvector('spanish', nombre));

==================================================
*/
