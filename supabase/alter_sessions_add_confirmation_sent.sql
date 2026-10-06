-- Run in Supabase SQL Editor
-- Separa la confirmación al agendar del recordatorio programado (cron),
-- para que enviar una no impida la otra.
alter table sessions add column if not exists confirmation_sent boolean default false;
