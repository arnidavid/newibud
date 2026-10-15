-- ============================================================
-- Verðmat: Selfoss (800 bærinn, 801 dreifbýlið í kring)
-- Eyrarbakki (820) og Stokkseyri (825) eru utan, eins og annars staðar á síðunni.
-- Bakprófun (sölur apríl–okt. 2026, hver metin út frá 12 mán. á undan):
--   miðgildisskekkja Selfoss: fjölbýli 5,0 % · sérbýli 4,9 % · einbýli 4,8 %
--   (Reykjanesbær með sömu aðferð: 5,5 % · 6,4 % · 6,6 %)
-- Breytingar frá 2026-10-14_verdmat_reykjanesbaer.sql:
--   * leita_eign og get_verdmat taka með 800 og 801
--   * get_verdmat, 3. stig: nýtt svæði 'selfoss'. 2. stig (sveitarfélag) nær aðeins
--     yfir 800/801, því Eyrarbakki og Stokkseyri eru ekki í grunninum.
-- ============================================================

create or replace function public.leita_eign(p_q text)
returns table (heimilisfang text, postnr integer, eignir bigint)
language plpgsql stable
set search_path = public
as $function$
declare
  q text := lower(trim(coalesce(p_q, '')));
begin
  if length(q) < 3 then return; end if;
  -- Fastur strengur í fyrirspurn → Postgres notar vísinn á lower(heimilisfang)
  return query execute format($f$
    select k.heimilisfang, k.postnr, count(distinct k.fastnum)
    from kaupskra k
    where lower(k.heimilisfang) like %L
      and (k.postnr between 100 and 276 or k.postnr in (600, 603, 800, 801))
      and k.tegund in ('Fjölbýli', 'Sérbýli', 'Einbýli')
    group by k.heimilisfang, k.postnr
    order by (lower(k.heimilisfang) = %L) desc, length(k.heimilisfang), k.heimilisfang
    limit 10
  $f$, replace(replace(replace(q, '\', '\\'), '%', '\%'), '_', '\_') || '%', q);
end
$function$;

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
      and (k.postnr between 100 and 276 or k.postnr in (600, 603, 800, 801))
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
                when p_postnr in (800, 801) then 'selfoss'
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
               when g.postnr in (800, 801) then 'selfoss'
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

-- Bakka: keyra aftur leita_eign úr gildandi útgáfu fyrir 15. okt. (postnr. án 800, 801)
-- og get_verdmat úr 2026-10-14_verdmat_reykjanesbaer.sql
