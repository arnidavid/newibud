-- Markaðshiti: nuna / nuna_ny / nuna_eldra fá nýja röð á hverri nóttu (timabil = current_date) og
-- taflan stækkaði því endalaust (541 röð 23. nóv. 2026, ~10–15 nýjar á dag). Vefurinn notar aðeins
-- nýjustu nuna-röð hvers svæðis. Hér er geymd síðasta vikan + fyrsta röð hvers mánaðar (saga),
-- og nýjasta röð hvers svæðis/gerðar er aldrei eytt (nuna_ny/nuna_eldra geta staðið í stað).
-- Vefurinn sækir nú töfluna með fetchAll (app.js), svo þetta er tiltekt, ekki forsenda.

create or replace function public.uppfaera_markadshiti(p_fra date default '2026-11-01')
returns integer
language plpgsql
set search_path = public
as $function$
declare fjoldi integer;
begin
  insert into markadshiti as t (svaedi, gerd, timabil, n, yfir_asettu, soluhlutfall, dagar, laekkad, uppfaert)
  select r.svaedi, r.gerd, r.timabil, r.n, r.yfir_asettu, r.soluhlutfall, r.dagar, r.laekkad, now()
  from markadshiti_utreikningur(p_fra) r
  on conflict (svaedi, gerd, timabil) do update set
    n            = excluded.n,
    yfir_asettu  = excluded.yfir_asettu,
    soluhlutfall = excluded.soluhlutfall,
    dagar        = case when t.gerd = 'halfar' then coalesce(excluded.dagar, t.dagar) else excluded.dagar end,
    laekkad      = case when t.gerd = 'halfar' then coalesce(excluded.laekkad, t.laekkad) else excluded.laekkad end,
    uppfaert     = excluded.uppfaert;
  get diagnostics fjoldi = row_count;

  -- Tiltekt: eldri nuna-raðir (sjá efst)
  delete from markadshiti m
   where m.gerd in ('nuna', 'nuna_ny', 'nuna_eldra')
     and m.timabil < current_date - 7
     and m.timabil > (select min(x.timabil) from markadshiti x
                       where x.svaedi = m.svaedi and x.gerd = m.gerd
                         and date_trunc('month', x.timabil) = date_trunc('month', m.timabil))
     and exists (select 1 from markadshiti x
                  where x.svaedi = m.svaedi and x.gerd = m.gerd and x.timabil > m.timabil);

  return fjoldi;
end $function$;
