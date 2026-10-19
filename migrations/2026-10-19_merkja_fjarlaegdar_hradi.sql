-- merkja_fjarlaegdar tók ~6 sek. (tímamörk n8n/service_role: 8 sek.) og rann á tíma 19. okt. kl. 16:03.
-- Ástæða: `id <> all(p_virk)` ber hverja af ~18 þús. virkum auglýsingum saman við allan ~18 þús. lista
-- keyrslunnar (~330 milljón samanburðir). Lausn: listinn fer í hakkatöflu (hash anti join), ~20 ms.
-- Sama hegðun og áður, líka öryggið gegn of stuttum lista.

create or replace function public.merkja_fjarlaegdar(p_virk text[])
returns int
language plpgsql
set search_path = public
as $$
declare
  n_virk int;
  n int;
begin
  select count(*) into n_virk from fastinn_listings where not removed;
  if coalesce(cardinality(p_virk), 0) < n_virk * 0.8 then
    raise exception 'merkja_fjarlaegdar: aðeins % virkar auglýsingar í keyrslu en % í töflu – engu breytt',
      coalesce(cardinality(p_virk), 0), n_virk;
  end if;
  update fastinn_listings l
     set removed = true, last_seen = now()
   where not l.removed
     and not exists (select 1 from unnest(p_virk) v(id) where v.id = l.id);
  get diagnostics n = row_count;
  return n;
end;
$$;

-- (Heimildir haldast: create or replace breytir ekki grant/revoke frá 2026-10-17.)
