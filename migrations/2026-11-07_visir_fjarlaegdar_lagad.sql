-- merkja_fjarlaegdar_visir hefur aldrei merkt neitt (3.–7. nóv. 2026)
--
-- Villa: síunin `id >= 'visir:' and id < 'visir;'` finnur 0 línur. Gagnagrunnurinn notar en_US-stafaröðun,
-- þar sem greinarmerki eru hunsuð í fyrstu umferð samanburðar: 'visir:1144507' < 'visir;' er ÓSATT.
-- Afleiðing: n_virk = 0 (öryggið stóðst alltaf) og UPDATE snerti 0 línur. 7. nóv. voru 4.106 visir-auglýsingar
-- sem sáust ekki í nýjustu keyrslu enn merktar virkar í „Á sölu núna“; úrtak sýndi að þær sem hurfu 3. nóv.
-- eru horfnar af visir („fannst ekki“).
--
-- Annað sem kom í ljós: safnarinn missir stundum af hluta auglýsinga í einni keyrslu (6. → 7. nóv. „hurfu“
-- 1.999 = 14 %, en 4 af 6 í úrtaki voru enn á visir). Því er auglýsing nú aðeins merkt fjarlægð ef hún hefur
-- ekki sést í TVEIMUR keyrslum í röð (last_seen eldra en 36 klst.). Ein keyrsla á sólarhring kl. 01:30.
--
-- Breytingar:
--  1. `id like 'visir:%'` í stað bilsins (sama og annars staðar, t.d. mv_a_solu og vista_visir)
--  2. Fjarlægð = ekki í þessari keyrslu OG ekki séð síðustu 36 klst.
--  3. Öryggið ber keyrsluna saman við auglýsingar sem sáust síðustu 36 klst. (ekki allar „virkar“,
--     því þær innihéldu uppsafnaðar horfnar línur og hefðu fellt keyrsluna í nótt)
--  4. last_seen er látið óbreytt við merkingu: þá sýnir það hvenær auglýsingin sást síðast, ekki
--     hvenær hún var merkt (sem er nú degi síðar vegna reglu 2)
--  5. Einskiptis hreinsun: merkja strax þær sem hafa ekki sést í 36 klst. (~2.100) og endurnýja mv_a_solu
--
-- Bakka: keyra lið C úr 2026-11-03_visir_safnari.sql aftur (fallið), og
--   update fastinn_listings set removed = false where id like 'visir:%' and removed;  (ef þarf)

begin;

create or replace function public.merkja_fjarlaegdar_visir(p_virk text[])
returns int
language plpgsql
set search_path = public
as $$
declare
  n_nylegar int;
  n int;
begin
  select count(*) into n_nylegar from fastinn_listings
   where not removed and id like 'visir:%' and last_seen > now() - interval '36 hours';
  if coalesce(cardinality(p_virk), 0) < n_nylegar * 0.8 then
    raise exception 'merkja_fjarlaegdar_visir: aðeins % auglýsingar í keyrslu en % sáust síðustu 36 klst. – engu breytt',
      coalesce(cardinality(p_virk), 0), n_nylegar;
  end if;
  update fastinn_listings l
     set removed = true
   where not l.removed
     and l.id like 'visir:%'
     and l.last_seen < now() - interval '36 hours'
     and not exists (select 1 from unnest(p_virk) v(id) where v.id = l.id);
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke execute on function public.merkja_fjarlaegdar_visir(text[]) from public, anon, authenticated;
grant execute on function public.merkja_fjarlaegdar_visir(text[]) to service_role;

-- Einskiptis hreinsun (7. nóv. 2026): auglýsingar sem hafa ekki sést í tveimur keyrslum eða fleiri
update fastinn_listings
   set removed = true
 where not removed
   and id like 'visir:%'
   and last_seen < now() - interval '36 hours';

commit;

refresh materialized view concurrently mv_a_solu;
