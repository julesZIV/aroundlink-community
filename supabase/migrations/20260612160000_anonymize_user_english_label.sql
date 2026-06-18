-- Uniformise le nom des comptes anonymisés en anglais ("Deleted Member").
create or replace function public.anonymize_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  -- Caller must be admin or super_admin
  if (select app_role from public.profiles where id = auth.uid()) not in ('super_admin', 'admin') then
    raise exception 'Forbidden';
  end if;

  -- Wipe personal data, keep the row
  update public.profiles set
    name           = 'Deleted Member',
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

  -- Remove the auth account (revokes app access)
  delete from auth.users where id = p_user_id;
end;
$function$;

-- Backfill: comptes déjà anonymisés en français → anglais
update public.profiles set name = 'Deleted Member'
where is_anonymized = true and name = 'Membre supprimé';
