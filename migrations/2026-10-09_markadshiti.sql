-- ============================================================
-- Markaðshiti: samantekt á söluferlum seldra eigna
-- n8n-workflow „markadshiti“ reiknar á hverri nóttu úr söluferlum
-- (fyrst auglýst, hæsta/síðasta ásetta verð, söluverð, dagar á sölu)
-- og vistar hér. Síðan les bara þessa litlu töflu (~50 raðir).
-- ============================================================

create table public.markadshiti (
  svaedi        text        not null,   -- 'hofud' (póstnr. 100–230) eða 'skorr' (311)
  gerd          text        not null,   -- 'manudur' | 'halfar' | 'nuna' (eignir á sölu núna)
  timabil       date        not null,   -- fyrsti dagur tímabils (fyrir 'nuna': dagsetning útreiknings)
  n             integer     not null,   -- fjöldi seldra eigna (eða á sölu fyrir 'nuna')
  yfir_asettu   numeric,                -- % seldra yfir síðasta ásetta verði
  soluhlutfall  numeric,                -- miðgildi söluverðs / síðasta ásetta verðs, %
  dagar         numeric,                -- miðgildi daga frá fyrstu auglýsingu til sölu (fyrir 'nuna': daga á sölu)
  laekkad       numeric,                -- % sem lækkuðu ásett verð að minnsta kosti einu sinni
  uppfaert      timestamptz not null default now(),
  primary key (svaedi, gerd, timabil)
);

alter table public.markadshiti enable row level security;
create policy "allir lesa markadshiti" on public.markadshiti for select to anon, authenticated using (true);
-- Engin skrifregla fyrir anon/authenticated: aðeins service_role (n8n) skrifar (hún fer framhjá RLS).
revoke insert, update, delete, truncate, references, trigger on public.markadshiti from anon, authenticated;

-- Bakka:
--   drop table public.markadshiti;
