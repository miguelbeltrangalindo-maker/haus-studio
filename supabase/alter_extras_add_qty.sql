-- Run in Supabase SQL Editor
alter table session_extras add column if not exists cantidad integer not null default 1;
alter table session_extras add column if not exists precio_unitario numeric(10,2);
alter table config add column if not exists extra_conceptos jsonb default '[]'::jsonb;
