-- Recherche élargie : on matche aussi ville + pays + acronymes + alias (pas seulement
-- le nom). Ex. "Oujda" ou "UMP" trouvent désormais "Mohamed I University".
create or replace function public.search_universities(q text, lim int default 8)
returns table (id int, display_name text, city text, country_name text, flag text)
language sql
stable
security invoker
set search_path = public
as $$
  select u.id, u.display_name, u.city, u.country_name, u.flag
  from universities u
  where (
    select bool_and(
      unaccent(lower(
        u.display_name || ' ' || coalesce(u.city,'') || ' ' || coalesce(u.country_name,'') || ' ' ||
        coalesce(array_to_string(u.acronyms, ' '), '') || ' ' ||
        coalesce(array_to_string(u.aliases, ' '), '')
      )) like '%' || unaccent(lower(tok)) || '%'
    )
    from regexp_split_to_table(trim(q), '\s+') as tok
    where length(tok) > 0
  )
  order by
    case when unaccent(lower(u.display_name)) like unaccent(lower(trim(q))) || '%' then 0 else 1 end,
    length(u.display_name),
    u.display_name
  limit greatest(1, least(lim, 20));
$$;

grant execute on function public.search_universities(text, int) to anon, authenticated;
