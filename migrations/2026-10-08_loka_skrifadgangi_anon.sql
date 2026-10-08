-- ============================================================
-- Loka skrifaðgangi opinbera (anon) lykilsins
-- Forsenda: n8n notar service_role lykil (ekki anon) áður en þetta er keyrt.
-- Síðan sjálf les bara (GET + get_sumarhus_stats/get_verdthroun_ar) og
-- verður ekki fyrir áhrifum.
-- ============================================================

begin;

-- 1. Kveikja á RLS á fastinn_listings.
--    Reglurnar eru þegar til: "public read" (anon/authenticated) og
--    "service role write". Án RLS gátu allir breytt/eytt öllum röðum.
alter table public.fastinn_listings enable row level security;

-- 2. anon/authenticated mega bara lesa töflur – aldrei skrifa.
revoke insert, update, delete, truncate, references, trigger
  on all tables in schema public from anon, authenticated;

-- Sama fyrir töflur sem verða búnar til síðar.
alter default privileges in schema public
  revoke insert, update, delete, truncate, references, trigger
  on tables from anon, authenticated;

-- 3. SECURITY DEFINER föll sem eiga ekki að vera opin almenningi.
--    (EXECUTE er sjálfgefið veitt PUBLIC, svo það þarf að taka af PUBLIC líka.)
revoke execute on function public.upsert_kaupskra(jsonb)        from public, anon, authenticated;
revoke execute on function public.refresh_kaupskra_views()      from public, anon, authenticated;
revoke execute on function public.refresh_single_view(text)     from public, anon, authenticated;
revoke execute on function public.check_cloud_status()          from public, anon, authenticated;
revoke execute on function public.keep_first_seen()             from public, anon, authenticated;
revoke execute on function public.rls_auto_enable()             from public, anon, authenticated;

-- n8n (service_role) þarf áfram að geta sett inn kaupsamninga.
grant execute on function public.upsert_kaupskra(jsonb) to service_role;

commit;
