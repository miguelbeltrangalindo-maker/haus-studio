-- Run this in Supabase SQL Editor
create table if not exists session_pagos (
  id          uuid default gen_random_uuid() primary key,
  session_id  uuid not null references sessions(id) on delete cascade,
  monto       numeric(10,2) not null,
  metodo      text not null default 'efectivo',
  nota        text,
  created_at  timestamptz default now()
);

alter table session_pagos enable row level security;
create policy "allow_all" on session_pagos for all using (true) with check (true);

create index if not exists session_pagos_session_id_idx on session_pagos(session_id);
