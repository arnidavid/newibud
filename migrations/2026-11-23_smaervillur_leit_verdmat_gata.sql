-- Smávillur úr yfirferð 23. nóv. 2026
-- 1. leita_eign: bakstrik voru tvöfölduð ('\\' = tvö bakstrik með standard_conforming_strings),
--    svo „_“ eða „%“ í leitarorði fann ekkert. Nú eitt bakstrik.
-- 2. get_verdmat: „else 'hofud'“ setti Voga (190), Grindavík (240) og Suðurnesjabæ (245/250) í
--    höfuðborgarsvæðið (~2,5 % af sölum í samanburðinum). Höfuðborgarsvæðið er nú 100–189, 200–229, 270–276.
-- 3. gata_yfirlit: „like p_gata || ' %'“ las „%“/„_“ í götuheiti úr slóð sem villikort → bein samanburður.
-- create or replace heldur grant-heimildum.

create or replace function public.leita_eign(p_q text)
returns table(heimilisfang text, postnr integer, eignir bigint)
language plpgsql
stable
set search_path = public
as $function$
declare q text := lower(trim(coalesce(p_q, '')));
begin
  if length(q) < 3 then return; end if;
  return query execute format($f$
    select k.heimilisfang, k.postnr, count(distinct k.fastnum)
      from kaupskra k
     where lower(k.heimilisfang) like %L
       and k.tegund in ('Fjölbýli', 'Sérbýli', 'Einbýli', 'Sumarhús')
     group by k.heimilisfang, k.postnr
     order by (lower(k.heimilisfang) = %L) desc, length(k.heimilisfang), k.heimilisfang
     limit 10 $f$,
    replace(replace(replace(q, '\', '\\'), '%', '\%'), '_', '\_') || '%', q);
end
$function$;

create or replace function public.get_verdmat(p_postnr integer, p_tegund text, p_einflm numeric default null, p_fastnum text default null)
returns json
language sql
stable
set search_path = public
as $function$
  with grunnur as (
    select k.postnr, k.svfn, k.gata, k.fastnum, k.thinglystdags, k.einflm, k.byggar, k.kaupverd,
           k.kaupverd::numeric / k.fasteignamat_gildandi as r
    from kaupskra k
    where k.tegund = p_tegund
      and (p_tegund = 'Sumarhús' or k.postnr between 100 and 276 or k.postnr in (600, 603, 800, 801, 300))
      and k.thinglystdags > current_date - case when p_tegund = 'Sumarhús' then 730 else 365 end
      and k.onothaefur_samningur is distinct from '1'
      and k.fasteignamat_gildandi > 0 and k.einflm > 0
      and k.kaupverd / k.einflm between 10 and 2000
      and k.kaupverd::numeric / k.fasteignamat_gildandi between 0.5 and 2
  ),
  svf as (select svfn from kaupskra where postnr = p_postnr and svfn is not null limit 1),
  svaedi as (
    select case when p_tegund = 'Sumarhús' then 'landid'
                when p_postnr in (600, 603) then 'akureyri'
                when p_postnr in (230, 233, 260, 262) then 'reykjanesbaer'
                when p_postnr in (800, 801) then 'selfoss'
                when p_postnr = 300 then 'akranes'
                when p_postnr between 100 and 189 or p_postnr between 200 and 229 or p_postnr between 270 and 276 then 'hofud'
                else 'annad' end as sv
  ),
  stig as (
    select 1 as stig, 'postnr' as svaedi, r from grunnur where postnr = p_postnr
    union all
    select 2, 'sveitarfelag', r from grunnur where svfn = (select svfn from svf)
    union all
    select 3, (select sv from svaedi), r
    from grunnur g
    where case when p_tegund = 'Sumarhús' then 'landid'
               when g.postnr in (600, 603) then 'akureyri'
               when g.postnr in (230, 233, 260, 262) then 'reykjanesbaer'
               when g.postnr in (800, 801) then 'selfoss'
               when g.postnr = 300 then 'akranes'
               when g.postnr between 100 and 189 or g.postnr between 200 and 229 or g.postnr between 270 and 276 then 'hofud'
               else 'annad' end = (select sv from svaedi)
  ),
  hlutf as (
    select stig, svaedi, count(*) as n,
           percentile_cont(array[0.25, 0.5, 0.75]) within group (order by r) as p
    from stig group by stig, svaedi
  ),
  valid as (
    select * from hlutf where n >= 25 or stig = 3 order by stig limit 1
  ),
  samb as (
    select g.gata, g.thinglystdags, g.einflm, g.byggar, g.kaupverd, round(g.r, 4) as r
    from grunnur g
    where g.postnr = p_postnr
      and g.fastnum is distinct from p_fastnum
      and (p_einflm is null or g.einflm between p_einflm * 0.8 and p_einflm * 1.2)
    order by g.thinglystdags desc
    limit 8
  ),
  saga as (
    select k.thinglystdags, k.kaupverd
    from kaupskra k
    where p_fastnum is not null and k.fastnum = p_fastnum
      and k.onothaefur_samningur is distinct from '1'
    order by k.thinglystdags desc
    limit 10
  )
  select json_build_object(
    'svaedi',  v.svaedi,
    'n',       v.n,
    'p25',     round(v.p[1]::numeric, 4),
    'p50',     round(v.p[2]::numeric, 4),
    'p75',     round(v.p[3]::numeric, 4),
    'manudir', case when p_tegund = 'Sumarhús' then 24 else 12 end,
    'samb',    coalesce((select json_agg(s) from samb s), '[]'::json),
    'saga',    coalesce((select json_agg(s) from saga s), '[]'::json)
  )
  from valid v
$function$;

create or replace function public.gata_yfirlit(p_postnr integer, p_gata text)
returns json
language sql
stable
set search_path = public
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
                and (m.heimilisfang = p_gata or left(m.heimilisfang, length(p_gata) + 1) = p_gata || ' ')
                and case when (select flokkur from fl) = 'sumar' then m.tegund = 'sumarhus'
                         else m.tegund in ('fjolb', 'einb', 'einbýlishús', 'raðpar', 'hæðir', 'parhús') end), '[]'::json)
  );
$function$;
