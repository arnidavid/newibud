-- Tölurnar í textanum undir verðmati sumarhúsa (hlutfall sala undir / yfir bilinu). Síðan les þær héðan,
-- svo n8n-flæðið „Sumarhúsamat – árleg uppfærsla“ getur uppfært þær án breytinga á kóða og án deploy.
-- Ein röð á gagnasafn; síðan les nýjustu röðina. slod = skráin sem gögnin komu úr.
create table public.sumarhus_eiginleikar_tolur (
  matsar   integer primary key,
  slod     text not null,
  tolur    jsonb not null,
  uppfaert timestamptz not null default now()
);

alter table public.sumarhus_eiginleikar_tolur enable row level security;
create policy "lesa sumarhus_eiginleikar_tolur" on public.sumarhus_eiginleikar_tolur for select to anon using (true);

grant select on public.sumarhus_eiginleikar_tolur to anon;
grant select, insert, update, delete on public.sumarhus_eiginleikar_tolur to service_role;

insert into public.sumarhus_eiginleikar_tolur (matsar, slod, tolur) values (2027,
  'https://hms-web.cdn.prismic.io/hms-web/ahmSaweQX7-eWbu3_Gagnasafnfyrirsumarh%C3%BAsamat2027.xlsx',
  '{"n":633,"fra":2024,"til":2026,
    "vatn":{"n":26,"undir":4,"yfir":77},
    "baedi":{"n":184,"undir":16,"yfir":45},
    "hita":{"n":150,"undir":20,"yfir":33},
    "lod":{"n":115,"undir":32,"yfir":30},
    "ekkert":{"n":158,"undir":31,"yfir":39}}');

-- Bakka: drop table public.sumarhus_eiginleikar_tolur;
