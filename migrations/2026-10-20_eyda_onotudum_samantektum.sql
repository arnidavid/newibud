-- Eyða 7 ónotuðum samantektum (materialized views) frá fyrstu útgáfu síðunnar, næturendurnýjun þeirra
-- (pg_cron kl. 03:00–03:30) og föllum sem aðeins tengjast þeim. Sjá migrations/2026-10-10_loka_onotudum_samantektum.sql
-- (lokað fyrir opinbera lyklinum 10. okt. „ef ekkert bilar í viku, eyða“).
--
-- Athugað 20. okt. 2026 áður en þetta var keyrt:
--   - app.js, api.js, index.html og n8n-flæðin nefna ekkert af þessu
--   - engin önnur samantekt, sýn eða fall byggir á þeim (pg_depend)
--   - enginn kallaði á neitt af þessu um vefþjónustuna síðasta sólarhring (edge_logs)
-- Í notkun og haldast: mv_manadarsolur, mv_nybyggingar, mv_a_solu (og cron-jobin þeirra).
-- Endurheimt ef þarf: næturafritið (pve → Google Drive) frá 20. okt. inniheldur skilgreiningarnar.

-- 1. Næturendurnýjun (cron) fyrir samantektirnar sjö
select cron.unschedule(jobname) from cron.job where jobname in (
  'refresh-mv-arssamanburdur', 'refresh-mv-hreyfanlegt-medaltal', 'refresh-mv-nyjustu-samningar',
  'refresh-mv-sveitarfelog', 'refresh-mv-verddreifing', 'refresh-mv-verdthroun-manudur', 'refresh-mv-verdthroun-postnr');

-- 2. Föll sem tengjast aðeins þeim eða eru ónotuð
drop function if exists public.refresh_kaupskra_views();          -- endurnýjaði aðeins samantektirnar sjö
drop function if exists public.get_sumarhus_stats(integer);       -- ónotað (las beint úr kaupskra)
drop function if exists public.get_verdthroun_ar(integer, text);  -- ónotað (las beint úr kaupskra)

-- 3. Samantektirnar sjö
drop materialized view if exists public.mv_arssamanburdur;
drop materialized view if exists public.mv_hreyfanlegt_medaltal;
drop materialized view if exists public.mv_nyjustu_samningar;
drop materialized view if exists public.mv_sveitarfelog;
drop materialized view if exists public.mv_verddreifing;
drop materialized view if exists public.mv_verdthroun_manudur;
drop materialized view if exists public.mv_verdthroun_postnr;

-- 4. Greiningarfallið check_cloud_status athugar nú samantektirnar sem eru í notkun
--    (sama skilgreining og áður að öðru leyti; create or replace heldur heimildum: postgres, service_role)
create or replace function public.check_cloud_status()
 returns table(athugun text, gildi text)
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_count bigint;
  v_latest date;
  v_views_ok int := 0;
  v_total_views int := 3;
  v_view_name text;
  v_exists boolean;
begin
  -- 1. Raðafjöldi
  select count(*) into v_count from kaupskra;
  athugun := 'Raðafjöldi'; gildi := v_count::text; return next;

  -- 2. Nýjasta þinglýsingardagsetning
  select max(thinglystdags)::date into v_latest from kaupskra;
  athugun := 'Nýjasta sala'; gildi := coalesce(v_latest::text, 'engin gögn'); return next;

  -- 3. Sölur 2025
  select count(*) into v_count from kaupskra
  where thinglystdags >= '2025-01-01' and thinglystdags < '2026-01-01';
  athugun := 'Sölur 2025'; gildi := v_count::text; return next;

  -- 4. Sölur 2026
  select count(*) into v_count from kaupskra
  where thinglystdags >= '2026-01-01';
  athugun := 'Sölur 2026'; gildi := v_count::text; return next;

  -- 5. Sumarhús á 311
  select count(*) into v_count from kaupskra
  where postnr = 311 and tegund = 'Sumarhús';
  athugun := 'Sumarhús á 311'; gildi := v_count::text; return next;

  -- 6. Samantektir í notkun (20. okt. 2026)
  foreach v_view_name in array array['mv_manadarsolur', 'mv_nybyggingar', 'mv_a_solu'] loop
    select exists (
      select 1 from pg_matviews where matviewname = v_view_name and schemaname = 'public'
    ) into v_exists;
    if v_exists then v_views_ok := v_views_ok + 1; end if;
  end loop;
  athugun := 'MV views'; gildi := v_views_ok::text || '/' || v_total_views::text; return next;

  -- 7. Síðasta uppfærsla (nýjasta created_at)
  select max(created_at)::text into gildi from kaupskra;
  athugun := 'Síðasta uppfærsla (created_at)'; return next;
end;
$function$;
