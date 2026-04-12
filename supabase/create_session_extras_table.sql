-- Run this in Supabase SQL Editor
create table if not exists session_extras (
  id          uuid default gen_random_uuid() primary key,
  session_id  uuid not null references sessions(id) on delete cascade,
  concepto    text not null,
  monto       numeric(10,2) not null,
  created_at  timestamptz default now()
);

alter table session_extras enable row level security;
create policy "allow_all" on session_extras for all using (true) with check (true);

create index if not exists session_extras_session_id_idx on session_extras(session_id);
