-- „Á sölu núna“: tvær lagfæringar eftir að visir.is tók við af fastinn (3. nóv. 2026)
--
-- 1. Óþekkt fyrsta birting. Um 1.900 visir-eignir pöruðust ekki við eldri fastinn-línu, svo ekki er vitað
--    hvenær þær voru fyrst auglýstar. mv_a_solu notaði first_seen í staðinn (= fyrsta keyrsla 3. nóv.),
--    og þær birtust allar efst sem „Nýtt á sölu“ og drógu miðgildi daga á sölu niður.
--    Nú fá þær fyrst_birt = null: vefurinn sýnir þá engan dagafjölda og raðar þeim aftast, og miðgildið
--    sleppir þeim. Eignir sem birtast á visir EFTIR fyrstu keyrslu fá áfram first_seen (þær eru í alvöru nýjar).
-- 2. Auglýsingar sem eru ekki eignir til sölu: „TIL LEIGU …“, „Óska eftir …“, „Server s3 Test Property“.
--    Síaðar burt hér (línurnar haldast í fastinn_listings). „Til leigu eða sölu“ heldur sér.
--
-- auglysingar_a_solu og gata_yfirlit: `nulls last` svo eignir án dags lendi aftast (desc setur null fremst).

begin;

drop materialized view public.mv_a_solu;

create materialized view public.mv_a_solu as
select distinct on (coalesce(l.journey_id::text, l.id))
       coalesce(l.journey_id::text, l.id) as ferill,
       l.heimilisfang, l.tegund, l.postnr, l.verd, l.staerd, l.linkur,
       case when l.fyrst_birt is null and l.id like 'visir:%' and l.first_seen < '2026-11-04'
            then null                                    -- óþekkt: kom inn í fyrstu visir-keyrslu án pörunar
            else coalesce(l.fyrst_birt, l.first_seen) end as fyrst_birt,
       l.haest_verd
  from fastinn_listings l
 where not l.removed
   and not (l.heimilisfang ~* '(til\s+leigu|ósk\w*\s+eftir|test\s+property)' and l.heimilisfang !~* 'sölu')
 order by coalesce(l.journey_id::text, l.id), l.first_seen desc;   -- nýjasta birting ferilsins

create unique index mv_a_solu_ferill on public.mv_a_solu (ferill);   -- þarf fyrir refresh concurrently
create index mv_a_solu_postnr on public.mv_a_solu (postnr, tegund);
grant select on public.mv_a_solu to anon, authenticated;
grant select, insert, update, delete on public.mv_a_solu to service_role;

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
   order by v.fyrst_birt desc nulls last
   limit p_limit;
$$;

create or replace function public.gata_yfirlit(p_postnr integer, p_gata text)
 returns json
 language sql
 stable
 set search_path to 'public'
as $function$
  with allt as (
    select * from kaupskra
     where gata = p_gata and postnr = p_postnr
       and onothaefur_samningur is distinct from '1' and kaupverd > 0 and einflm > 0
       and tegund in ('Fjölbýli', 'Sérbýli', 'Einbýli', 'Sumarhús')
  ), fl as (
    select case when count(*) filter (where tegund = 'Sumarhús') * 2 > count(*) then 'sumar' else 'ibud' end as flokkur,
           max(gata) as gata
      from allt
  ), teg as (
    select unnest(case when (select flokkur from fl) = 'sumar' then array['Sumarhús'] else array['Fjölbýli', 'Sérbýli', 'Einbýli'] end) as tegund
  ), s as (
    select a.*, round(a.kaupverd / a.einflm) as fm
      from allt a
     where a.tegund in (select tegund from teg) and a.kaupverd / a.einflm between 10 and 2000
  ), ar_gata as (
    select extract(year from thinglystdags)::int as ar, round(avg(fm)) as fm, count(*) as n from s group by 1
  ), ar_pn as (
    select m.ar, round(sum(m.sum_fm) / nullif(sum(m.n_fm), 0)) as fm, sum(m.n_fm) as n
      from mv_manadarsolur m
     where m.postnr = p_postnr and m.tegund in (select tegund from teg) and m.ar >= 2006
     group by m.ar
  ), nylegt as (
    select
      (select round(percentile_cont(0.5) within group (order by fm)) from s where thinglystdags > current_date - 730) as fm_gata,
      (select count(*) from s where thinglystdags > current_date - 730) as n_gata,
      (select round(percentile_cont(0.5) within group (order by k.kaupverd / k.einflm))
         from kaupskra k
        where k.postnr = p_postnr and k.tegund in (select tegund from teg) and k.thinglystdags > current_date - 730
          and k.onothaefur_samningur is distinct from '1' and k.einflm > 0 and k.kaupverd / k.einflm between 10 and 2000) as fm_pn
  )
  select json_build_object(
    'gata', (select gata from fl), 'postnr', p_postnr, 'flokkur', (select flokkur from fl),
    'n', (select count(*) from s), 'eignir', (select count(distinct fastnum) from s),
    'nylegt', (select row_to_json(nylegt) from nylegt),
    'solur', coalesce((select json_agg(json_build_object(
                 'fastnum', x.fastnum, 'heimilisfang', x.heimilisfang, 'tegund', x.tegund, 'dags', x.thinglystdags,
                 'kaupverd', x.kaupverd, 'einflm', x.einflm, 'fm', x.fm) order by x.thinglystdags desc)
               from (select * from s order by thinglystdags desc limit 300) x), '[]'::json),
    'ar_gata', coalesce((select json_agg(json_build_object('ar', ar, 'fm', fm, 'n', n) order by ar) from ar_gata), '[]'::json),
    'ar_pn', coalesce((select json_agg(json_build_object('ar', ar, 'fm', fm, 'n', n) order by ar) from ar_pn), '[]'::json),
    'a_solu', coalesce((select json_agg(json_build_object(
                 'heimilisfang', m.heimilisfang, 'verd', m.verd, 'staerd', m.staerd, 'linkur', m.linkur,
                 'fyrst_birt', m.fyrst_birt::date, 'haest', m.haest_verd) order by m.fyrst_birt desc nulls last)
               from mv_a_solu m
              where m.postnr = p_postnr
                and (m.heimilisfang = p_gata or m.heimilisfang like p_gata || ' %')
                and case when (select flokkur from fl) = 'sumar' then m.tegund = 'sumarhus'
                         else m.tegund in ('fjolb', 'einb', 'einbýlishús', 'raðpar', 'hæðir', 'parhús') end), '[]'::json)
  );
$function$;

commit;

-- Bakka: keyra 2026-10-17_auglysingar_a_solu.sql lið 3 (mv_a_solu + auglysingar_a_solu) aftur, og
-- gata_yfirlit án `nulls last`. Cron-jobin `refresh-mv-a-solu` vísar í nafnið og þarf ekki að breyta.
