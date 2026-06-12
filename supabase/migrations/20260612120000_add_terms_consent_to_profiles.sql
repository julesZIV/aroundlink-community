-- Preuve de consentement RGPD : version des CGU acceptées + horodatage.
alter table public.profiles
  add column if not exists terms_version     text not null default '1.0',
  add column if not exists terms_accepted_at timestamptz default null;
