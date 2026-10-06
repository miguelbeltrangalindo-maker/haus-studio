-- Run in Supabase SQL Editor
-- Apartados sin fecha: el cliente deja anticipo pero aún no elige día/hora.
alter table sessions alter column fecha drop not null;
alter table sessions alter column hora  drop not null;
-- Marca permanente de que la sesión nació como apartado (para medir cuántos terminan agendando)
alter table sessions add column if not exists apartado boolean default false;
