-- Verðmat fyrir sumarhús (sem bil). Sama aðferð og fyrir íbúðir – fasteignamat × hlutfall söluverðs/mats
-- í nýlegum sölum – en:
--   - 24 mánaða gluggi (í stað 12), því sumarhúsasölur eru færri
--   - allt landið (íbúðir eru bundnar við verðmatssvæðin)
--   - stig: póstnúmer (≥ 25 sölur) → sveitarfélag (≥ 25) → öll sumarhús á landinu ('landid')
--   - skilar 'manudir' (12 / 24) svo vefurinn segi rétt frá glugganum
-- Bakprófun 20. okt. 2026 (sumarhúsasölur síðustu 12 mán., hlutfall reiknað úr fyrri sölum):
--   miðgildisskekkja 14–18 % (311: 17 %, 805: 14 %, 806: 18 %), á móti 5–8 % fyrir íbúðir.
--   Vefurinn sýnir því sumarhúsum bil (25.–75. hundraðshluti) sem aðaltölu, með fyrirvara.
-- Íbúðir: óbreytt hegðun (sömu síur, 12 mánuðir, sömu svæði og stig).

create or replace function public.get_verdmat(p_postnr integer, p_tegund text, p_einflm numeric default null::numeric, p_fastnum text default null::text)
 returns json
 language sql
 stable
 set search_path to 'public'
as $function$
  with grunnur as (
    select k.postnr, k.svfn, k.gata, k.fastnum, k.thinglystdags, k.einflm, k.byggar, k.kaupverd,
           k.kaupverd::numeric / k.fasteignamat_gildandi as r
    from kaupskra k
    where k.tegund = p_tegund
      and (p_tegund = 'Sumarhús' or k.postnr between 100 and 276 or k.postnr in (600, 603, 800, 801, 300))
      and k.thinglystdags > current_date - case when p_tegund = 'Sumarhús' then 730 else 365 end
      and k.onothaefur_samningur is distinct from '1'
      and k.fasteignamat_gildandi > 0 and k.einflm > 0
      and k.kaupverd / k.einflm between 10 and 2000
      and k.kaupverd::numeric / k.fasteignamat_gildandi between 0.5 and 2
  ),
  svf as (select svfn from kaupskra where postnr = p_postnr and svfn is not null limit 1),
  svaedi as (
    select case when p_tegund = 'Sumarhús' then 'landid'
                when p_postnr in (600, 603) then 'akureyri'
                when p_postnr in (230, 233, 260, 262) then 'reykjanesbaer'
                when p_postnr in (800, 801) then 'selfoss'
                when p_postnr = 300 then 'akranes'
                else 'hofud' end as sv
  ),
  stig as (
    select 1 as stig, 'postnr' as svaedi, r from grunnur where postnr = p_postnr
    union all
    select 2, 'sveitarfelag', r from grunnur where svfn = (select svfn from svf)
    union all
    select 3, (select sv from svaedi), r
    from grunnur g
    where case when p_tegund = 'Sumarhús' then 'landid'
               when g.postnr in (600, 603) then 'akureyri'
               when g.postnr in (230, 233, 260, 262) then 'reykjanesbaer'
               when g.postnr in (800, 801) then 'selfoss'
               when g.postnr = 300 then 'akranes'
               else 'hofud' end = (select sv from svaedi)
  ),
  hlutf as (
    select stig, svaedi, count(*) as n,
           percentile_cont(array[0.25, 0.5, 0.75]) within group (order by r) as p
    from stig group by stig, svaedi
  ),
  valid as (
    select * from hlutf where n >= 25 or stig = 3 order by stig limit 1
  ),
  samb as (
    select g.gata, g.thinglystdags, g.einflm, g.byggar, g.kaupverd, round(g.r, 4) as r
    from grunnur g
    where g.postnr = p_postnr
      and g.fastnum is distinct from p_fastnum
      and (p_einflm is null or g.einflm between p_einflm * 0.8 and p_einflm * 1.2)
    order by g.thinglystdags desc
    limit 8
  ),
  saga as (
    select k.thinglystdags, k.kaupverd
    from kaupskra k
    where p_fastnum is not null and k.fastnum = p_fastnum
      and k.onothaefur_samningur is distinct from '1'
    order by k.thinglystdags desc
    limit 10
  )
  select json_build_object(
    'svaedi',  v.svaedi,
    'n',       v.n,
    'p25',     round(v.p[1]::numeric, 4),
    'p50',     round(v.p[2]::numeric, 4),
    'p75',     round(v.p[3]::numeric, 4),
    'manudir', case when p_tegund = 'Sumarhús' then 24 else 12 end,
    'samb',    coalesce((select json_agg(s) from samb s), '[]'::json),
    'saga',    coalesce((select json_agg(s) from saga s), '[]'::json)
  )
  from valid v
$function$;

-- (create or replace heldur heimildum get_verdmat óbreyttum)
-- Bakka: fyrri skilgreining er í migrations/2026-10-15_verdmat_akranes.sql (síðasta útgáfa fyrir þessa).
