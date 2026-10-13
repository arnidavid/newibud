-- ============================================================
-- 1) Söluverð / fasteignamat: aðeins sölur á 50–200 % af mati
--    Áður: meðaltal allra sölna. Nýbyggingar seldar á fokheldismati o.þ.h.
--    (3–18 % sölna á ári, sumar >1000 % af mati) drógu meðaltalið langt upp:
--    höfuðborgarsvæðið 2026 sýndi 130 % (miðgildi 104 %), 2022 sýndi 255 % (miðgildi 137 %).
--    Með síunni er meðaltalið innan 1–2 stiga frá miðgildinu öll árin.
--    Sama sía og Verðmat notar (get_verdmat).
--    Fermetraverð og fjöldi sölna (n_allt, n_fm, sum_fm) eru óbreytt.
-- 2) get_manadarsolur_svaedi án `set search_path`
--    Stillingin kemur í veg fyrir að Postgres felli fallið inn í fyrirspurnina:
--    allt höfuðborgarsvæðið tók 640–860 ms, án hennar 11 ms (mælt í pg_temp-afriti).
--    Töfluheiti er í staðinn skrifað með skema (public.).
-- ============================================================

begin;

drop materialized view public.mv_manadarsolur;

create materialized view public.mv_manadarsolur as
select
  postnr,
  tegund,
  extract(year  from thinglystdags)::int as ar,
  extract(month from thinglystdags)::int as man,
  count(*)                                              as n_allt,
  count(*)                       filter (where fm_ok)   as n_fm,
  sum(kaupverd / nullif(einflm, 0)) filter (where fm_ok) as sum_fm,
  count(*)                       filter (where mat_ok)  as n_mat,
  sum(kaupverd::numeric / fasteignamat * 100) filter (where mat_ok) as sum_mat
from (
  select postnr, tegund, thinglystdags, kaupverd, einflm, fasteignamat, fm_ok,
         fm_ok and fasteignamat > 0 and kaupverd::numeric / fasteignamat between 0.5 and 2 as mat_ok
  from (
    select *, coalesce(kaupverd / nullif(einflm, 0) between 50 and 5000, false) as fm_ok
    from public.kaupskra
    where kaupverd > 1000 and onothaefur_samningur <> '1' and thinglystdags is not null
  ) a
) k
group by 1, 2, 3, 4;

create index on public.mv_manadarsolur (postnr, tegund, ar);

-- Áður: anon/authenticated = select + maintain. Maintain (m.a. REFRESH) þarf ekki;
-- cron-verkið refresh-mv-manadarsolur keyrir sem postgres.
revoke all on public.mv_manadarsolur from anon, authenticated;
grant select on public.mv_manadarsolur to anon, authenticated;

create or replace function public.get_manadarsolur_svaedi(p_postnrs int[], p_tegund text default null)
returns table (ar int, man int, n_allt bigint, n_fm bigint, sum_fm numeric, n_mat bigint, sum_mat numeric)
language sql stable security invoker as $$
  select m.ar, m.man, sum(m.n_allt)::bigint, sum(m.n_fm)::bigint, sum(m.sum_fm), sum(m.n_mat)::bigint, sum(m.sum_mat)
  from public.mv_manadarsolur m
  where m.postnr = any(p_postnrs)
    and (p_tegund is null or m.tegund = p_tegund)
  group by m.ar, m.man
  order by m.ar, m.man;
$$;

commit;

-- Bakka: keyra liði 1 í 2026-10-08_hradari_hofudborg.sql (mv) og
-- get_manadarsolur_svaedi úr 2026-10-13_svaedi_postnumeralistar.sql.
