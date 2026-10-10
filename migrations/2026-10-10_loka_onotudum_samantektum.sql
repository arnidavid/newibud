-- ============================================================
-- Loka á lestur anon/authenticated á 7 ónotaðar samantektartöflur
-- (materialized views). Síðan notar aðeins mv_manadarsolur (í gegnum
-- get_manadarsolur). Supabase-öryggisathugun benti á þetta 10. okt.
-- Næsta skref (eftir viku ef ekkert bilar): eyða töflunum, cron-jobunum
-- þeirra og ónotuðu föllunum get_sumarhus_stats / get_verdthroun_ar.
-- ============================================================

revoke select on
  public.mv_arssamanburdur,
  public.mv_verdthroun_postnr,
  public.mv_sveitarfelog,
  public.mv_nyjustu_samningar,
  public.mv_hreyfanlegt_medaltal,
  public.mv_verdthroun_manudur,
  public.mv_verddreifing
from anon, authenticated;

-- Bakka:
--   grant select on public.mv_arssamanburdur, public.mv_verdthroun_postnr,
--     public.mv_sveitarfelog, public.mv_nyjustu_samningar, public.mv_hreyfanlegt_medaltal,
--     public.mv_verdthroun_manudur, public.mv_verddreifing to anon, authenticated;
