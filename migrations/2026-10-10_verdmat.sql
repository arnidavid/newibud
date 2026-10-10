-- ============================================================
-- Verðmat: „Hvað er eignin mín virði?“
-- Aðferð: fasteignamat × miðgildi (söluverð / fasteignamat) í nýlegum
-- sölum sömu tegundar í sama póstnúmeri (síðustu 12 mán.).
-- Of fáar sölur (< 25) → sama sveitarfélag → allt höfuðborgarsvæðið.
-- Prófað á ~3.000 sölum apríl–okt. 2026: miðgildisskekkja 5–8 %.
-- Aðeins íbúðarhúsnæði á höfuðborgarsvæðinu (100–276), engin sumarhús.
-- ============================================================

-- Hröð leit eftir upphafi heimilisfangs (áður 2,7 sek. heildarlestur)
create index if not exists idx_kaupskra_heimilisfang_lower
  on public.kaupskra (lower(heimilisfang) text_pattern_ops);
-- Fyrri sölur eignar (get_verdmat → saga): án vísis las það alla töfluna (~3 sek.)
create index if not exists idx_kaupskra_fastnum on public.kaupskra (fastnum, thinglystdags desc);
analyze public.kaupskra;

-- 1) Heimilisföng sem byrja á leitarorðinu (til að stinga upp á)
--    plpgsql + execute: leitarorðið fer inn sem fastur strengur svo Postgres
--    noti vísinn (SQL-fall með breytu gerði almennt plan → 1–2,5 sek.).
--    Eftir að vísirinn var búinn til þurfti `analyze kaupskra`.
create or replace function public.leita_eign(p_q text)
returns table (heimilisfang text, postnr int, eignir bigint)
language plpgsql stable
set search_path = public
as $$
declare
  q text := lower(trim(coalesce(p_q, '')));
begin
  if length(q) < 3 then return; end if;
  return query execute format($f$
    select k.heimilisfang, k.postnr, count(distinct k.fastnum)
    from kaupskra k
    where lower(k.heimilisfang) like %L
      and k.postnr between 100 and 276
      and k.tegund in ('Fjölbýli', 'Sérbýli', 'Einbýli')
    group by k.heimilisfang, k.postnr
    order by (lower(k.heimilisfang) = %L) desc, length(k.heimilisfang), k.heimilisfang
    limit 10
  $f$, replace(replace(replace(q, '\', '\\'), '%', '\%'), '_', '\_') || '%', q);
end
$$;

-- 2) Eignir (íbúðir) á einu heimilisfangi, nýjustu upplýsingar hverrar
create or replace function public.eignir_a_heimilisfangi(p_heimilisfang text, p_postnr int)
returns table (fastnum text, tegund text, einflm numeric, fjherb int, byggar int,
               fasteignamat bigint, fasteignamat_2027 bigint, solur bigint, sidasta_sala date)
language sql stable
set search_path = public
as $$
  select distinct on (k.fastnum)
         k.fastnum, k.tegund, k.einflm, k.fjherb, k.byggar,
         k.fasteignamat_gildandi,
         nullif(max(k.fyrirhugad_fasteignamat) over (partition by k.fastnum), 0),
         count(*) over (partition by k.fastnum),
         max(k.thinglystdags) over (partition by k.fastnum)
  from kaupskra k
  where lower(k.heimilisfang) = lower(p_heimilisfang)
    and k.postnr = p_postnr
    and k.tegund in ('Fjölbýli', 'Sérbýli', 'Einbýli')
    and k.fasteignamat_gildandi > 0
  order by k.fastnum, k.thinglystdags desc
$$;

-- 3) Verðmat: hlutfall af mati, sambærilegar sölur og fyrri sölur eignarinnar
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
      and k.postnr between 100 and 276
      and k.thinglystdags > current_date - 365
      and k.onothaefur_samningur is distinct from '1'
      and k.fasteignamat_gildandi > 0 and k.einflm > 0
      and k.kaupverd / k.einflm between 10 and 2000
      and k.kaupverd::numeric / k.fasteignamat_gildandi between 0.5 and 2
  ),
  svf as (select svfn from kaupskra where postnr = p_postnr and svfn is not null limit 1),
  stig as (
    select 1 as stig, 'postnr' as svaedi, r from grunnur where postnr = p_postnr
    union all
    select 2, 'sveitarfelag', r from grunnur where svfn = (select svfn from svf)
    union all
    select 3, 'hofud', r from grunnur
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

grant execute on function public.leita_eign(text) to anon, authenticated;
grant execute on function public.eignir_a_heimilisfangi(text, int) to anon, authenticated;
grant execute on function public.get_verdmat(int, text, numeric, text) to anon, authenticated;

-- Bakka:
--   drop function public.get_verdmat(int, text, numeric, text);
--   drop function public.eignir_a_heimilisfangi(text, int);
--   drop function public.leita_eign(text);
--   drop index public.idx_kaupskra_heimilisfang_lower;
--   drop index public.idx_kaupskra_fastnum;
