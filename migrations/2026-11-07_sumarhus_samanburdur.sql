-- Samanburðartafla sumarhúsasvæða (sumarhúsaflipinn, „Svæðin borin saman“), 7. nóv. 2026
--
-- Ein lína á svæði + 'landid' (öll sumarhús á landinu sem viðmið). Svæðin koma úr SUMAR í app.js:
--   p_sumar = {"sumar": 311, "grimsnes": 805, "blaskogar": 806}
-- Tímabil miðast við síðasta þinglýsingardag í kaupskrá (til), ekki daginn í dag:
--   w0 = síðustu 12 mán., w1 = 12 mán. þar á undan, w5 = sömu 12 mán. fyrir 5 árum
-- Síur eins og annars staðar á sumarhúsaflipanum/forsíðu (forsida_yfirlit): kaupverd > 500, ónothæfir út,
-- fermetraverð = meðaltal 10–2000 þ.kr/m². Söluverð/mat = miðgildi eldri húsa (nýbyggingar = byggð söluárið
-- eða árið áður, oft metnar fokheldar) – sama regla og grafið á flipanum (b152a78).
-- Á sölu og dagar á sölu úr mv_a_solu (sama og „Á sölu núna“); eignir án þekktrar fyrstu birtingar sleppt í dögum.
-- Les aðeins; keyrir með réttindum þess sem kallar (anon má lesa kaupskra og mv_a_solu).
--
-- Bakka: drop function public.sumarhus_samanburdur(jsonb);

create or replace function public.sumarhus_samanburdur(p_sumar jsonb)
returns table (sv text, til date, n_12 int, n_fyrra int, fm_12 int, fm_fyrra int, fm_5ar int,
               midg_verd int, mat_pct int, yfir_pct int, n_mat int, a_solu int, dagar int)
language sql
stable
set search_path = public
as $$
  with t as (select max(thinglystdags) as d from kaupskra),
  s as (
    select key as sv, value::text::int as pn from jsonb_each(p_sumar)
    union all select 'landid', null
  ),
  k as (
    select s.sv, k.kaupverd, k.einflm, k.fasteignamat,
           k.byggar < extract(year from k.thinglystdags) - 1 as eldra,
           case when k.thinglystdags >  t.d - interval '1 year'  then 0
                when k.thinglystdags >  t.d - interval '2 years' then 1
                when k.thinglystdags <= t.d - interval '5 years' then 5 end as w,
           k.einflm > 0 and k.kaupverd / k.einflm > 10 and k.kaupverd / k.einflm < 2000 as fm_ok
      from s cross join t
      join kaupskra k on k.tegund = 'Sumarhús' and (s.pn is null or k.postnr = s.pn)
     where k.kaupverd > 500 and k.onothaefur_samningur is distinct from '1'
       and k.thinglystdags > t.d - interval '6 years'
  ),
  a as (
    select s.sv, count(*)::int as a_solu,
           round(percentile_cont(.5) within group (order by extract(epoch from now() - m.fyrst_birt) / 86400)
                 filter (where m.fyrst_birt is not null))::int as dagar
      from s join mv_a_solu m on m.tegund = 'sumarhus' and (s.pn is null or m.postnr = s.pn)
     group by s.sv
  )
  select k.sv, (select d from t),
         (count(*) filter (where w = 0))::int,
         (count(*) filter (where w = 1))::int,
         round(avg(kaupverd / einflm) filter (where w = 0 and fm_ok))::int,
         round(avg(kaupverd / einflm) filter (where w = 1 and fm_ok))::int,
         round(avg(kaupverd / einflm) filter (where w = 5 and fm_ok))::int,
         round(percentile_cont(.5) within group (order by kaupverd) filter (where w = 0))::int,
         round(100 * percentile_cont(.5) within group (order by kaupverd::numeric / fasteignamat)
                     filter (where w = 0 and eldra and fasteignamat > 0))::int,
         round(100 * avg((kaupverd > fasteignamat)::int) filter (where w = 0 and eldra and fasteignamat > 0))::int,
         (count(*) filter (where w = 0 and eldra and fasteignamat > 0))::int,
         a.a_solu, a.dagar
    from k left join a on a.sv = k.sv
   group by k.sv, a.a_solu, a.dagar;
$$;

revoke execute on function public.sumarhus_samanburdur(jsonb) from public;
grant execute on function public.sumarhus_samanburdur(jsonb) to anon, authenticated, service_role;
