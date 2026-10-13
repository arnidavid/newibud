-- ============================================================
-- Gömlu föllin sem tóku eitt póstnúmer (0 = póstnr. 100–230).
-- Leyst af hólmi með get_manadarsolur_svaedi / get_verd_staerd_aldur_svaedi
-- (2026-10-13_svaedi_postnumeralistar.sql). Síðan á VPS (ae027ff) kallar
-- ekki lengur á þau og engin önnur föll né cron-verk nota þau.
-- ============================================================

drop function public.get_manadarsolur(int, text);
drop function public.get_verd_staerd_aldur(int, text);

-- Bakka: keyra aftur fallaskilgreiningarnar í
--   2026-10-08_hradari_hofudborg.sql (get_manadarsolur, liður 2) og
--   2026-10-13_verd_staerd_aldur.sql (get_verd_staerd_aldur + grant)
