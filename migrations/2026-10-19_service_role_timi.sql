-- merkja_fjarlaegdar (n8n, service_role) tók 0,4–7,3 sek. (meðaltal 1,6) og rann oft á 8 sek. mörkin
-- sem service_role erfði frá authenticator – mest strax á eftir að safnarinn hafði skrifað. Fyrirspurnin
-- sjálf er orðin hröð (vísir + anti join); breytileikinn er álag á litla gagnagrunninum.
-- service_role er aðeins notað af n8n (bakgrunnsverk), svo lengri tímamörk þar koma engum að sök.
-- anon (síðan) heldur 3 sek. Afritið heima tengist sem postgres gegnum pooler og fer ekki um PostgREST.
-- Þetta er leiðin sem Supabase mælir með til að breyta tímamörkum eftir hlutverkum.

alter role service_role set statement_timeout = '60s';
notify pgrst, 'reload config';

-- Bakka:
--   alter role service_role reset statement_timeout;
--   notify pgrst, 'reload config';
