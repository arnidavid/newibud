-- Ársmeðaltöl vísitölu neysluverðs (grunnur maí 1988=100), notuð í raunverð á síðunni.
-- n8n-flæðið „Vísitala neysluverðs – mánaðarleg uppfærsla“ skrifar hér; manudir = fjöldi mánaða í meðaltali
-- (undir 12 á yfirstandandi ári). Áður handskráð í app.js og um 8–10 % of há, með skakkt hlutfall milli ára.
create table public.vnv_ar (
  ar       integer primary key,
  vnv      numeric(7,1) not null,
  manudir  integer not null,
  uppfaert timestamptz not null default now()
);

alter table public.vnv_ar enable row level security;
create policy "lesa vnv_ar" on public.vnv_ar for select to anon using (true);

grant select on public.vnv_ar to anon;
grant select, insert, update, delete on public.vnv_ar to service_role;

insert into public.vnv_ar (ar, vnv, manudir) values
  (2006,259.9,12),
  (2007,273.1,12),
  (2008,307.7,12),
  (2009,344.6,12),
  (2010,363.2,12),
  (2011,377.7,12),
  (2012,397.3,12),
  (2013,412.7,12),
  (2014,421.1,12),
  (2015,428.0,12),
  (2016,435.3,12),
  (2017,443.0,12),
  (2018,454.8,12),
  (2019,468.6,12),
  (2020,481.9,12),
  (2021,503.3,12),
  (2022,545.1,12),
  (2023,592.8,12),
  (2024,627.5,12),
  (2025,653.1,12),
  (2026,686.5,10);

-- Bakka: drop table public.vnv_ar;
