-- Auglýsingar á sölu frá fasteignir.visir.is í stað fastinn.is.
-- 3. nóv. 2026 um kl. 10–11 hætti fastinn.is að nota Algolia; leitin er nú á „Findlane“ og síuð leit
-- krefst áskriftar (/api/search/key → 403 „subscribers only“). Safnarinn (n8n fastinn_listings_scraper)
-- var gerður óvirkur. Nýr safnari (n8n „visir_listings_scraper“) les leitarniðurstöður fasteignir.visir.is
-- einu sinni á sólarhring og skrifar í SÖMU töflu, fastinn_listings, svo síðan (mv_a_solu,
-- auglysingar_a_solu, gata_yfirlit, saga_eignar, auglysing_fyrir_solu) virkar óbreytt.
--
-- - Auðkenni visir-lína: 'visir:<eignanúmer>' (t.d. visir:1144507), linkur = fasteignir.visir.is/property/…
-- - Ný visir-lína erfir fastnum, heinum, journey_id, fyrstu birtingu og hæsta verð frá samsvarandi
--   fastinn-línu (sama póstnr + heimilisfang + stærð ±1 m²). Heimilisföng eru eins skrifuð á báðum
--   stöðum, t.d. „Ánanaust 3 (504)“. Án pörunar er fyrsta birting = fyrst séð hjá okkur.
-- - Hæsta verð er reiknað hér (visir sýnir ekki auglýsingaverðsögu).
-- - Fjarlægðar: sér fall sem snertir aðeins visir-línur (sama 80 % öryggi og merkja_fjarlaegdar).
--
-- STAÐA: A–D keyrt 3. nóv. 2026 (samþykkt af Árna); vista_visir prófað í færslu sem var bakkað. E ekki keyrt.
-- n8n: visir_listings_scraper (zV9eHiAHTJJMfDF2), kóði hnútsins „Lesa eignir“ í n8n/visir_lesa_eignir.js.
--
-- Röð: 1) keyra liði A–D  2) fyrsta keyrsla safnarans  3) athuga pörun  4) keyra lið E (eldri fastinn-línur
-- merktar fjarlægðar, svo „Á sölu núna“ sýni ekki tvítalið).

-- ============================================================
-- A. Vísir fyrir pörun eftir heimilisfangi
create index if not exists idx_listings_postnr_heimilisfang
  on public.fastinn_listings (postnr, lower(heimilisfang));

-- ============================================================
-- B. Vista eina lotu (≤ 500 línur) frá visir
create or replace function public.vista_visir(p_rows jsonb)
returns int
language plpgsql
set search_path = public
as $$
declare
  n int;
begin
  with r as (
    select *
      from jsonb_to_recordset(p_rows) as x(id text, heimilisfang text, tegund text, postnr int, verd bigint,
                                           staerd numeric, myndir int, linkur text, mynd_url text)
  ), m as (
    select r.*, f.fastnum, f.heinum, f.journey_id, f.fyrst_birt, f.haest_verd
      from r
      left join lateral (
        select l.fastnum, l.heinum, l.journey_id, coalesce(l.fyrst_birt, l.first_seen) as fyrst_birt, l.haest_verd
          from fastinn_listings l
         where l.postnr = r.postnr
           and lower(l.heimilisfang) = lower(r.heimilisfang)
           and l.id not like 'visir:%'
           and (r.staerd is null or l.staerd is null or abs(l.staerd - r.staerd) <= 1)
           and l.last_seen > now() - interval '120 days'
         order by l.removed, l.last_seen desc
         limit 1
      ) f on not exists (select 1 from fastinn_listings e where e.id = r.id)   -- aðeins fyrir nýjar línur
  )
  insert into fastinn_listings as t
         (id, heimilisfang, tegund, postnr, verd, staerd, myndir, linkur, mynd_url, last_seen, removed,
          fastnum, heinum, journey_id, fyrst_birt, haest_verd)
  select id, heimilisfang, tegund, postnr, verd, staerd, myndir, linkur, mynd_url, now(), false,
         fastnum, heinum, journey_id, fyrst_birt, greatest(haest_verd, verd)
    from m
  on conflict (id) do update set
    -- auglýstar eignir efst á síðu sýna bara götuheiti: halda fullu heimilisfangi ef það er komið
    heimilisfang = case when excluded.heimilisfang ~ '\d' or t.heimilisfang !~ '\d'
                        then excluded.heimilisfang else t.heimilisfang end,
    tegund     = excluded.tegund,
    postnr     = excluded.postnr,
    verd       = excluded.verd,
    staerd     = coalesce(excluded.staerd, t.staerd),
    myndir     = excluded.myndir,
    linkur     = excluded.linkur,
    mynd_url   = excluded.mynd_url,
    last_seen  = now(),
    removed    = false,
    haest_verd = greatest(t.haest_verd, excluded.verd);
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke execute on function public.vista_visir(jsonb) from public, anon, authenticated;
grant execute on function public.vista_visir(jsonb) to service_role;

-- ============================================================
-- C. Merkja fjarlægðar visir-auglýsingar (snertir ekki fastinn-línur)
create or replace function public.merkja_fjarlaegdar_visir(p_virk text[])
returns int
language plpgsql
set search_path = public
as $$
declare
  n_virk int;
  n int;
begin
  select count(*) into n_virk from fastinn_listings
   where not removed and id >= 'visir:' and id < 'visir;';
  if coalesce(cardinality(p_virk), 0) < n_virk * 0.8 then
    raise exception 'merkja_fjarlaegdar_visir: aðeins % virkar auglýsingar í keyrslu en % í töflu – engu breytt',
      coalesce(cardinality(p_virk), 0), n_virk;
  end if;
  update fastinn_listings l
     set removed = true, last_seen = now()
   where not l.removed
     and l.id >= 'visir:' and l.id < 'visir;'
     and not exists (select 1 from unnest(p_virk) v(id) where v.id = l.id);
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke execute on function public.merkja_fjarlaegdar_visir(text[]) from public, anon, authenticated;
grant execute on function public.merkja_fjarlaegdar_visir(text[]) to service_role;

-- ============================================================
-- D. fastinn_fastanumer les fastinn.is-síður: sleppa visir-línum (þær fá fastnum með pörun í B)
create or replace function public.fastinn_vantar_fastnum(p_limit integer default 100)
returns table (id text, linkur text)
language sql stable
set search_path = public
as $$
  select l.id, l.linkur
  from fastinn_listings l
  where l.fastnum is null
    and l.id not like 'visir:%'
    and (l.fastnum_sott is null or l.fastnum_sott < now() - interval '7 days')
    and (l.postnr = 311 or not l.removed)
  order by (l.postnr = 311) desc, l.first_seen desc nulls last
  limit p_limit;
$$;

-- ============================================================
-- E. EFTIR fyrstu heppnuðu visir-keyrslu (keyrt sér): eldri fastinn-auglýsingar eru úreltar síðan
--    3. nóv. kl. 10 og yrðu annars tvítaldar í „Á sölu núna“. Merktar fjarlægðar með síðast séð kl. 10.
-- update public.fastinn_listings
--    set removed = true, last_seen = '2026-11-03 10:00:57+00'
--  where not removed and id not like 'visir:%';
-- refresh materialized view concurrently public.mv_a_solu;

-- Bakka:
--   delete from public.fastinn_listings where id like 'visir:%';
--   update public.fastinn_listings set removed = false
--    where id not like 'visir:%' and last_seen = '2026-11-03 10:00:57+00' and removed;   (ef E var keyrt)
--   drop function public.vista_visir(jsonb); drop function public.merkja_fjarlaegdar_visir(text[]);
--   drop index public.idx_listings_postnr_heimilisfang;
--   fastinn_vantar_fastnum: fyrri útgáfa án „id not like 'visir:%'“
