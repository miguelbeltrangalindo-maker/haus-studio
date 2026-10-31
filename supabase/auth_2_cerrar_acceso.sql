-- =====================================================================
--  USUARIOS Y ROLES — PASO 2 de 2  (cierra el acceso público)
--  Córrelo SOLO después de: paso 1 + crear tu admin + desplegar la versión
--  con login + comprobar que entras al sitio con tu usuario.
--  A partir de aquí, sin iniciar sesión no se puede leer ni escribir nada.
-- =====================================================================

-- Quitar las políticas abiertas (using true)
drop policy if exists "allow_all_sessions" on sessions;
drop policy if exists "allow_all_config"   on config;
drop policy if exists "allow_all"          on gastos;
drop policy if exists "allow_all"          on session_extras;
drop policy if exists "allow_all"          on session_pagos;

alter table sessions       enable row level security;
alter table config         enable row level security;
alter table gastos         enable row level security;
alter table session_extras enable row level security;
alter table session_pagos  enable row level security;

-- Sesiones, cargos extra y gastos: cualquier usuario del estudio
drop policy if exists "staff_all" on sessions;
create policy "staff_all" on sessions       for all using (is_staff()) with check (is_staff());
drop policy if exists "staff_all" on session_extras;
create policy "staff_all" on session_extras for all using (is_staff()) with check (is_staff());
drop policy if exists "staff_all" on gastos;
create policy "staff_all" on gastos         for all using (is_staff()) with check (is_staff());

-- Configuración: todos la leen, solo el admin la cambia
drop policy if exists "config_select" on config;
drop policy if exists "config_write"  on config;
create policy "config_select" on config for select using (is_staff());
create policy "config_write"  on config for all    using (is_admin()) with check (is_admin());

-- Cobros: todos ven y registran; editar es solo del admin.
-- Borrar: el admin siempre; el operador solo su propio cobro de los últimos 10 min ("Deshacer").
drop policy if exists "pagos_select" on session_pagos;
drop policy if exists "pagos_insert" on session_pagos;
drop policy if exists "pagos_update" on session_pagos;
drop policy if exists "pagos_delete" on session_pagos;
create policy "pagos_select" on session_pagos for select using (is_staff());
create policy "pagos_insert" on session_pagos for insert with check (is_staff());
create policy "pagos_update" on session_pagos for update using (is_admin()) with check (is_admin());
create policy "pagos_delete" on session_pagos for delete using (
  is_admin() or (is_staff() and created_by = auth.uid() and created_at > now() - interval '10 minutes')
);
