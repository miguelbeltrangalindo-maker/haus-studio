-- Run this in your Supabase SQL editor to enable the Gastos module
create table if not exists gastos (
  id         uuid          default gen_random_uuid() primary key,
  concepto   text          not null,
  monto      numeric(10,2) not null,
  fecha      date          not null default current_date,
  categoria  text          default 'Otros',
  notas      text,
  created_at timestamptz   default now()
);

-- Optional: enable row-level security
alter table gastos enable row level security;

-- Allow all operations (adjust to your auth setup)
create policy "allow_all" on gastos for all using (true) with check (true);
