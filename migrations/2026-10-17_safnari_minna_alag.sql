-- Safnarinn (n8n fastinn_listings_scraper, kl. 7–23 á :01) vistar ALLAR ~18 þús. virkar auglýsingar
-- á hverjum klukkutíma, þótt fæstar breytist. Það veldur 1–3 mín. álagsglugga þar sem köll síðunnar
-- renna út á tíma (sást kl. 10:03 17. okt.). Lausn: gagnagrunnurinn sleppir óbreyttum línum.
--
-- Vandinn: núverandi „merkja fjarlægðar“-skref (PATCH removed=true þar sem last_seen < upphaf keyrslu)
-- treystir á að last_seen sé uppfært á öllum línum. Því þarf að skipta því út FYRST (liður A + n8n),
-- og bæta gikknum við á eftir (liður B). Í öfugri röð yrðu nánast allar auglýsingar merktar fjarlægðar.

-- ============================================================
-- A. Fjarlægðar auglýsingar eftir lista af virkum auðkennum (í stað last_seen-samanburðar)
--    Öryggi: ef listinn er grunsamlega stuttur (t.d. leitin brást) er engu breytt.
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
  update fastinn_listings
     set removed = true, last_seen = now()
   where not removed and id <> all(p_virk);
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke execute on function public.merkja_fjarlaegdar(text[]) from public, anon, authenticated;
grant execute on function public.merkja_fjarlaegdar(text[]) to service_role;

-- ============================================================
-- B. (Keyrt 17. okt. kl. 12:10, eftir að n8n-hnúturinn „Merkja fjarlægðar“ kallaði á merkja_fjarlaegdar.)
--    Gikkur sem sleppir óbreyttum línum. Upsert safnarans uppfærir þá aðeins nýjar/breyttar auglýsingar.
--    last_seen er endurnýjað u.þ.b. einu sinni á sólarhring (20–28 klst., dreift eftir auðkenni svo ekki
--    komi allar í einu), sem dugar fyrir pörun við sölur (auglysing_fyrir_solu: 120 daga gluggi).
--    Nafnið byrjar á z svo hann keyri á eftir protect_first_seen (gikkir keyra í stafrófsröð).
create or replace function public.sleppa_obreyttum()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (new.heimilisfang, new.tegund, new.postnr, new.verd, new.staerd, new.myndir, new.linkur,
      new.mynd_url, new.removed, new.journey_id, new.fyrst_birt, new.haest_verd,
      new.fastnum, new.heinum, new.fastnum_sott)
     is not distinct from
     (old.heimilisfang, old.tegund, old.postnr, old.verd, old.staerd, old.myndir, old.linkur,
      old.mynd_url, old.removed, old.journey_id, old.fyrst_birt, old.haest_verd,
      old.fastnum, old.heinum, old.fastnum_sott)
     and old.last_seen > now() - interval '20 hours' - (abs(hashtext(old.id)) % 8) * interval '1 hour'
  then
    return null;   -- engin breyting: sleppa skrifum
  end if;
  return new;
end;
$$;

revoke execute on function public.sleppa_obreyttum() from public, anon, authenticated;

create trigger z_sleppa_obreyttum before update on public.fastinn_listings
  for each row execute function public.sleppa_obreyttum();

-- n8n (17. okt., gert í vafra): hnúturinn „Merkja fjarlægðar“ í fastinn_listings_scraper er nú
--   POST https://nzuwplawwnlnjnbdpmei.supabase.co/rest/v1/rpc/merkja_fjarlaegdar
--   body: {{ JSON.stringify({ p_virk: $('Sækja frá fastinn.is').all().flatMap(i => i.json.rows.map(r => r.id)) }) }}
--   (áður PATCH fastinn_listings?removed=eq.false&last_seen=lt.<upphaf keyrslu> með {"removed": true})

-- Bakka:
--   drop trigger if exists z_sleppa_obreyttum on public.fastinn_listings; drop function if exists public.sleppa_obreyttum();
--   drop function public.merkja_fjarlaegdar(text[]);   (og setja PATCH-hnútinn aftur inn í n8n)
