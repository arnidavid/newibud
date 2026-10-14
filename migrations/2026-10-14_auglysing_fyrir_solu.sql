-- ============================================================
-- Ásett verð við nýjustu sölur – ein auglýsing á hverja sölu
--
-- Vandi: get_auglysingar_fyrir_solur skilaði ÖLLUM auglýsingum sem byrja á
-- heimilisfangi sölunnar („Áshamar 2“ → líka Áshamar 20–29, 1.800 raðir).
-- Supabase skilar mest 1.000 röðum, svo fyrir 20 sölur á höfuðborgarsvæðinu
-- datt meirihlutinn út og ásett verð vantaði á flestar sölur.
--
-- Lausn: reglan úr pickListingForSale (app.js) keyrð hér, fyrir hverja sölu:
-- sama eign (fastanúmer, annars heimilisfang án viðbótarnúmers), stærð innan
-- 10 %, söluverð 75–115 % af ásettu, auglýst fyrir þinglýsingu og á skrá innan
-- 4 mán. fyrir hana. Aðeins nýjasta auglýsingin per sölu (≤ 1 röð á sölu).
-- app.js keyrir sömu reglu aftur á niðurstöðuna.
--
-- Gamla fallið rann líka oft út á tíma (sama breiða bilið).
-- ============================================================

create or replace function public.auglysing_fyrir_solu(
  p_postnr int[], p_heimilisfong text[], p_fastnum text[],
  p_dags date[], p_einflm numeric[], p_kaupverd numeric[])
returns table (heimilisfang text, postnr int, staerd numeric, verd bigint, linkur text,
               first_seen timestamptz, last_seen timestamptz, removed boolean, fastnum text)
language sql stable security invoker set search_path = public as $$
  select l.heimilisfang, l.postnr, l.staerd, l.verd, l.linkur, l.first_seen, l.last_seen, l.removed, l.fastnum
  from unnest(p_postnr, p_heimilisfong, p_fastnum, p_dags, p_einflm, p_kaupverd)
         as s(pnr, addr, fnum, dags, flm, kv)
  cross join lateral (
    select c.* from (
      -- sama eign eftir fastanúmeri (idx_listings_fastnum)
      select l.* from fastinn_listings l
      where s.fnum is not null and l.fastnum = s.fnum and l.postnr = s.pnr
      union all
      -- …eða eftir heimilisfangi ef auglýsingin hefur ekkert fastanúmer (idx_listings_postnr_addr).
      -- Bilið [addr, addr||'0') nær yfir „Áshamar 2“ og „Áshamar 2 (502)“ en ekki „Áshamar 26“ eða
      -- „Áshamar 2b“ (næsti stafur < '0', þ.e. bil, svigi, komma…). Breiðara bil las ~1.800 raðir
      -- fyrir eina sölu og rann út á tíma (3 sek. mörk).
      select l.* from fastinn_listings l
      where l.postnr = s.pnr and l.fastnum is null
        and lower(l.heimilisfang) ~>=~ lower(s.addr)
        and lower(l.heimilisfang) ~<~ (lower(s.addr) || '0')
    ) c
    where (c.first_seen is null or c.first_seen::date <= s.dags)
      and (c.last_seen  is null or c.last_seen::date  >= s.dags - 120)
      and (coalesce(s.flm, 0) = 0 or coalesce(c.staerd, 0) = 0 or abs(c.staerd - s.flm) <= s.flm * 0.10)
      and c.verd > 0 and s.kv / (c.verd / 1000.0) between 0.75 and 1.15
    order by (c.fastnum is not null) desc, c.first_seen desc nulls last, c.last_seen desc nulls last
    limit 1
  ) l;
$$;

grant execute on function public.auglysing_fyrir_solu(int[], text[], text[], date[], numeric[], numeric[]) to anon, authenticated;

-- Eftir deploy 14. okt. (ekkert kallar lengur á gamla fallið):
drop function public.get_auglysingar_fyrir_solur(int[], text[], text[]);
--
-- Bakka:
--   drop function public.auglysing_fyrir_solu(int[], text[], text[], date[], numeric[], numeric[]);
