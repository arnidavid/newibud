-- Saga eignarinnar: allar þinglýstar sölur einnar eignar (fastanúmer) frá 2006, meðalfermetraverð
-- hverfisins (sama póstnúmer og tegund) á sama tímabili til samanburðar, og auglýsingar sem fundust
-- fyrir eignina. Notað í Verðmat-flipanum og á slóðinni #eign/<fastanúmer>.
-- Keyrir með réttindum þess sem kallar (anon má þegar lesa kaupskra, mv_manadarsolur og fastinn_listings).
--
-- Leitin (leita_eign, eignir_a_heimilisfangi) nær nú yfir allt landið og sumarhús, því sölusagan
-- þarf ekki verðmatslíkan. Verðmatið sjálft (get_verdmat) er óbreytt og aðeins reiknað þar sem það
-- á við (vefurinn ákveður það).

-- 1. saga_eignar: eitt JSON-svar með eign, sölum, hverfi og auglýsingum
create or replace function public.saga_eignar(p_fastnum text)
returns json
language sql
stable
set search_path = public
as $$
  with s as (
    select * from kaupskra
     where fastnum = p_fastnum and onothaefur_samningur is distinct from '1' and kaupverd > 0
  ), e as (
    select distinct on (fastnum) fastnum, heimilisfang, postnr, tegund, einflm, byggar, fjherb,
           nullif(fasteignamat_gildandi, 0) as fasteignamat, nullif(fyrirhugad_fasteignamat, 0) as fasteignamat_2027
      from kaupskra where fastnum = p_fastnum
     order by fastnum, thinglystdags desc
  ), h as (
    select m.ar, round(sum(m.sum_fm) / nullif(sum(m.n_fm), 0)) as fm, sum(m.n_fm) as n
      from mv_manadarsolur m, e
     where m.postnr = e.postnr and m.tegund = e.tegund and m.ar >= 2006
     group by m.ar
  )
  select json_build_object(
    'eign', (select row_to_json(e) from e),
    'solur', coalesce((select json_agg(json_build_object(
                 'dags', s.thinglystdags, 'kaupverd', s.kaupverd, 'einflm', s.einflm,
                 'fm', case when s.einflm > 0 then round(s.kaupverd / s.einflm) end,
                 'mat', nullif(s.fasteignamat, 0)) order by s.thinglystdags) from s), '[]'::json),
    'hverfi', coalesce((select json_agg(json_build_object('ar', h.ar, 'fm', h.fm, 'n', h.n) order by h.ar) from h), '[]'::json),
    'augl', coalesce((select json_agg(json_build_object(
                 'fra', l.coalesce_fyrst, 'til', l.last_seen::date, 'virk', not l.removed,
                 'verd', l.verd, 'haest', l.haest_verd, 'linkur', l.linkur) order by l.coalesce_fyrst desc)
               from (select distinct on (coalesce(journey_id::text, id)) *, coalesce(fyrst_birt, first_seen)::date as coalesce_fyrst
                       from fastinn_listings where fastnum = p_fastnum
                      order by coalesce(journey_id::text, id), first_seen desc) l), '[]'::json)
  );
$$;

revoke execute on function public.saga_eignar(text) from public;
grant execute on function public.saga_eignar(text) to anon, authenticated, service_role;

-- 2. Leit eftir heimilisfangi: allt landið, íbúðarhúsnæði og sumarhús
create or replace function public.leita_eign(p_q text)
returns table(heimilisfang text, postnr integer, eignir bigint)
language plpgsql
stable
set search_path = public
as $$
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
    replace(replace(replace(q, '\\', '\\\\'), '%', '\\%'), '_', '\\_') || '%', q);
end
$$;

-- 3. Eignir á heimilisfangi: líka sumarhús
create or replace function public.eignir_a_heimilisfangi(p_heimilisfang text, p_postnr integer)
returns table(fastnum text, tegund text, einflm numeric, fjherb integer, byggar integer,
              fasteignamat bigint, fasteignamat_2027 bigint, solur bigint, sidasta_sala date)
language sql
stable
set search_path = public
as $$
  select distinct on (k.fastnum)
         k.fastnum, k.tegund, k.einflm, k.fjherb, k.byggar, k.fasteignamat_gildandi,
         nullif(max(k.fyrirhugad_fasteignamat) over (partition by k.fastnum), 0),
         count(*) over (partition by k.fastnum), max(k.thinglystdags) over (partition by k.fastnum)
    from kaupskra k
   where lower(k.heimilisfang) = lower(p_heimilisfang) and k.postnr = p_postnr
     and k.tegund in ('Fjölbýli', 'Sérbýli', 'Einbýli', 'Sumarhús') and k.fasteignamat_gildandi > 0
   order by k.fastnum, k.thinglystdags desc
$$;

-- (create or replace heldur heimildum leita_eign og eignir_a_heimilisfangi óbreyttum)

-- Bakka: drop function public.saga_eignar(text); og fyrri skilgreiningar leita_eign/eignir_a_heimilisfangi
-- eru í migrations/2026-10-10_verdmat.sql (og 2026-10-14_verdmat_hradi.sql).
