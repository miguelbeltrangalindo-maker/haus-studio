-- =====================================================
--  HAUS STUDIO — Ejecuta este SQL en Supabase
--  Panel → SQL Editor → New query → Pega y ejecuta
-- =====================================================

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

-- Tabla de configuración (una sola fila)
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

-- Fila de configuración inicial
insert into config (id) values (1) on conflict (id) do nothing;

-- Índices para búsqueda rápida
create index if not exists sessions_fecha_idx on sessions(fecha);
create index if not exists sessions_estatus_idx on sessions(estatus);

-- Política de acceso abierto (uso interno sin login)
alter table sessions enable row level security;
alter table config enable row level security;

create policy "allow_all_sessions" on sessions for all using (true) with check (true);
create policy "allow_all_config" on config for all using (true) with check (true);
