-- Rattachement AUTOMATIQUE d'un membre à son université via le domaine de son email,
-- à l'inscription (ou si l'email change). Ne touche pas ceux déjà rattachés ou ayant
-- déjà saisi une institution, et ignore les emails perso (gmail, etc.).
create or replace function public.auto_link_university_by_domain()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_domain text;
  v_id int;
  v_name text;
begin
  if new.university_id is not null then return new; end if;
  if coalesce(trim(new.institution), '') <> '' then return new; end if;
  if new.email is null or position('@' in new.email) = 0 then return new; end if;

  v_domain := lower(split_part(new.email, '@', 2));

  if v_domain in (
    'gmail.com','googlemail.com','yahoo.com','yahoo.fr','yahoo.co.uk','hotmail.com','hotmail.fr',
    'outlook.com','outlook.fr','live.fr','live.com','icloud.com','me.com','proton.me','protonmail.com',
    'aol.com','gmx.com','gmx.fr','msn.com','orange.fr','free.fr','wanadoo.fr','laposte.net','qq.com','163.com'
  ) then
    return new;
  end if;

  select id, display_name into v_id, v_name
  from universities
  where schac_domain is not null and schac_domain <> ''
    and (v_domain = schac_domain or v_domain like '%.' || schac_domain)
  order by length(schac_domain) desc
  limit 1;

  if v_id is not null then
    new.university_id := v_id;
    new.institution   := v_name;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_auto_link_university on public.profiles;
create trigger trg_auto_link_university
  before insert or update of email on public.profiles
  for each row execute function public.auto_link_university_by_domain();
