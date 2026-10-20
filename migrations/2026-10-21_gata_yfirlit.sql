-- Verð í götunni: allar sölur í einni götu (póstnúmer + götuheiti) frá 2006, meðalfermetraverð götunnar
-- og póstnúmersins eftir árum til samanburðar, og eignir á sölu í götunni núna.
-- Flokkur götunnar ræðst af meirihluta sölna: sumarhúsagata ber sig saman við sumarhús í póstnúmerinu,
-- annars íbúðarhúsnæði (fjölbýli, sérbýli, einbýli). Notað á slóðinni #gata/<postnr>/<gata>.
-- Götuheitið þarf að vera nákvæmt (hástafir skipta máli); vefurinn tekur það úr heimilisfangi, sem passar alltaf við gata-dálkinn.
-- Les aðeins; keyrir með réttindum þess sem kallar (anon má lesa kaupskra, mv_manadarsolur, mv_a_solu).

create or replace function public.gata_yfirlit(p_postnr integer, p_gata text)
returns json
language sql
stable
set search_path = public
as $$
  with allt as (
    select * from kaupskra
     where gata = p_gata and postnr = p_postnr          -- nákvæmt heiti: nýtir idx_kaupskra_gata_cover (lower() las alla götur póstnúmersins)
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
                 'fyrst_birt', m.fyrst_birt::date, 'haest', m.haest_verd) order by m.fyrst_birt desc)
               from mv_a_solu m
              where m.postnr = p_postnr
                and (m.heimilisfang = p_gata or m.heimilisfang like p_gata || ' %')
                and case when (select flokkur from fl) = 'sumar' then m.tegund = 'sumarhus'
                         else m.tegund in ('fjolb', 'einb', 'einbýlishús', 'raðpar', 'hæðir', 'parhús') end), '[]'::json)
  );
$$;

revoke execute on function public.gata_yfirlit(integer, text) from public;
grant execute on function public.gata_yfirlit(integer, text) to anon, authenticated, service_role;

-- Bakka: drop function public.gata_yfirlit(integer, text);
