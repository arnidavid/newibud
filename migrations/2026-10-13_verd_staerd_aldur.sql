-- ============================================================
-- Verð eftir stærð og aldri (Höfuðborgarsvæðis-flipinn)
-- Miðgildi fermetraverðs eftir stærðarflokkum og byggingarári,
-- sölur síðustu 24 mánuði. Fermetraverð er leiðrétt fyrir staðsetningu:
--   fm × (miðgildi alls úrtaksins / miðgildi í póstnúmeri sölunnar)
-- svo gömul hús í miðbænum og stór hús í úthverfum skekki ekki myndina.
-- Þegar eitt póstnúmer er valið hefur leiðréttingin engin áhrif.
-- p_postnr = 0 → allt höfuðborgarsvæðið (100–230), eins og get_manadarsolur.
-- p_tegund = null → Fjölbýli + Sérbýli + Einbýli.
-- Flokkar (bil):
--   staerd: 1 <50 · 2 50–69 · 3 70–89 · 4 90–109 · 5 110–139 · 6 140–199 · 7 200+ m²
--   aldur:  1 <1950 · 2 1950–69 · 3 1970–89 · 4 1990–2009 · 5 2010–19 · 6 2020+
-- ============================================================

create or replace function public.get_verd_staerd_aldur(p_postnr int, p_tegund text default null)
returns table (flokkur text, bil int, n bigint, fm numeric, verd numeric, m2 numeric)
language sql stable
set search_path = public
as $$
  with s as materialized (
    select k.postnr, k.byggar, k.einflm, k.kaupverd, k.kaupverd::numeric / k.einflm as fm
    from kaupskra k
    where k.thinglystdags > current_date - 730
      and ((p_postnr = 0 and k.postnr between 100 and 230) or k.postnr = p_postnr)
      and ((p_tegund is null and k.tegund in ('Fjölbýli', 'Sérbýli', 'Einbýli')) or k.tegund = p_tegund)
      and k.onothaefur_samningur is distinct from '1'
      and k.einflm > 0 and k.kaupverd / k.einflm between 10 and 2000
  ),
  -- materialized: annars áætlar Postgres 1 röð og reiknar miðgildi póstnúmera
  -- upp á nýtt fyrir hverja sölu (12 þús. sinnum → tímarof)
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

grant execute on function public.get_verd_staerd_aldur(int, text) to anon, authenticated;

-- Bakka:
--   drop function public.get_verd_staerd_aldur(int, text);

-- Vísir sem geymir dálkana sem fallið les (index-only scan): þegar síðustu 2 ár
-- voru ekki í minni tók heildarlestur töflunnar >3 sek. og fallið rann út á tíma.
-- Eftir: les ~220 blokkir af vísinum í stað ~3.950 af töflunni.
create index if not exists idx_kaupskra_dags_cover on public.kaupskra
  (thinglystdags) include (postnr, tegund, onothaefur_samningur, einflm, kaupverd, byggar);
-- vacuum (analyze) public.kaupskra;  -- keyrt sér (ekki innan færslu)
-- Bakka: drop index public.idx_kaupskra_dags_cover;
