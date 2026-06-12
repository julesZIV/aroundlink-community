-- Suivi de l'onboarding par compte (séquence notifications → post de bienvenue).
alter table public.profiles
  add column if not exists onboarding_completed boolean not null default false;
