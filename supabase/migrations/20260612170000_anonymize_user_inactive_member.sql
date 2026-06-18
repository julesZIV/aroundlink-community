-- Label neutre pour les comptes anonymisés : "Inactive Member"
-- (au lieu de "Deleted Member" — on ne précise pas la raison : supprimé, parti, etc.)
create or replace function public.anonymize_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if (select app_role from public.profiles where id = auth.uid()) not in ('super_admin', 'admin') then
    raise exception 'Forbidden';
  end if;

  update public.profiles set
    name           = 'Inactive Member',
    first_name     = null,
    last_name      = null,
    email          = null,
    personal_email = null,
    avatar_url     = null,
    institution    = null,
    linkedin       = null,
    country_code   = null,
    role           = null,
    referral_code  = null,
    is_anonymized  = true
  where id = p_user_id;

  delete from auth.users where id = p_user_id;
end;
$function$;

-- Backfill des comptes déjà anonymisés
update public.profiles set name = 'Inactive Member'
where is_anonymized = true and name in ('Deleted Member', 'Membre supprimé', 'Deleted member');
