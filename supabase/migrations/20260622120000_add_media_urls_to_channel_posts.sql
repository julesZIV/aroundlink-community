-- Plusieurs images par post de channel (carrousel), comme pour le feed.
alter table public.channel_posts
  add column if not exists media_urls text[] default null;
