-- Eigin verðsaga auglýsinga: hver breyting á auglýsingu skráð sem atburður.
-- Áður var aðeins samantekt söluferils til (frá fastinn.is: fyrsta/hæsta/lægsta verð); einstakar
-- lækkanir og tímasetning þeirra voru hvergi geymdar hjá okkur. Sagan safnast upp héðan í frá.
--
-- Gikkurinn z_sleppa_obreyttum (2026-10-17) sleppir þegar óbreyttum línum, svo hingað berast
-- aðeins raunverulegar breytingar (áætlað 100–500 atburðir á dag).

create table public.auglysinga_saga (
  id           bigint generated always as identity primary key,
  auglysing_id text        not null,             -- fastinn_listings.id
  dags         timestamptz not null default now(),
  atburdur     text        not null check (atburdur in ('upphaf', 'ny', 'verd', 'fjarlaegd', 'aftur')),
  verd         bigint,                           -- ásett verð eftir atburðinn (kr)
  fyrra_verd   bigint,                           -- ásett verð á undan (við 'verd' og 'aftur')
  postnr       int,
  tegund       text,
  journey_id   bigint                            -- söluferill (endurbirtingar sömu eignar)
);
comment on table public.auglysinga_saga is
  'Atburðir auglýsinga: upphaf (staða 18. okt. 2026), ny, verd (breyting á ásettu verði), fjarlaegd, aftur (birt aftur). Skrifað af gikknum skra_sogu á fastinn_listings.';

create index auglysinga_saga_auglysing on public.auglysinga_saga (auglysing_id, dags);
create index auglysinga_saga_dags on public.auglysinga_saga (dags);

-- Lokuð opinbera lyklinum í bili (engin stefna fyrir anon); opnað þegar síðan á að sýna úr henni.
alter table public.auglysinga_saga enable row level security;

-- Gikkur: skráir atburði eftir hverja innsetningu/breytingu sem raunverulega fer fram
create or replace function public.skra_sogu()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into auglysinga_saga (auglysing_id, atburdur, verd, postnr, tegund, journey_id)
    values (new.id, 'ny', new.verd, new.postnr, new.tegund, new.journey_id);
    return null;
  end if;

  if old.removed and not new.removed then
    insert into auglysinga_saga (auglysing_id, atburdur, verd, fyrra_verd, postnr, tegund, journey_id)
    values (new.id, 'aftur', new.verd, old.verd, new.postnr, new.tegund, new.journey_id);
  elsif not old.removed and new.removed then
    insert into auglysinga_saga (auglysing_id, atburdur, verd, postnr, tegund, journey_id)
    values (new.id, 'fjarlaegd', new.verd, new.postnr, new.tegund, new.journey_id);
  elsif new.verd is distinct from old.verd then
    insert into auglysinga_saga (auglysing_id, atburdur, verd, fyrra_verd, postnr, tegund, journey_id)
    values (new.id, 'verd', new.verd, old.verd, new.postnr, new.tegund, new.journey_id);
  end if;
  return null;
end;
$$;

revoke execute on function public.skra_sogu() from public, anon, authenticated;

create trigger skra_sogu after insert or update on public.fastinn_listings
  for each row execute function public.skra_sogu();

-- Upphafspunktur: staða allra virkra auglýsinga í dag
insert into public.auglysinga_saga (auglysing_id, atburdur, verd, postnr, tegund, journey_id)
select id, 'upphaf', verd, postnr, tegund, journey_id
  from public.fastinn_listings
 where not removed;

-- Bakka:
--   drop trigger if exists skra_sogu on public.fastinn_listings;
--   drop function if exists public.skra_sogu();
--   drop table if exists public.auglysinga_saga;
