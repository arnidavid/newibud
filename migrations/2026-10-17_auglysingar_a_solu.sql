-- „Á sölu núna“ les úr okkar gagnagrunni í stað þess að vafrinn spyrji leitarvél fastinn.is beint.
-- Safnarinn (n8n fastinn_listings_scraper) fyllir nýju dálkana; ef aðgangur að fastinn.is lokast
-- sýnir síðan síðustu þekktu stöðu í stað þess að tæmast.

-- 1. Söluferlisdálkar (endurbirtingar sömu eignar hjá sömu fasteignasölu = einn ferill)
alter table public.fastinn_listings
  add column if not exists journey_id bigint,        -- auðkenni söluferils
  add column if not exists fyrst_birt timestamptz,   -- fyrsta birting ferilsins
  add column if not exists haest_verd bigint;        -- hæsta ásetta verð í ferlinum (kr)

create index if not exists idx_listings_virkar on public.fastinn_listings (postnr) where not removed;

-- 2. Virkar auglýsingar á póstnúmerum, ein lína á söluferil, nýjast fyrst.
--    alls / midgildi_daga / n_laekkad eru reiknuð yfir ALLAR línur, ekki bara þær p_limit sem skilað er.
create or replace function public.auglysingar_a_solu(p_postnrs int[], p_tegundir text[], p_limit int default 1000)
returns table (
  heimilisfang text, tegund text, postnr int, verd bigint, staerd numeric, linkur text,
  fyrst_birt timestamptz, haest_verd bigint,
  alls bigint, midgildi_daga int, n_laekkad bigint
)
language sql stable
set search_path = public
as $$
  with v as (
    select distinct on (coalesce(l.journey_id::text, l.id))
           l.heimilisfang, l.tegund, l.postnr, l.verd, l.staerd, l.linkur,
           coalesce(l.fyrst_birt, l.first_seen) as fyrst_birt, l.haest_verd
      from fastinn_listings l
     where not l.removed
       and l.postnr = any(p_postnrs)
       and (p_tegundir is null or l.tegund = any(p_tegundir))
     order by coalesce(l.journey_id::text, l.id), l.first_seen desc   -- nýjasta birting ferilsins
  ), s as (
    select count(*) as alls,
           percentile_disc(0.5) within group (order by (current_date - fyrst_birt::date))::int as midgildi_daga,
           count(*) filter (where haest_verd > 0 and verd > 0 and verd <= haest_verd * 0.995) as n_laekkad
      from v
  )
  select v.*, s.alls, s.midgildi_daga, s.n_laekkad
    from v cross join s
   order by v.fyrst_birt desc
   limit p_limit;
$$;

grant execute on function public.auglysingar_a_solu(int[], text[], int) to anon, authenticated;

-- Bakka:
--   drop function public.auglysingar_a_solu(int[], text[], int);
--   drop index public.idx_listings_virkar;
--   alter table public.fastinn_listings drop column journey_id, drop column fyrst_birt, drop column haest_verd;

-- ============================================================
-- 3. (Viðbót sama dag) Hraði: fallið las nánast alla fastinn_listings (143 þús. línur) í hverju kalli
--    og tók 0,05–1,5 sek. eftir álagi; forsíðan rann á tímamörk (anon: 3 sek.).
--    Lausn: lítil samantekt með aðeins virkum auglýsingum, ein lína á söluferil (~18 þús. mjóar línur),
--    endurnýjuð á klukkutíma fresti (safnarinn keyrir daglega).
create materialized view public.mv_a_solu as
select distinct on (coalesce(l.journey_id::text, l.id))
       coalesce(l.journey_id::text, l.id) as ferill,
       l.heimilisfang, l.tegund, l.postnr, l.verd, l.staerd, l.linkur,
       coalesce(l.fyrst_birt, l.first_seen) as fyrst_birt, l.haest_verd
  from fastinn_listings l
 where not l.removed
 order by coalesce(l.journey_id::text, l.id), l.first_seen desc;   -- nýjasta birting ferilsins

create unique index mv_a_solu_ferill on public.mv_a_solu (ferill);   -- þarf fyrir refresh concurrently
create index mv_a_solu_postnr on public.mv_a_solu (postnr, tegund);
grant select on public.mv_a_solu to anon, authenticated;

create or replace function public.auglysingar_a_solu(p_postnrs int[], p_tegundir text[], p_limit int default 1000)
returns table (
  heimilisfang text, tegund text, postnr int, verd bigint, staerd numeric, linkur text,
  fyrst_birt timestamptz, haest_verd bigint,
  alls bigint, midgildi_daga int, n_laekkad bigint
)
language sql stable
set search_path = public
as $$
  with v as (
    select m.heimilisfang, m.tegund, m.postnr, m.verd, m.staerd, m.linkur, m.fyrst_birt, m.haest_verd
      from mv_a_solu m
     where m.postnr = any(p_postnrs)
       and (p_tegundir is null or m.tegund = any(p_tegundir))
  ), s as (
    select count(*) as alls,
           percentile_disc(0.5) within group (order by (current_date - fyrst_birt::date))::int as midgildi_daga,
           count(*) filter (where haest_verd > 0 and verd > 0 and verd <= haest_verd * 0.995) as n_laekkad
      from v
  )
  select v.*, s.alls, s.midgildi_daga, s.n_laekkad
    from v cross join s
   order by v.fyrst_birt desc
   limit p_limit;
$$;

select cron.schedule('refresh-mv-a-solu', '20 * * * *', 'REFRESH MATERIALIZED VIEW CONCURRENTLY mv_a_solu');

-- Bakka viðbótina:
--   select cron.unschedule('refresh-mv-a-solu');
--   (fallið í lið 2 aftur), drop materialized view public.mv_a_solu;
