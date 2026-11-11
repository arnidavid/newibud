-- ============================================================
-- Markaðshiti reiknaður úr okkar eigin gögnum (kaupskrá + auglýsingar)
--
-- Vandi: n8n-flæðið „markadshiti“ sótti söluferla í leit fastinn.is, sem lokaði 3. nóv. 2026.
-- Síðan hafa engir nýir mánuðir bæst við, og flæðið vistar tómar „á sölu núna“ raðir (n = 0)
-- fyrir sumarhúsasvæðin á hverri nóttu.
--
-- Lausn: hver sala í kaupskrá er pöruð við auglýsingu sömu eignar með sömu reglu og
-- auglysing_fyrir_solu (fastanúmer/heimilisfang, stærð ±10 %, söluverð 75–115 % af ásettu,
-- auglýst fyrir þinglýsingu og á skrá innan 4 mán. fyrir hana; nýjasta auglýsingin gildir).
-- Prófað 11. nóv. á höfuðborgarsvæðinu jún.–okt. 2026: ~89 % sölna paraðar, og
-- „á/yfir ásettu“ og „söluverð af ásettu“ víkja 0–3 stig / 0–0,4 stig frá fastinn-tölunum.
--
-- Eldri tölur (frá fastinn) haldast óbreyttar. Aðeins tímabil frá p_fra eru endurreiknuð:
--   • þéttbýli eftir mánuðum frá p_fra (sjálfgefið nóv. 2026)
--   • sumarhús eftir hálfum árum frá því hálfa ári sem p_fra lendir í (júl. 2026)
--   • „á sölu núna“ fyrir sumarhúsasvæðin (dagsetning í dag)
--
-- Dagar á sölu og hlutfall sem lækkaði verð: okkar safn veit oft ekki hvenær söluferill hófst
-- (fyrst_birt) eða hæsta ásetta verð (haest_verd). Þær tölur eru aðeins reiknaðar ef ≥ 80 %
-- paraðra sölna hafa gildið; annars null (síðan sleppir þá tölunni). Fyrir hálfsárin er gamla
-- fastinn-talan þá látin standa.
--
-- Óbreytt (sér verkefni): nýbyggingar á móti eldri (gerd ar_ny, ar_eldra, nuna_ny, nuna_eldra).
-- ============================================================

-- 1) Útreikningurinn sjálfur (les bara – hægt að prófa með select * from markadshiti_utreikningur();)
create or replace function public.markadshiti_utreikningur(p_fra date default '2026-11-01')
returns table (svaedi text, gerd text, timabil date, n integer, yfir_asettu numeric,
               soluhlutfall numeric, dagar numeric, laekkad numeric)
language sql stable set search_path = public as $$
  with
  -- Sama skilgreining og í n8n/markadshiti_reikna.js og SVAEDI/SUMAR í app.js
  s as (
    select k.*,
           case when k.tegund = 'Sumarhús' then
                  case k.postnr when 311 then 'skorr' when 805 then 'grimsnes' when 806 then 'blaskogar' end
                when k.tegund in ('Fjölbýli', 'Sérbýli', 'Einbýli') then
                  case when k.postnr between 100 and 170 or k.postnr between 200 and 225 or k.postnr = 270 then 'hofud'
                       when k.postnr in (600, 603)           then 'akureyri'
                       when k.postnr in (230, 233, 260, 262) then 'reykjanesbaer'
                       when k.postnr in (800, 801)           then 'selfoss'
                       when k.postnr = 300                   then 'akranes' end
           end as sv
    from kaupskra k
    where k.utgdag >= make_date(extract(year from p_fra)::int, case when extract(month from p_fra) < 7 then 1 else 7 end, 1)
      and k.onothaefur_samningur is distinct from '1'
      and k.einflm > 10 and k.kaupverd / k.einflm between 10 and 2000
  ),
  s2 as (
    select s.*,
           case when s.tegund = 'Sumarhús' then 'halfar' else 'manudur' end as g,
           case when s.tegund = 'Sumarhús'
                then make_date(extract(year from s.utgdag)::int, case when extract(month from s.utgdag) < 7 then 1 else 7 end, 1)
                else date_trunc('month', s.utgdag)::date end as t
    from s where s.sv is not null
  ),
  m as (
    select s2.sv, s2.g, s2.t, s2.utgdag, s2.kaupverd, l.verd, l.haest_verd, l.fyrst_birt
    from s2
    cross join lateral (
      select c.* from (
        select l.* from fastinn_listings l
        where s2.fastnum is not null and l.fastnum = s2.fastnum and l.postnr = s2.postnr
        union all
        select l.* from fastinn_listings l
        where l.postnr = s2.postnr and l.fastnum is null
          and lower(l.heimilisfang) ~>=~ lower(s2.heimilisfang)
          and lower(l.heimilisfang) ~<~ (lower(s2.heimilisfang) || '0')
      ) c
      where (c.first_seen is null or c.first_seen::date <= s2.thinglystdags)
        and (c.last_seen  is null or c.last_seen::date  >= s2.thinglystdags - 120)
        and (coalesce(s2.einflm, 0) = 0 or coalesce(c.staerd, 0) = 0 or abs(c.staerd - s2.einflm) <= s2.einflm * 0.10)
        and c.verd > 0 and s2.kaupverd / (c.verd / 1000.0) between 0.75 and 1.15
      order by (c.fastnum is not null) desc, c.first_seen desc nulls last, c.last_seen desc nulls last
      limit 1
    ) l
    where s2.g = 'halfar' or s2.t >= date_trunc('month', p_fra)::date
  ),
  solur as (
    select m.sv, m.g, m.t, count(*)::int as n,
           round(100.0 * avg((m.kaupverd * 1000 >= m.verd)::int)) as yfir_asettu,
           round((percentile_cont(0.5) within group (order by m.kaupverd * 1000.0 / m.verd) * 100)::numeric, 1) as soluhlutfall,
           case when avg((m.fyrst_birt is not null and m.fyrst_birt::date <= m.utgdag)::int) >= 0.8
                then round((percentile_cont(0.5) within group (order by m.utgdag - m.fyrst_birt::date)
                            filter (where m.fyrst_birt::date <= m.utgdag))::numeric) end as dagar,
           case when avg((m.haest_verd is not null)::int) >= 0.8
                then round(100.0 * avg((m.haest_verd > m.verd)::int) filter (where m.haest_verd is not null)) end as laekkad
    from m group by m.sv, m.g, m.t
  ),
  -- Sumarhús á sölu núna: einn söluferill á eign (nýjasta birting)
  a as (
    select distinct on (coalesce(l.journey_id::text, l.fastnum, l.id))
           case l.postnr when 311 then 'skorr' when 805 then 'grimsnes' when 806 then 'blaskogar' end as sv,
           l.verd, l.haest_verd, coalesce(l.fyrst_birt, l.first_seen) as fyrst
    from fastinn_listings l
    where not l.removed and l.postnr in (311, 805, 806) and l.tegund = 'sumarhus' and l.verd > 0
    order by coalesce(l.journey_id::text, l.fastnum, l.id), l.first_seen desc
  ),
  nuna as (
    select a.sv, 'nuna'::text as g, current_date as t, count(*)::int as n,
           null::numeric as yfir_asettu, null::numeric as soluhlutfall,
           round((percentile_cont(0.5) within group (order by current_date - a.fyrst::date))::numeric) as dagar,
           round(100.0 * avg((a.verd < a.haest_verd)::int) filter (where a.haest_verd is not null)) as laekkad
    from a group by a.sv
  )
  select * from solur
  union all
  select * from nuna;
$$;

-- 2) Vistar niðurstöðuna í markadshiti (keyrt á hverri nóttu)
create or replace function public.uppfaera_markadshiti(p_fra date default '2026-11-01')
returns integer
language plpgsql set search_path = public as $$
declare fjoldi integer;
begin
  insert into markadshiti as t (svaedi, gerd, timabil, n, yfir_asettu, soluhlutfall, dagar, laekkad, uppfaert)
  select r.svaedi, r.gerd, r.timabil, r.n, r.yfir_asettu, r.soluhlutfall, r.dagar, r.laekkad, now()
  from markadshiti_utreikningur(p_fra) r
  on conflict (svaedi, gerd, timabil) do update set
    n            = excluded.n,
    yfir_asettu  = excluded.yfir_asettu,
    soluhlutfall = excluded.soluhlutfall,
    -- hálfsár sem hófst fyrir lokun fastinn: gamla talan stendur ef okkar gögn duga ekki
    dagar        = case when t.gerd = 'halfar' then coalesce(excluded.dagar, t.dagar) else excluded.dagar end,
    laekkad      = case when t.gerd = 'halfar' then coalesce(excluded.laekkad, t.laekkad) else excluded.laekkad end,
    uppfaert     = excluded.uppfaert;
  get diagnostics fjoldi = row_count;
  return fjoldi;
end $$;

-- Aðeins postgres (pg_cron) keyrir föllin – ekki vefurinn
revoke execute on function public.markadshiti_utreikningur(date) from public, anon, authenticated;
revoke execute on function public.uppfaera_markadshiti(date)     from public, anon, authenticated;

-- 3) Tómar „á sölu núna“ raðir sem n8n-flæðið vistaði eftir lokun fastinn (4.–11. nóv.)
delete from public.markadshiti where gerd = 'nuna' and n = 0;

-- 4) Fyrsta keyrsla og nætur-keyrsla kl. 04:30 (á eftir kaupskrá ~02:30 og visir-safnara 01:30)
select public.uppfaera_markadshiti();
select cron.schedule('uppfaera-markadshiti', '30 4 * * *', 'select public.uppfaera_markadshiti()');

-- 5) Í n8n (Árni): gera flæðið „markadshiti“ óvirkt – það getur ekki lengur sótt gögn.

-- Bakka:
--   select cron.unschedule('uppfaera-markadshiti');
--   drop function public.uppfaera_markadshiti(date);
--   drop function public.markadshiti_utreikningur(date);
--   (raðir frá nóv. 2026 og hálfsárið júl. 2026 hafa þá okkar tölur; fastinn-tölurnar fyrir
--    júl.–okt. hálfsárið voru: skorr n=7, 14 %, 90,0 %; grimsnes n=23, 9 %, 93,3 %; blaskogar n=12, 17 %, 92,4 %)
