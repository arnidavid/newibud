-- Tímamörk og álag (8. nóv. 2026)
--
-- Athugun 7.–8. nóv.: gagnagrunnurinn er öðru hvoru margfalt hægari en venjulega (sama fyrirspurn 195 ms /
-- 1 ms, sama fall 1.700 ms / 26–39 ms, 0,5 ms á hverja gagnasíðu í minni). Það er ekki köld tenging
-- (fyrsta kall á nýrri tengingu var líka 39 ms) heldur vélin sjálf – líklega samnýttur örgjörvi á lítilli
-- vél. Á þeim tímum fara köll síðunnar yfir 3 sek. tímamörk anon → 500 og hluti síðunnar birtist ekki.
--
-- 1. anon statement_timeout 3 → 8 sek.: á hægu augnabliki hleðst síðan hægar í stað þess að hluti hennar
--    detti út. anon les aðeins (RLS, engin skrif) og öll föll síðunnar taka 20–40 ms við eðlilegar aðstæður.
--    authenticated og authenticator eru þegar á 8 sek. Tekur gildi á nýjum tengingum (PostgREST endurnýjar
--    þær sjálfkrafa innan fárra mínútna).
-- 2. mv_a_solu: endurnýjað einu sinni á sólarhring kl. 02:30 (eftir visir-safnarann 01:30–~02:00) í stað
--    hverrar klukkustundar. Gögnin breytast aðeins í næturkeyrslunni síðan fastinn hætti (3. nóv.);
--    sparar 23 × ~3,4 sek. vinnslu á dag. Cron er í UTC (Ísland = UTC).
--
-- Bakka:
--   alter role anon set statement_timeout = '3s';
--   select cron.alter_job((select jobid from cron.job where jobname = 'refresh-mv-a-solu'), schedule := '20 * * * *');

alter role anon set statement_timeout = '8s';

select cron.alter_job((select jobid from cron.job where jobname = 'refresh-mv-a-solu'), schedule := '30 2 * * *');
