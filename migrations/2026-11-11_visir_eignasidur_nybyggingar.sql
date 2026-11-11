-- ============================================================
-- Byggingarár og fastanúmer af eignasíðum visir + nýbyggingar í Markaðshita
--
-- Vandi: nýbyggingar á móti eldri í söluhraðatöflu þéttbýlisflipanna (markadshiti gerd ar_ny, ar_eldra,
-- nuna_ny, nuna_eldra) komu úr leit fastinn.is (byggingarár á hverri auglýsingu) og hafa staðið í stað
-- síðan 3. nóv. Leitarsíður visir sýna ekki byggingarár. Kaupskrá dugar ekki: hún hefur byggingarár
-- aðeins fyrir ~50 % virkra auglýsinga, og nýbyggingar sem hafa aldrei selst vantar alveg.
--
-- Lausn: eignasíða hverrar visir-auglýsingar sýnir „Byggt 2024“ og PropertyId „F2530344“ (= fastanúmer).
-- Nýtt n8n-flæði „visir_eignasidur“ (á 30 mín. fresti, 40 síður, 1,5 sek. á milli) les þær og vistar hér.
-- Fastanúmer af síðunni gildir framar fastanúmeri sem var erft frá fastinn-línu (síðan er heimildin).
-- Horfnar auglýsingar vísa á 404-síðu; þær fá samt fastnum_sott og eru reyndar aftur eftir 14 daga.
-- fastnum_sott er notað sem „eignasíða sótt“ fyrir visir-línur (fastinn_vantar_fastnum sleppir þeim).
--
-- Markaðshiti:
--   • nuna_ny / nuna_eldra (íbúðir á sölu núna) reiknað aftur þegar ≥ 80 % virkra íbúðaauglýsinga
--     svæðisins hafa byggingarár (annars ekkert vistað og síðan sýnir síðustu fastinn-tölu)
--   • ar_ny / ar_eldra (söluhraði á ári) frá 2027 úr okkar gögnum; byggingarár sölunnar úr kaupskrá.
--     2023–2026 standa eins og fastinn reiknaði (2026 = jan.–okt.)
--   Nýbygging: byggð sama ár eða árinu fyrr (sama regla og mv_nybyggingar og gamla n8n-flæðið).
-- ============================================================

-- A. Dálkur fyrir byggingarár auglýsingar
alter table public.fastinn_listings add column if not exists byggar integer;   -- byggingarár af eignasíðu

-- B. Gikkurinn sem sleppir óbreyttum línum þarf að sjá byggar (annars gæti uppfærsla á því einu fallið niður)
create or replace function public.sleppa_obreyttum()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
begin
  if (new.heimilisfang, new.tegund, new.postnr, new.verd, new.staerd, new.myndir, new.linkur,
      new.mynd_url, new.removed, new.journey_id, new.fyrst_birt, new.haest_verd,
      new.fastnum, new.heinum, new.fastnum_sott, new.byggar)
     is not distinct from
     (old.heimilisfang, old.tegund, old.postnr, old.verd, old.staerd, old.myndir, old.linkur,
      old.mynd_url, old.removed, old.journey_id, old.fyrst_birt, old.haest_verd,
      old.fastnum, old.heinum, old.fastnum_sott, old.byggar)
     and old.last_seen > now() - interval '20 hours' - (abs(hashtext(old.id)) % 8) * interval '1 hour'
  then
    return null;
  end if;
  return new;
end;
$function$;

-- C. Hvaða eignasíður á að sækja: virkar visir-auglýsingar án byggingarárs.
--    Íbúðir og sumarhús á svæðum síðunnar fyrst, svo aðrar íbúðir/sumarhús, svo annað; nýjustu fyrst.
create or replace function public.visir_vantar_eignasidu(p_limit integer default 40)
returns table (id text, linkur text)
language sql stable set search_path = public as $$
  select l.id, l.linkur
  from fastinn_listings l
  where l.id like 'visir:%'
    and not l.removed
    and l.byggar is null
    and (l.fastnum_sott is null or l.fastnum_sott < now() - interval '14 days')
  order by (l.tegund in ('fjolb', 'einb', 'raðpar', 'sumarhus')) desc,
           (l.postnr between 100 and 170 or l.postnr between 200 and 225
            or l.postnr in (270, 300, 311, 600, 603, 230, 233, 260, 262, 800, 801, 805, 806)) desc,
           l.first_seen desc
  limit p_limit;
$$;

-- D. Vista það sem lesið var: [{id, byggar, fastnum}] (null = fannst ekki á síðunni)
create or replace function public.vista_eignasidur(p_rows jsonb)
returns integer
language plpgsql set search_path = public as $$
declare n integer;
begin
  update fastinn_listings l
     set byggar       = coalesce(r.byggar, l.byggar),
         fastnum      = coalesce(r.fastnum, l.fastnum),
         fastnum_sott = now()
    from jsonb_to_recordset(p_rows) as r(id text, byggar integer, fastnum text)
   where l.id = r.id and l.id like 'visir:%';
  get diagnostics n = row_count;
  return n;
end $$;

revoke execute on function public.visir_vantar_eignasidu(integer) from public, anon, authenticated;
revoke execute on function public.vista_eignasidur(jsonb)        from public, anon, authenticated;
grant  execute on function public.visir_vantar_eignasidu(integer) to service_role;
grant  execute on function public.vista_eignasidur(jsonb)        to service_role;

-- E. Markaðshiti með nýbyggingum (sama fall og 2026-11-11_markadshiti_ur_okkar_gognum.sql + liðir merktir NÝTT)
create or replace function public.markadshiti_utreikningur(p_fra date default '2026-11-01')
returns table (svaedi text, gerd text, timabil date, n integer, yfir_asettu numeric,
               soluhlutfall numeric, dagar numeric, laekkad numeric)
language sql stable set search_path = public as $$
  with
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
    select s2.sv, s2.g, s2.t, s2.utgdag, s2.kaupverd, s2.byggar, l.verd, l.haest_verd, l.fyrst_birt
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
  -- NÝTT: söluhraði á ári, nýbyggingar á móti eldri, frá 2027 (byggingarár sölunnar úr kaupskrá)
  m_ar as (
    select m.*, make_date(extract(year from m.utgdag)::int, 1, 1) as ar_t,
           case when m.byggar >= extract(year from m.utgdag) - 1 then 'ar_ny'
                when m.byggar > 1800 then 'ar_eldra' end as ar_g
    from m where m.g = 'manudur' and m.utgdag >= '2027-01-01'
  ),
  hopar as (
    select sv, g, t, utgdag, kaupverd, verd, haest_verd, fyrst_birt from m
    union all
    select sv, ar_g, ar_t, utgdag, kaupverd, verd, haest_verd, fyrst_birt from m_ar where ar_g is not null
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
    from hopar m group by m.sv, m.g, m.t
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
  ),
  -- NÝTT: íbúðir á sölu núna í þéttbýli, nýbyggingar á móti eldri (byggingarár af eignasíðu)
  ib as (
    select distinct on (coalesce(l.journey_id::text, l.fastnum, l.id))
           case when l.postnr between 100 and 170 or l.postnr between 200 and 225 or l.postnr = 270 then 'hofud'
                when l.postnr in (600, 603)           then 'akureyri'
                when l.postnr in (230, 233, 260, 262) then 'reykjanesbaer'
                when l.postnr in (800, 801)           then 'selfoss'
                when l.postnr = 300                   then 'akranes' end as sv,
           l.verd, l.haest_verd, l.byggar, coalesce(l.fyrst_birt, l.first_seen) as fyrst
    from fastinn_listings l
    where not l.removed and l.tegund in ('fjolb', 'einb', 'raðpar') and l.verd > 0
      and (l.postnr between 100 and 170 or l.postnr between 200 and 225
           or l.postnr in (270, 300, 600, 603, 230, 233, 260, 262, 800, 801))
    order by coalesce(l.journey_id::text, l.fastnum, l.id), l.first_seen desc
  ),
  ib_ok as (   -- svæði þar sem nógu margar auglýsingar hafa byggingarár
    select sv from ib group by sv having avg((coalesce(byggar, 0) > 1800)::int) >= 0.8
  ),
  ib2 as (
    select ib.*, case when ib.byggar >= extract(year from current_date) - 1 then 'nuna_ny'
                      when ib.byggar > 1800 then 'nuna_eldra' end as g
    from ib join ib_ok using (sv)
  ),
  nuna_ib as (
    select sv, g, current_date as t, count(*)::int as n,
           null::numeric as yfir_asettu, null::numeric as soluhlutfall,
           round((percentile_cont(0.5) within group (order by current_date - fyrst::date))::numeric) as dagar,
           round(100.0 * avg((verd < haest_verd)::int) filter (where haest_verd is not null)) as laekkad
    from ib2 where g is not null group by sv, g
  )
  select * from solur
  union all
  select * from nuna
  union all
  select * from nuna_ib;
$$;

revoke execute on function public.markadshiti_utreikningur(date) from public, anon, authenticated;

-- Keyrt 11. nóv. 2026. n8n-flæðið „visir_eignasidur“ (MfJLFirJKGIWy2G3) búið til og virkjað sama dag;
-- prufukeyrsla: 40 síður, 39 með byggingarár, 15 af 15 eins og í kaupskrá (kóði: n8n/visir_eignasidur.js).
-- Fyrstu dagana skila nuna_ny/nuna_eldra engu (byggingarár vantar) – síðan sýnir þá síðustu fastinn-tölu (3. nóv.).

-- Bakka:
--   (n8n: gera visir_eignasidur óvirkt)
--   keyra lið E úr 2026-11-11_markadshiti_ur_okkar_gognum.sql aftur (fallið án nýbygginga)
--   drop function public.vista_eignasidur(jsonb); drop function public.visir_vantar_eignasidu(integer);
--   gikkurinn: sama fall án new.byggar / old.byggar
--   alter table public.fastinn_listings drop column byggar;
