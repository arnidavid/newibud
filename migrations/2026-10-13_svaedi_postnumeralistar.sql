-- ============================================================
-- Svæði sem lista af póstnúmerum (Mosfellsbær + Akureyri)
-- Áður: p_postnr = 0 þýddi „póstnr. 100–230“, sem tók óvart með
-- 190 Voga og 230 Reykjanesbæ en ekki 270 Mosfellsbæ.
-- Nú sendir síðan lista: eitt póstnúmer → [270], allt svæðið → [101, …, 270],
-- Akureyri → [600, 603].
-- Gömlu föllin (get_manadarsolur, get_verd_staerd_aldur) standa óbreytt
-- þar til nýja síðan er komin á VPS; þeim má eyða eftir það.
-- ============================================================

create or replace function public.get_manadarsolur_svaedi(p_postnrs int[], p_tegund text default null)
returns table (ar int, man int, n_allt bigint, n_fm bigint, sum_fm numeric, n_mat bigint, sum_mat numeric)
language sql stable security invoker set search_path = public as $$
  select m.ar, m.man, sum(m.n_allt)::bigint, sum(m.n_fm)::bigint, sum(m.sum_fm), sum(m.n_mat)::bigint, sum(m.sum_mat)
  from mv_manadarsolur m
  where m.postnr = any(p_postnrs)
    and (p_tegund is null or m.tegund = p_tegund)
  group by m.ar, m.man
  order by m.ar, m.man;
$$;

-- Sama og get_verd_staerd_aldur (2026-10-13_verd_staerd_aldur.sql), nema póstnúmeralisti.
-- Leiðrétting fyrir staðsetningu virkar þegar fleiri en eitt póstnúmer er í listanum.
create or replace function public.get_verd_staerd_aldur_svaedi(p_postnrs int[], p_tegund text default null)
returns table (flokkur text, bil int, n bigint, fm numeric, verd numeric, m2 numeric)
language sql stable
set search_path = public
as $$
  with s as materialized (
    select k.postnr, k.byggar, k.einflm, k.kaupverd, k.kaupverd::numeric / k.einflm as fm
    from kaupskra k
    where k.thinglystdags > current_date - 730
      and k.postnr = any(p_postnrs)
      and ((p_tegund is null and k.tegund in ('Fjölbýli', 'Sérbýli', 'Einbýli')) or k.tegund = p_tegund)
      and k.onothaefur_samningur is distinct from '1'
      and k.einflm > 0 and k.kaupverd / k.einflm between 10 and 2000
  ),
  pm   as materialized (select postnr, percentile_cont(0.5) within group (order by fm) as m from s group by postnr),
  allm as materialized (select percentile_cont(0.5) within group (order by fm) as m from s),
  adj  as materialized (select s.*, s.fm * (select m from allm) / pm.m as fma from s join pm using (postnr))
  select 'staerd',
         case when einflm < 50 then 1 when einflm < 70 then 2 when einflm < 90 then 3
              when einflm < 110 then 4 when einflm < 140 then 5 when einflm < 200 then 6 else 7 end,
         count(*),
         round(percentile_cont(0.5) within group (order by fma)::numeric),
         round(percentile_cont(0.5) within group (order by kaupverd)::numeric),
         round(percentile_cont(0.5) within group (order by einflm)::numeric)
  from adj group by 2
  union all
  select 'aldur',
         case when byggar < 1950 then 1 when byggar < 1970 then 2 when byggar < 1990 then 3
              when byggar < 2010 then 4 when byggar < 2020 then 5 else 6 end,
         count(*),
         round(percentile_cont(0.5) within group (order by fma)::numeric),
         round(percentile_cont(0.5) within group (order by kaupverd)::numeric),
         round(percentile_cont(0.5) within group (order by einflm)::numeric)
  from adj where byggar > 1800 group by 2
  order by 1, 2
$$;

grant execute on function public.get_manadarsolur_svaedi(int[], text) to anon, authenticated;
grant execute on function public.get_verd_staerd_aldur_svaedi(int[], text) to anon, authenticated;

-- Bakka:
--   drop function public.get_manadarsolur_svaedi(int[], text);
--   drop function public.get_verd_staerd_aldur_svaedi(int[], text);
