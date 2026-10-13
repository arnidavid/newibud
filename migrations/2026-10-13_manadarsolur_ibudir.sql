-- ============================================================
-- get_manadarsolur_svaedi: p_tegund = null → aðeins íbúðarhúsnæði
-- Áður taldi „Allar tegundir“ (og forsíðan) með atvinnuhúsnæði, bílskúra
-- og sumarhús (8–11 % sölna), þótt síðan segi „Íbúðarhúsnæði“/„íbúðir“.
-- Það dró fermetraverðið niður: höfuðborgarsvæðið 2026 793 → 827 þ.kr/m²,
-- Akureyri 663 → 691. Sama regla og get_verd_staerd_aldur_svaedi og
-- nýjustu sölur (IBUD_OR í app.js) nota nú þegar.
-- ============================================================

create or replace function public.get_manadarsolur_svaedi(p_postnrs int[], p_tegund text default null)
returns table (ar int, man int, n_allt bigint, n_fm bigint, sum_fm numeric, n_mat bigint, sum_mat numeric)
language sql stable security invoker as $$
  select m.ar, m.man, sum(m.n_allt)::bigint, sum(m.n_fm)::bigint, sum(m.sum_fm), sum(m.n_mat)::bigint, sum(m.sum_mat)
  from public.mv_manadarsolur m
  where m.postnr = any(p_postnrs)
    and ((p_tegund is null and m.tegund in ('Fjölbýli', 'Sérbýli', 'Einbýli')) or m.tegund = p_tegund)
  group by m.ar, m.man
  order by m.ar, m.man;
$$;

-- Bakka: get_manadarsolur_svaedi úr 2026-10-13_matshlutfall_og_hradi.sql
