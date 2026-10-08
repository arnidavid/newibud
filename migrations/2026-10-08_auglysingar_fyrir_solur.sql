-- ============================================================
-- Tengja þinglýstar sölur við auglýsingar á fastinn.is (forsíða)
-- Án index þarf að lesa allar auglýsingar á póstnúmerinu (~3 sek. kalt,
-- rennur út á tíma). Með index á (postnr, heimilisfang) er það bein uppfletting.
-- ============================================================

create index idx_listings_postnr_addr
  on public.fastinn_listings (postnr, lower(heimilisfang) text_pattern_ops);

-- Allar auglýsingar sem byrja á heimilisfangi sölunnar á sama póstnúmeri.
-- (Síun á stærð og dagsetningu fer fram í app.js, matchSalesToListings.)
create or replace function public.get_auglysingar_fyrir_solur(p_postnr int[], p_heimilisfong text[])
returns table (heimilisfang text, postnr int, staerd numeric, verd bigint, linkur text,
               first_seen timestamptz, last_seen timestamptz, removed boolean)
language sql stable security invoker set search_path = public as $$
  select l.heimilisfang, l.postnr, l.staerd, l.verd, l.linkur, l.first_seen, l.last_seen, l.removed
  from unnest(p_postnr, p_heimilisfong) as s(pnr, addr)
  join fastinn_listings l
    on l.postnr = s.pnr
   -- bil (~>=~ / ~<~) svo index nýtist; like tryggir nákvæma forskeytis-samsvörun
   and lower(l.heimilisfang) ~>=~ lower(s.addr)
   and lower(l.heimilisfang) ~<~ (lower(s.addr) || chr(65535))
   and starts_with(lower(l.heimilisfang), lower(s.addr));
$$;

-- Bakka:
--   drop function public.get_auglysingar_fyrir_solur(int[], text[]);
--   drop index public.idx_listings_postnr_addr;
