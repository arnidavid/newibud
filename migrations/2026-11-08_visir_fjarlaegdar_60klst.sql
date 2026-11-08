-- merkja_fjarlaegdar_visir: 36 → 60 klst. (8. nóv. 2026)
--
-- Fyrsta næturkeyrsla með lagfæringunni frá 7. nóv. (2026-11-07_visir_fjarlaegdar_lagad.sql) gekk:
-- 543 merktar fjarlægðar, engin „aftur“ (ranglega merkt sem birtist aftur), engin villa.
--
-- En: gikkurinn z_sleppa_obreyttum uppfærir last_seen á ÓBREYTTRI auglýsingu aðeins ef hún er 20–27 klst.
-- gömul (dreift eftir hashtext(id)). Safnarinn keyrir á 24 klst. fresti, svo um helmingur auglýsinga fær
-- nýtt last_seen aðeins annan hvern dag: auglýsing sem er á sölu getur borið allt að ~48 klst. gamalt
-- last_seen. 8. nóv.: 8.486 með last_seen í nótt, 5.102 með gærdaginn – þær sáust líka í nótt.
-- (Þetta skýrir líka „1.999 hurfu“ 7. nóv.: safnarinn missti þær ekki, last_seen var bara ekki uppfært.)
--
-- Með 36 klst. gat því EIN misheppnuð keyrsla merkt auglýsingu fjarlægða. Með 60 klst.: auglýsing sem er
-- til staðar í keyrslu fær last_seen ≤ 48 klst. gamalt, svo til að last_seen sé > 60 klst. gamalt verður
-- hún að hafa vantað í a.m.k. tvær síðustu keyrslur. Á móti hverfa seldar eignir 2–3 sólarhringum eftir
-- að auglýsingin er tekin út (áður 1–2).
-- Öryggisathugunin miðar líka við 60 klst. (auglýsingar sem sáust í tveimur síðustu keyrslum).
--
-- Bakka: keyra fallið úr 2026-11-07_visir_fjarlaegdar_lagad.sql aftur.

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
   where not removed and id like 'visir:%' and last_seen > now() - interval '60 hours';
  if coalesce(cardinality(p_virk), 0) < n_nylegar * 0.8 then
    raise exception 'merkja_fjarlaegdar_visir: aðeins % auglýsingar í keyrslu en % sáust síðustu 60 klst. – engu breytt',
      coalesce(cardinality(p_virk), 0), n_nylegar;
  end if;
  update fastinn_listings l
     set removed = true
   where not l.removed
     and l.id like 'visir:%'
     and l.last_seen < now() - interval '60 hours'
     and not exists (select 1 from unnest(p_virk) v(id) where v.id = l.id);
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke execute on function public.merkja_fjarlaegdar_visir(text[]) from public, anon, authenticated;
grant execute on function public.merkja_fjarlaegdar_visir(text[]) to service_role;
