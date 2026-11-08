-- sumarhus_samanburdur: + breyting fasteignamats næsta árs (mat_naesta_pct), 8. nóv. 2026
--
-- Miðgildi fyrirhugad_fasteignamat / fasteignamat_gildandi yfir sumarhús sem hafa selst á svæðinu síðustu 6 ár
-- (hver eign einu sinni, nýjasta salan). Nóv. 2026: gildandi = 2026, fyrirhugað = 2027.
-- Skilar null ef fyrirhugað mat er ekki komið, þ.e. ef minna en helmingur eigna er með annað fyrirhugað mat en
-- gildandi (t.d. eftir endurhleðslu kaupskrár í janúar). Vefurinn felur þá dálkinn.
--
-- SAGA: fyrsta útgáfan (keyrð 8. nóv. ~10:00) las ALLAR sumarhúsasölur frá 2006 til að finna hverja eign
-- (6.556 línur á 4.380 gagnasíðum): 2,4 sek. á kaldri tengingu → tímamörk (3 sek.) á síðunni. Sett til baka
-- í fyrri útgáfu (2026-11-07) um kl. 10:15. Þessi útgáfa notar sömu línur og fallið les nú þegar (sölur
-- síðustu 6 ára), svo matið bætir ~0 ms við: 24 ms á kaldri tengingu.
-- Munur: Skorradalur 3,3 %, Grímsnes 4,4 %, landið 4,3 % (var 4,4) – Bláskógabyggð 5,7 % (var 4,3 % yfir allar eignir).
--
-- Athugið (sjá VERKEFNI.md): fyrsta snerting nýrrar tengingar við hverja töflu kostar 60–320 ms á þessum
-- gagnagrunni (síðan heimsótt sjaldan → tengingar kaldar). Aldrei bæta nýrri töflu eða stórum lestri við
-- fall sem síðan kallar á án þess að mæla á kaldri tengingu (ný execute_sql-tenging = köld).
--
-- Breytir skilagerð fallsins (nýr dálkur) → drop + create í einni færslu.
-- Bakka: keyra 2026-11-07_sumarhus_samanburdur.sql aftur (með drop function á undan).

begin;

drop function if exists public.sumarhus_samanburdur(jsonb);

create function public.sumarhus_samanburdur(p_sumar jsonb)
returns table (sv text, til date, n_12 int, n_fyrra int, fm_12 int, fm_fyrra int, fm_5ar int,
               midg_verd int, mat_pct int, yfir_pct int, n_mat int, a_solu int, dagar int,
               mat_naesta_pct numeric)
language sql
stable
set search_path = public
as $$
  with t as (select max(thinglystdags) as d from kaupskra),
  s as (
    select key as sv, value::text::int as pn from jsonb_each(p_sumar)
    union all select 'landid', null
  ),
  k as (
    select s.sv, k.kaupverd, k.einflm, k.fasteignamat, k.fastnum, k.thinglystdags as t,
           k.fasteignamat_gildandi as g, k.fyrirhugad_fasteignamat as f,
           k.byggar < extract(year from k.thinglystdags) - 1 as eldra,
           case when k.thinglystdags >  t.d - interval '1 year'  then 0
                when k.thinglystdags >  t.d - interval '2 years' then 1
                when k.thinglystdags <= t.d - interval '5 years' then 5 end as w,
           k.einflm > 0 and k.kaupverd / k.einflm > 10 and k.kaupverd / k.einflm < 2000 as fm_ok
      from s cross join t
      join kaupskra k on k.tegund = 'Sumarhús' and (s.pn is null or k.postnr = s.pn)
     where k.kaupverd > 500 and k.onothaefur_samningur is distinct from '1'
       and k.thinglystdags > t.d - interval '6 years'
  ),
  a as (
    select s.sv, count(*)::int as a_solu,
           round(percentile_cont(.5) within group (order by extract(epoch from now() - m.fyrst_birt) / 86400)
                 filter (where m.fyrst_birt is not null))::int as dagar
      from s join mv_a_solu m on m.tegund = 'sumarhus' and (s.pn is null or m.postnr = s.pn)
     group by s.sv
  ),
  e as (   -- hver eign einu sinni (nýjasta sala síðustu 6 ára)
    select distinct on (sv, fastnum) sv, g, f from k
     where fastnum is not null and g > 0
     order by sv, fastnum, t desc
  ),
  m as (
    select sv,
           case when count(*) filter (where f > 0 and f is distinct from g) * 2 > count(*)
                then round((100 * (percentile_cont(.5) within group (order by f::numeric / g)
                                   filter (where f > 0)) - 100)::numeric, 1) end as mat_naesta_pct
      from e group by sv
  )
  select k.sv, (select d from t),
         (count(*) filter (where w = 0))::int,
         (count(*) filter (where w = 1))::int,
         round(avg(kaupverd / einflm) filter (where w = 0 and fm_ok))::int,
         round(avg(kaupverd / einflm) filter (where w = 1 and fm_ok))::int,
         round(avg(kaupverd / einflm) filter (where w = 5 and fm_ok))::int,
         round(percentile_cont(.5) within group (order by kaupverd) filter (where w = 0))::int,
         round(100 * percentile_cont(.5) within group (order by kaupverd::numeric / fasteignamat)
                     filter (where w = 0 and eldra and fasteignamat > 0))::int,
         round(100 * avg((kaupverd > fasteignamat)::int) filter (where w = 0 and eldra and fasteignamat > 0))::int,
         (count(*) filter (where w = 0 and eldra and fasteignamat > 0))::int,
         a.a_solu, a.dagar, m.mat_naesta_pct
    from k left join a on a.sv = k.sv left join m on m.sv = k.sv
   group by k.sv, a.a_solu, a.dagar, m.mat_naesta_pct;
$$;

revoke execute on function public.sumarhus_samanburdur(jsonb) from public;
grant execute on function public.sumarhus_samanburdur(jsonb) to anon, authenticated, service_role;

commit;
