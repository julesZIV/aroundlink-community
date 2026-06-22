-- Désactivation de channels par les admins/modérateurs (œil on/off).
-- Channel désactivé = masqué aux membres, conservé (réactivable).
alter table public.channels add column if not exists is_active boolean not null default true;

-- SELECT : les non-managers ne voient que les channels actifs ;
-- admins/modérateurs voient tout (pour pouvoir réactiver).
drop policy if exists channels_public_read on public.channels;
create policy channels_public_read on public.channels for select
using (
  is_active
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.app_role in ('admin','moderator','super_admin')
  )
);

-- UPDATE : admins ET modérateurs peuvent gérer un channel (toggle is_active, édition).
drop policy if exists channels_admin_update on public.channels;
create policy channels_admin_update on public.channels for update
using (
  exists (select 1 from public.profiles p
          where p.id = auth.uid() and p.app_role in ('admin','moderator','super_admin'))
)
with check (
  exists (select 1 from public.profiles p
          where p.id = auth.uid() and p.app_role in ('admin','moderator','super_admin'))
);
