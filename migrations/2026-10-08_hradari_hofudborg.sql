-- ============================================================
-- Hraðari og réttari Höfuðborgarsvæðis-flipi / yfirlitssíða
-- Áður: síðan sótti allt að 116 þús. raðir (500 í einu) og stoppaði
-- við 25.500 elstu → rangar tölur (0/0 sölur 2025/2026) og 20+ sek. bið.
-- ============================================================

-- 1. Mánaðarlegar samantektir, reiknaðar fyrirfram (uppfært á nóttunni).
--    Sama síun og app.js notar: kaupverd > 1000, gildur samningur,
--    fm.verð 50–5000 þ.kr/m² fyrir meðaltöl.
create materialized view public.mv_manadarsolur as
select
  postnr,
  tegund,
  extract(year  from thinglystdags)::int as ar,
  extract(month from thinglystdags)::int as man,
  count(*)                                                        as n_allt,
  count(*)            filter (where fm_ok)                        as n_fm,
  sum(kaupverd/nullif(einflm, 0)) filter (where fm_ok)                       as sum_fm,
  count(*)            filter (where fm_ok and fasteignamat > 0)   as n_mat,
  sum(kaupverd::numeric/nullif(fasteignamat, 0)*100) filter (where fm_ok and fasteignamat > 0) as sum_mat
from (
  select *, coalesce(kaupverd/nullif(einflm, 0) between 50 and 5000, false) as fm_ok
  from public.kaupskra
  where kaupverd > 1000 and onothaefur_samningur <> '1' and thinglystdags is not null
) k
group by 1, 2, 3, 4;

create index on public.mv_manadarsolur (postnr, tegund, ar);

-- 2. RPC: samantekt fyrir eitt póstnúmer eða allt svæðið (p_postnr = 0 → 100–230).
create or replace function public.get_manadarsolur(p_postnr int, p_tegund text default null)
returns table (ar int, man int, n_allt bigint, n_fm bigint, sum_fm numeric, n_mat bigint, sum_mat numeric)
language sql stable security invoker set search_path = public as $$
  select m.ar, m.man, sum(m.n_allt)::bigint, sum(m.n_fm)::bigint, sum(m.sum_fm), sum(m.n_mat)::bigint, sum(m.sum_mat)
  from mv_manadarsolur m
  where (case when p_postnr = 0 then m.postnr between 100 and 230 else m.postnr = p_postnr end)
    and (p_tegund is null or m.tegund = p_tegund)
  group by m.ar, m.man
  order by m.ar, m.man;
$$;

-- 3. Götuheiti sem sérstakur dálkur (t.d. "Laugavegur 12b" → "Laugavegur"),
--    svo hægt sé að finna fyrri sölur á sömu götu hratt.
alter table public.kaupskra
  add column gata text generated always as (regexp_replace(heimilisfang, '\s+\d.*$', '')) stored;
create index idx_kaupskra_gata_dags on public.kaupskra (gata, thinglystdags desc);

-- 4. RPC: nýjustu sölur (allt að 25) á hverri götu í listanum, frá 2010.
create or replace function public.get_solur_gotur(p_gotur text[])
returns table (heimilisfang text, kaupverd bigint, einflm numeric, thinglystdags date,
               fasteignamat bigint, fasteignamat_gildandi bigint)
language sql stable security invoker set search_path = public as $$
  select s.heimilisfang, s.kaupverd, s.einflm, s.thinglystdags, s.fasteignamat, s.fasteignamat_gildandi
  from (
    select k.*, row_number() over (partition by k.gata order by k.thinglystdags desc) as rn
    from kaupskra k
    where k.gata = any(p_gotur)
      and k.thinglystdags >= '2010-01-01'
      and k.kaupverd > 1000 and k.onothaefur_samningur <> '1'
  ) s
  where s.rn <= 25;
$$;

-- 5. Index fyrir „Nýjustu sölur“ (raðað eftir dagsetningu).
create index idx_kaupskra_dags on public.kaupskra (thinglystdags desc);

-- 6. Næturuppfærsla (eftir Kaupsamninga kl. 02:30, með hinum views kl. 03:xx).
select cron.schedule('refresh-mv-manadarsolur', '35 3 * * *',
  'REFRESH MATERIALIZED VIEW mv_manadarsolur');

-- Bakka:
--   select cron.unschedule('refresh-mv-manadarsolur');
--   drop function public.get_solur_gotur(text[]);
--   drop function public.get_manadarsolur(int, text);
--   drop materialized view public.mv_manadarsolur;
--   drop index public.idx_kaupskra_dags;
--   drop index public.idx_kaupskra_gata_dags;
--   alter table public.kaupskra drop column gata;

-- ============================================================
-- Viðbót (sama dag): hraðari get_solur_gotur
-- Fyrri útgáfa rann út á tíma (3,3 sek.) með ~400 götum þegar gögn voru ekki í minni.
-- Nú: 25 nýjustu á götu beint úr covering index (index-only scan, ~0,7 sek. kalt, ~0,03 heitt).
-- ============================================================
create or replace function public.get_solur_gotur(p_gotur text[])
returns table (heimilisfang text, kaupverd bigint, einflm numeric, thinglystdags date,
               fasteignamat bigint, fasteignamat_gildandi bigint)
language sql stable security invoker set search_path = public as $$
  select s.* from unnest(p_gotur) g(gata)
  cross join lateral (
    select k.heimilisfang, k.kaupverd, k.einflm, k.thinglystdags, k.fasteignamat, k.fasteignamat_gildandi
    from kaupskra k
    where k.gata = g.gata and k.thinglystdags >= '2010-01-01'
      and k.kaupverd > 1000 and k.onothaefur_samningur <> '1'
    order by k.thinglystdags desc limit 25
  ) s;
$$;

create index idx_kaupskra_gata_cover on public.kaupskra (gata, thinglystdags desc)
  include (heimilisfang, kaupverd, einflm, fasteignamat, fasteignamat_gildandi, onothaefur_samningur);
drop index public.idx_kaupskra_gata_dags;
-- (keyrt sér á eftir: vacuum analyze public.kaupskra;)
-- Bakka þessa viðbót: drop index public.idx_kaupskra_gata_cover; (og bakka-skref að ofan)
