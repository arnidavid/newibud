-- Eiginleikar sumarhúsa sem sýndir eru undir verðmatinu á eignasíðu: eignarlóð, hitaveita, lóð við vatn.
-- Ein röð á fastanúmer, aðeins eignir með a.m.k. eitt atriði, gildi úr nýjustu sölu í gagnasafni sumarhúsamats 2027.
-- Verðmatið sjálft (get_verdmat) er óbreytt. Bakprófun 1. nóv. 2026: matssvæði og eiginleikar bættu ekki
-- miðgildisskekkjuna (verkfaeri/bakprofun_sumarhus.py). Hlutfall sala undir / yfir bilinu (633 sölur):
-- við vatn 4 / 77 % (n=26), hitaveita + eignarlóð 16 / 45 %, aðeins hitaveita 20 / 33 %,
-- aðeins eignarlóð 32 / 30 %, ekkert af þessu 31 / 39 %.
-- Gögnin: migrations/2026-11-01_sumarhus_eiginleikar_gogn.sql, búin til með verkfaeri/sumarhus_eiginleikar.py

create table public.sumarhus_eiginleikar (
  fastnum   text primary key,
  eignarlod boolean not null default false,
  hitaveita boolean not null default false,
  vid_vatn  boolean not null default false,
  sala_ar   integer not null
);

alter table public.sumarhus_eiginleikar enable row level security;
create policy "lesa sumarhus_eiginleikar" on public.sumarhus_eiginleikar for select to anon using (true);

grant select on public.sumarhus_eiginleikar to anon;
grant select, insert, update, delete on public.sumarhus_eiginleikar to service_role;

-- Bakka: drop table public.sumarhus_eiginleikar;
