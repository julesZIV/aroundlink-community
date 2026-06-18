-- Les admins peuvent modifier n'importe quel channel (titre, emoji, description),
-- en plus du créateur (policy channels_owner_update existante).
drop policy if exists channels_admin_update on public.channels;
create policy channels_admin_update on public.channels for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.app_role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.app_role = 'admin'));
