-- ============================================================
-- Nýbyggingar: fjöldi og fermetraverð á ári, eftir póstnúmeri og tegund
--
-- Nýbygging = fyrsta skráða sala eignarinnar (eftir fastanúmeri) og
-- byggingarár sama eða árinu fyrr en söluárið. Kaupskrá nær aftur til 2006,
-- svo eldri eignir sem hafa ekki selst síðan þá teljast ekki nýjar
-- (byggingarárið útilokar þær).
--
-- Sér samantekt (ekki breyting á mv_manadarsolur) svo síðan sem notar hana
-- verði ekki fyrir áhrifum. Uppfærð á nóttunni á eftir mv_manadarsolur.
-- Síur eins og í mv_manadarsolur (fm.verð 50–5000 þ.kr/m² í meðaltöl).
-- ============================================================

create materialized view public.mv_nybyggingar as
with k as (
  select postnr, tegund, thinglystdags, byggar, kaupverd, einflm, fastnum,
         min(thinglystdags) over (partition by fastnum) as fyrst
  from kaupskra
  where kaupverd > 1000 and onothaefur_samningur <> '1' and thinglystdags is not null
    and tegund in ('Fjölbýli', 'Sérbýli', 'Einbýli')
),
x as (
  select postnr, tegund, extract(year from thinglystdags)::int as ar,
         (fastnum is not null and byggar >= extract(year from thinglystdags) - 1 and thinglystdags = fyrst) as ny,
         kaupverd::numeric / nullif(einflm, 0) as fm,
         coalesce(kaupverd::numeric / nullif(einflm, 0) between 50 and 5000, false) as fm_ok
  from k
)
select postnr, tegund, ar,
       count(*)                               as n_allt,
       count(*) filter (where ny)             as n_ny,
       count(*) filter (where fm_ok)          as n_fm,
       sum(fm)  filter (where fm_ok)          as sum_fm,
       count(*) filter (where fm_ok and ny)   as n_fm_ny,
       sum(fm)  filter (where fm_ok and ny)   as sum_fm_ny
from x
group by postnr, tegund, ar;

create index mv_nybyggingar_postnr_idx on public.mv_nybyggingar (postnr, tegund, ar);
grant select on public.mv_nybyggingar to anon, authenticated;

-- Á ári fyrir lista af póstnúmerum (sama snið og get_manadarsolur_svaedi)
create or replace function public.get_nybyggingar_svaedi(p_postnrs int[], p_tegund text default null)
returns table (ar int, n_allt bigint, n_ny bigint, n_fm bigint, sum_fm numeric, n_fm_ny bigint, sum_fm_ny numeric)
language sql stable
set search_path = public
as $$
  select m.ar, sum(m.n_allt)::bigint, sum(m.n_ny)::bigint, sum(m.n_fm)::bigint, sum(m.sum_fm),
         sum(m.n_fm_ny)::bigint, sum(m.sum_fm_ny)
  from mv_nybyggingar m
  where m.postnr = any(p_postnrs)
    and (p_tegund is null or m.tegund = p_tegund)
  group by m.ar
  order by m.ar;
$$;
grant execute on function public.get_nybyggingar_svaedi(int[], text) to anon, authenticated;

-- Uppfært kl. 03:40, á eftir mv_manadarsolur (03:35) og nýjum sölum næturinnar
select cron.schedule('refresh-mv-nybyggingar', '40 3 * * *', 'REFRESH MATERIALIZED VIEW mv_nybyggingar');

-- Bakka:
--   select cron.unschedule('refresh-mv-nybyggingar');
--   drop function public.get_nybyggingar_svaedi(int[], text);
--   drop materialized view public.mv_nybyggingar;
