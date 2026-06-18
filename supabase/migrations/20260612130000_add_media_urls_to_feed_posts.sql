-- Support de plusieurs images par post (carrousel). media_url reste la "cover"
-- (compat + aperçus OG) ; media_urls contient toutes les images quand il y en a plusieurs.
alter table public.feed_posts
  add column if not exists media_urls text[] default null;
