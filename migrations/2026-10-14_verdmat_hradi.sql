-- ============================================================
-- Verðmat: hraðari get_verdmat (tímamörk á fyrsta kalli)
-- Vandinn: anon hefur statement_timeout = 3 s. get_verdmat sækir allar sölur
--   á 12 mán. í gegnum idx_kaupskra_dags (~13.600 raðir) og les svo hverja röð
--   úr töflunni sjálfri: ~2.300 síður á víð og dreif. Þegar þær eru ekki í
--   minni (fyrsta kall eftir hlé) tók það 3,5–5 s → villa 57014. Heitt: ~40 ms.
-- Lausn: samsettur vísir (tegund, thinglystdags) sem inniheldur alla dálka sem
--   get_verdmat notar. Þá dugar „index-only scan“: ~85 samliggjandi síður í stað
--   ~2.300 dreifðra (fjölbýli, 12 mán.). Skilyrðin í WHERE eru þau sömu og í
--   fallinu, svo vísirinn sleppir ónothæfum samningum og röðum án mats/stærðar.
-- Stærð: ~16 MB. Fallið sjálft er óbreytt.
-- ============================================================

create index if not exists idx_kaupskra_verdmat
  on public.kaupskra (tegund, thinglystdags)
  include (postnr, svfn, gata, fastnum, einflm, byggar, kaupverd,
           fasteignamat_gildandi, onothaefur_samningur)
  where onothaefur_samningur is distinct from '1'
    and fasteignamat_gildandi > 0
    and einflm > 0;

analyze public.kaupskra;

-- Bakka: drop index if exists public.idx_kaupskra_verdmat;
