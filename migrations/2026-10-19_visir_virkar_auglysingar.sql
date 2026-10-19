-- merkja_fjarlaegdar rann stundum enn á tíma (19. okt. kl. 18:02) þrátt fyrir hash anti join:
-- talningin og leitin að virkum auglýsingum fletta upp ~18 þús. línum sem dreifast um alla töfluna
-- (143 þús. línur), og þegar þær eru ekki í minni tekur það allt að nokkrar sekúndur.
-- Lausn: lítill vísir með auðkennum virkra auglýsinga. Talningin og samanburðurinn lesa þá aðeins
-- vísinn (index-only scan); töfluna sjálfa þarf aðeins að snerta fyrir þær fáu sem eru merktar fjarlægðar.
--
-- (Hætt var við að setja lengri statement_timeout á fallið: tímamörkin eru reiknuð frá upphafi kallsins,
--  svo SET inni í falli hefur ekki áhrif á það. n8n reynir hvort eð er aftur ef kallið bregst.)

create index if not exists idx_listings_virkar_id on public.fastinn_listings (id) where not removed;

-- Eftir að vísirinn er til: `vacuum (analyze) public.fastinn_listings;` (keyrt sér, utan færslu)
-- svo sýnileikakort töflunnar sé uppfært og vísirinn nýtist án þess að fletta upp í töflunni.

-- Bakka:
--   drop index if exists public.idx_listings_virkar_id;
