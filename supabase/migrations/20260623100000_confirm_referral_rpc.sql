-- confirm_referral(p_referee_id uuid)
--
-- Confirms a referral once the referee's email is verified, and atomically
-- awards 150 Links to the referrer — exactly once per referral.
--
-- Called from src/app/auth/callback/route.ts after exchangeCodeForSession.
-- SECURITY DEFINER so it can update profiles.links regardless of the caller's
-- RLS context; the WHERE clause guarantees idempotency (no double-award even if
-- the callback fires twice — e.g. token refresh or a retried OAuth round-trip).

create or replace function public.confirm_referral(p_referee_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referrer_id uuid;
begin
  -- Find an as-yet-unconfirmed referral for this referee and lock the row
  -- so two concurrent callbacks can't both pass the check.
  select referrer_id
    into v_referrer_id
    from public.referrals
   where referee_id = p_referee_id
     and confirmed = false
   for update;

  -- Nothing to do: no pending referral (or already confirmed)
  if v_referrer_id is null then
    return;
  end if;

  -- Mark the referral confirmed
  update public.referrals
     set confirmed = true
   where referee_id = p_referee_id
     and confirmed = false;

  -- Award 150 Links to the referrer
  update public.profiles
     set links = coalesce(links, 0) + 150
   where id = v_referrer_id;
end;
$$;

revoke all on function public.confirm_referral(uuid) from public;
grant execute on function public.confirm_referral(uuid) to authenticated;
