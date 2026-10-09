-- ============================================================
-- Fastanúmer (HMS) á auglýsingum frá fastinn.is
-- n8n-workflow „fastinn_fastanumer“ les fastanúmer og heitisnúmer af
-- auglýsingasíðu hverrar auglýsingar og vistar hér. Scraperinn sendir
-- ekki þessa dálka og skrifar því aldrei yfir þá.
-- ============================================================

alter table public.fastinn_listings
  add column fastnum text,             -- fastanúmer, sama snið og kaupskra.fastnum
  add column heinum integer,           -- heitisnúmer (kaupskra.heinum)
  add column fastnum_sott timestamptz; -- hvenær síðan var lesin (líka ef ekkert fannst)

create index idx_listings_fastnum on public.fastinn_listings (fastnum) where fastnum is not null;
create index idx_listings_vantar_fastnum on public.fastinn_listings (first_seen desc) where fastnum is null;

-- Auglýsingar sem vantar fastanúmer, í forgangsröð:
-- 1) Skorradalur (311), líka fjarlægðar  2) aðrar virkar, nýjustu fyrst.
-- Síður sem gáfu ekkert eru reyndar aftur eftir 7 daga.
create or replace function public.fastinn_vantar_fastnum(p_limit int default 100)
returns table (id text, linkur text)
language sql stable security invoker set search_path = public as $$
  select l.id, l.linkur
  from fastinn_listings l
  where l.fastnum is null
    and (l.fastnum_sott is null or l.fastnum_sott < now() - interval '7 days')
    and (l.postnr = 311 or not l.removed)
  order by (l.postnr = 311) desc, l.first_seen desc nulls last
  limit p_limit;
$$;
revoke execute on function public.fastinn_vantar_fastnum(int) from public, anon, authenticated;
grant  execute on function public.fastinn_vantar_fastnum(int) to service_role;

-- Forsíðan: skila líka fastanúmeri svo sala tengist auglýsingu nákvæmlega
drop function public.get_auglysingar_fyrir_solur(int[], text[]);
create function public.get_auglysingar_fyrir_solur(p_postnr int[], p_heimilisfong text[])
returns table (heimilisfang text, postnr int, staerd numeric, verd bigint, linkur text,
               first_seen timestamptz, last_seen timestamptz, removed boolean, fastnum text)
language sql stable security invoker set search_path = public as $$
  select l.heimilisfang, l.postnr, l.staerd, l.verd, l.linkur, l.first_seen, l.last_seen, l.removed, l.fastnum
  from unnest(p_postnr, p_heimilisfong) as s(pnr, addr)
  join fastinn_listings l
    on l.postnr = s.pnr
   and lower(l.heimilisfang) ~>=~ lower(s.addr)
   and lower(l.heimilisfang) ~<~ (lower(s.addr) || chr(65535))
   and starts_with(lower(l.heimilisfang), lower(s.addr));
$$;

-- Bakka:
--   drop function public.fastinn_vantar_fastnum(int);
--   drop index public.idx_listings_fastnum; drop index public.idx_listings_vantar_fastnum;
--   alter table public.fastinn_listings drop column fastnum, drop column heinum, drop column fastnum_sott;
--   (og endurskapa get_auglysingar_fyrir_solur án fastnum, sjá 2026-10-08_auglysingar_fyrir_solur.sql)

-- ============================================================
-- Viðbót 9. okt.: forsíðan leitar líka eftir fastanúmeri
-- (heimilisfang á auglýsingu getur verið skrifað öðruvísi en í kaupskrá,
--  t.d. „Tannalækjarhólar 8“ vs „Tannalækjarhólar austur 8“)
-- ============================================================
drop function public.get_auglysingar_fyrir_solur(int[], text[]);
create function public.get_auglysingar_fyrir_solur(p_postnr int[], p_heimilisfong text[], p_fastnum text[] default '{}')
returns table (heimilisfang text, postnr int, staerd numeric, verd bigint, linkur text,
               first_seen timestamptz, last_seen timestamptz, removed boolean, fastnum text)
language sql stable security invoker set search_path = public as $$
  select l.heimilisfang, l.postnr, l.staerd, l.verd, l.linkur, l.first_seen, l.last_seen, l.removed, l.fastnum
  from unnest(p_postnr, p_heimilisfong) as s(pnr, addr)
  join fastinn_listings l
    on l.postnr = s.pnr
   and lower(l.heimilisfang) ~>=~ lower(s.addr)
   and lower(l.heimilisfang) ~<~ (lower(s.addr) || chr(65535))
   and starts_with(lower(l.heimilisfang), lower(s.addr))
  union
  select l.heimilisfang, l.postnr, l.staerd, l.verd, l.linkur, l.first_seen, l.last_seen, l.removed, l.fastnum
  from fastinn_listings l
  where l.fastnum = any(p_fastnum);
$$;
