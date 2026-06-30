-- email_exists(p_email text) -> boolean
--
-- Targeted existence check against auth.users, replacing the previous approach
-- of paging the entire user table via the admin listUsers() API (which loaded
-- every user into memory and did not scale).
--
-- SECURITY DEFINER: auth.users is not readable under normal RLS, so the function
-- runs with elevated rights but returns only a boolean — no user data leaks.
-- Execute is granted to service_role only; this is invoked from the server-side
-- admin client in src/app/api/check-email/route.ts.

create or replace function public.email_exists(p_email text)
returns boolean
language sql
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
      from auth.users
     where lower(email) = lower(p_email)
  );
$$;

revoke all on function public.email_exists(text) from public;
revoke all on function public.email_exists(text) from authenticated;
grant execute on function public.email_exists(text) to service_role;
