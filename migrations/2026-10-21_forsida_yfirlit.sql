-- Forsíðan í einu kalli: fyrir hvert svæði meðalfermetraverð eftir árum, fjöldi eigna á sölu og nýjustu sölur.
-- Kemur í stað ~35 kalla (mánaðarsamantekt, auglýsingafjöldi og nýjustu sölur á hverju svæði, og allar
-- sumarhúsasölur sóttar hráar síðu fyrir síðu). Svæðin eru skilgreind í app.js (SVAEDI/SUMAR) og send inn:
--   p_ibud  = {"hofud": [101, 102, …], "akureyri": [600, 603], …}   íbúðarhúsnæði (fjölbýli, sérbýli, einbýli)
--   p_sumar = {"sumar": 311, "grimsnes": 805, "blaskogar": 806}     sumarhús
-- Sömu síur og forsíðan notaði áður, svo tölurnar breytast ekki:
--   íbúðir:    ársmeðaltöl úr mv_manadarsolur (eins og get_manadarsolur_svaedi); nýjustu sölur kaupverd > 5000, einflm > 20
--   sumarhús:  kaupverd > 500, ónothæfir samningar út, fermetraverð 10–2000 í meðaltali (eins og yearStatsFromRows);
--              nýjustu sölur einflm > 10
--   á sölu:    sama talning og auglysingar_a_solu (mv_a_solu)
-- Les aðeins; keyrir með réttindum þess sem kallar (anon má lesa kaupskra, mv_manadarsolur, mv_a_solu).

-- Vísir fyrir sumarhúsasölur: ársmeðaltölin lesast úr vísinum einum (~40 síður í stað ~3.700 dreifðra raða).
-- Skiptir máli þegar gagnagrunnsþjónninn er hægur: fyrsta kall forsíðunnar tók annars yfir 3 sek.
create index if not exists idx_kaupskra_sumarhus on public.kaupskra (postnr, thinglystdags desc)
  include (kaupverd, einflm, onothaefur_samningur) where tegund = 'Sumarhús';

create or replace function public.forsida_yfirlit(p_ibud jsonb, p_sumar jsonb)
returns json
language sql
stable
set search_path = public
as $$
  with ib as (
    select key as sv, array(select jsonb_array_elements_text(value)::int) as pn from jsonb_each(p_ibud)
  ), sm as (
    select key as sv, value::text::int as pn from jsonb_each(p_sumar)
  ), ib_ar as (
    select ib.sv, m.ar, sum(m.n_allt)::bigint as n_allt, sum(m.n_fm)::bigint as n_fm, sum(m.sum_fm) as sum_fm
      from ib join mv_manadarsolur m on m.postnr = any(ib.pn) and m.tegund in ('Fjölbýli', 'Sérbýli', 'Einbýli')
     group by ib.sv, m.ar
  ), sm_ar as (
    select sm.sv, extract(year from k.thinglystdags)::int as ar, count(*) as n_allt,
           count(*) filter (where k.einflm > 0 and k.kaupverd / k.einflm > 10 and k.kaupverd / k.einflm < 2000) as n_fm,
           sum(k.kaupverd / k.einflm) filter (where k.einflm > 0 and k.kaupverd / k.einflm > 10 and k.kaupverd / k.einflm < 2000) as sum_fm
      from sm join kaupskra k on k.postnr = sm.pn
     where k.tegund = 'Sumarhús' and k.kaupverd > 500 and k.onothaefur_samningur is distinct from '1'
     group by 1, 2
  ), svaedi as (
    select ib.sv,
           (select json_agg(json_build_object('ar', a.ar, 'n_allt', a.n_allt, 'n_fm', a.n_fm, 'sum_fm', a.sum_fm) order by a.ar)
              from ib_ar a where a.sv = ib.sv) as ar,
           (select count(*) from mv_a_solu m
             where m.postnr = any(ib.pn) and m.tegund in ('fjolb', 'einb', 'einbýlishús', 'raðpar', 'hæðir')) as ls,
           (select json_agg(s order by s.thinglystdags desc) from (
              select k.heimilisfang, k.postnr, k.tegund, k.kaupverd, k.einflm, k.thinglystdags, k.fastnum, k.heinum
                from kaupskra k
               where k.postnr = any(ib.pn) and k.tegund in ('Fjölbýli', 'Sérbýli', 'Einbýli')
                 and k.kaupverd > 5000 and k.einflm > 20 and k.onothaefur_samningur is distinct from '1'
               order by k.thinglystdags desc
               limit case when ib.sv = 'hofud' then 5 else 3 end) s) as solur
      from ib
    union all
    select sm.sv,
           (select json_agg(json_build_object('ar', a.ar, 'n_allt', a.n_allt, 'n_fm', a.n_fm, 'sum_fm', a.sum_fm) order by a.ar)
              from sm_ar a where a.sv = sm.sv),
           (select count(*) from mv_a_solu m where m.postnr = sm.pn and m.tegund = 'sumarhus'),
           (select json_agg(s order by s.thinglystdags desc) from (
              select k.heimilisfang, k.postnr, k.tegund, k.kaupverd, k.einflm, k.thinglystdags, k.fastnum, k.heinum
                from kaupskra k
               where k.postnr = sm.pn and k.tegund = 'Sumarhús' and k.kaupverd > 500 and k.einflm > 10
                 and k.onothaefur_samningur is distinct from '1'
               order by k.thinglystdags desc
               limit 3) s)
      from sm
  )
  select json_object_agg(sv, json_build_object('ar', coalesce(ar, '[]'::json), 'ls', ls, 'solur', coalesce(solur, '[]'::json)))
    from svaedi;
$$;

revoke execute on function public.forsida_yfirlit(jsonb, jsonb) from public;
grant execute on function public.forsida_yfirlit(jsonb, jsonb) to anon, authenticated, service_role;

-- Bakka: drop function public.forsida_yfirlit(jsonb, jsonb); drop index public.idx_kaupskra_sumarhus;
