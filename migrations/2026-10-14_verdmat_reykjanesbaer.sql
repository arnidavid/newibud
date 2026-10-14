-- ============================================================
-- Verðmat: Reykjanesbær (230, 233, 260, 262) sem eigið svæði
-- Bakprófun (sölur apríl–okt. 2026, hver metin út frá 12 mán. á undan):
--   miðgildisskekkja Reykjanesbær: fjölbýli 5,5 % · sérbýli 6,4 % · einbýli 6,6 %
--   (Akureyri með sömu aðferð: 5,8 % · 5,9 % · 7,9 %)
-- Breytingar frá 2026-10-13_verdmat_akureyri.sql:
--   * leita_eign óbreytt: póstnr. 100–276 nær þegar yfir Reykjanesbæ
--   * get_verdmat, 3. stig (of fáar sölur í póstnúmeri og sveitarfélagi):
--     þrjú svæði, 'hofud', 'akureyri' og 'reykjanesbaer'. Áður lentu sölur
--     í Reykjanesbæ í 'hofud' og öfugt. Í bakprófun þurfti aldrei 3. stig
--     í Reykjanesbæ (sveitarfélagið hefur nóg af sölum), svo tölurnar breytast
--     ekki þar; þetta kemur í veg fyrir að svæðin blandist.
-- ============================================================

create or replace function public.get_verdmat(
  p_postnr  int,
  p_tegund  text,
  p_einflm  numeric default null,
  p_fastnum text    default null
)
returns json
language sql stable
set search_path = public
as $$
  with grunnur as (
    select k.postnr, k.svfn, k.gata, k.fastnum, k.thinglystdags, k.einflm, k.byggar, k.kaupverd,
           k.kaupverd::numeric / k.fasteignamat_gildandi as r
    from kaupskra k
    where k.tegund = p_tegund
      and (k.postnr between 100 and 276 or k.postnr in (600, 603))
      and k.thinglystdags > current_date - 365
      and k.onothaefur_samningur is distinct from '1'
      and k.fasteignamat_gildandi > 0 and k.einflm > 0
      and k.kaupverd / k.einflm between 10 and 2000
      and k.kaupverd::numeric / k.fasteignamat_gildandi between 0.5 and 2
  ),
  svf as (select svfn from kaupskra where postnr = p_postnr and svfn is not null limit 1),
  -- svæði fyrir 3. stig
  svaedi as (
    select case when p_postnr in (600, 603) then 'akureyri'
                when p_postnr in (230, 233, 260, 262) then 'reykjanesbaer'
                else 'hofud' end as sv
  ),
  stig as (
    select 1 as stig, 'postnr' as svaedi, r from grunnur where postnr = p_postnr
    union all
    select 2, 'sveitarfelag', r from grunnur where svfn = (select svfn from svf)
    union all
    select 3, (select sv from svaedi), r
    from grunnur g
    where case when g.postnr in (600, 603) then 'akureyri'
               when g.postnr in (230, 233, 260, 262) then 'reykjanesbaer'
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
    'svaedi', v.svaedi,
    'n',      v.n,
    'p25',    round(v.p[1]::numeric, 4),
    'p50',    round(v.p[2]::numeric, 4),
    'p75',    round(v.p[3]::numeric, 4),
    'samb',   coalesce((select json_agg(s) from samb s), '[]'::json),
    'saga',   coalesce((select json_agg(s) from saga s), '[]'::json)
  )
  from valid v
$$;

-- Bakka: keyra aftur get_verdmat úr 2026-10-13_verdmat_akureyri.sql
