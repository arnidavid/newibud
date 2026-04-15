-- ============================================================
-- migrations/match_listings_kaupskra.sql
-- Auglýst vs. selt — tengir fastinn_listings við kaupskra
--
-- Keyra í Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- Þetta er VALFRJÁLST — JS-side matching virkar án þessa.
--
-- Háð: pg_trgm extension (venjulega til staðar í Supabase)
-- ============================================================

-- 0. Kveikja pg_trgm ef þörf krefur (Supabase: venjulega þegar virkt)
-- CREATE EXTENSION IF NOT EXISTS pg_trgm;
-- CREATE EXTENSION IF NOT EXISTS unaccent;


-- 1. normalize_addr — strippan á þekkt staðarviðbætur + lowercase + trim
CREATE OR REPLACE FUNCTION normalize_addr(addr TEXT)
RETURNS TEXT
LANGUAGE SQL IMMUTABLE STRICT
AS $$
  SELECT lower(trim(
    regexp_replace(
      regexp_replace(
        addr,
        -- Strip aftari viðbætur eins og "skorradal", "borgarbyggð", "hreppur"
        '\s+(borgarbygg[ðd]?|skorradal|svaedid|svæðið|hreppur|dalsvegur|reykjavik|kópavogi?r?)\s*.*$',
        '',
        'gi'
      ),
      '\s{2,}', ' ', 'g'  -- collapse multiple spaces
    )
  ))
$$;


-- 2. addr_key — dregur út "gata númer" hlutann (t.d. "fitjahlíð 66")
--    Þetta er lykilinn sem við joinum á.
CREATE OR REPLACE FUNCTION addr_key(addr TEXT)
RETURNS TEXT
LANGUAGE SQL IMMUTABLE STRICT
AS $$
  SELECT COALESCE(
    (regexp_match(
      normalize_addr(addr),
      '^(.+?\s+\d+[a-záðéíóúýþæöa-z]?)\b'
    ))[1],
    normalize_addr(addr)
  )
$$;


-- 3. avs_match VIEW — sameinuð auglýsinga- og sölugögn
--    Joinað á addr_key(heimilisfang) + postnr
CREATE OR REPLACE VIEW avs_match AS
SELECT
  fl.id                                                         AS listing_id,
  fl.heimilisfang                                               AS auglyst_heimilisfang,
  k.heimilisfang                                                AS selt_heimilisfang,
  fl.verd                                                       AS auglyst_verd_isk,
  round(fl.verd / 1000.0)                                       AS auglyst_verd_thkr,
  k.kaupverd                                                    AS selt_verd_thkr,
  k.kaupverd * 1000                                             AS selt_verd_isk,

  -- Munur: % mismunur (neikvætt = selt undir auglýstu verði = hagstætt fyrir kaupanda)
  round(((k.kaupverd * 1000.0 / fl.verd) - 1) * 100, 1)        AS munur_pct,
  (k.kaupverd * 1000) - fl.verd                                 AS munur_isk,

  -- Dagar á markaði: einungis þegar first_seen er á undan söludegi
  CASE
    WHEN fl.first_seen::date <= k.thinglystdags::date
    THEN (k.thinglystdags::date - fl.first_seen::date)
    ELSE NULL
  END                                                           AS dagar_a_markadi,

  k.thinglystdags,
  k.einflm,
  round(k.kaupverd::numeric / nullif(k.einflm, 0), 0)          AS selt_fm_thkr,
  fl.first_seen,
  fl.last_seen,
  fl.linkur,
  fl.mynd_url,
  fl.staerd,
  fl.postnr,
  fl.tegund,
  fl.removed

FROM fastinn_listings fl
JOIN kaupskra k
  ON addr_key(fl.heimilisfang) = addr_key(k.heimilisfang)
 AND fl.postnr::int = k.postnr

WHERE k.onothaefur_samningur != '1'
  AND k.einflm > 10
  AND k.kaupverd / k.einflm BETWEEN 10 AND 2000
  AND k.thinglystdags >= (NOW() - INTERVAL '24 months')

ORDER BY k.thinglystdags DESC;


-- 4. get_avs_stats RPC — aggregate tölfræði síðustu 12 mánuði
--    Nota via: API.rpc('get_avs_stats', { p_postnr: 311, p_tegund: 'sumarhus' })
CREATE OR REPLACE FUNCTION get_avs_stats(p_postnr int, p_tegund text)
RETURNS TABLE (
  avg_munur_pct       numeric,
  avg_dagar_a_markadi numeric,
  pct_undir_auglyst   numeric,
  fjoldi_para         int
)
LANGUAGE SQL
SECURITY DEFINER
AS $$
  SELECT
    round(avg(munur_pct), 1)                                          AS avg_munur_pct,
    round(avg(dagar_a_markadi))                                       AS avg_dagar_a_markadi,
    round(
      count(*) FILTER (WHERE munur_pct < 0) * 100.0 / NULLIF(count(*), 0),
      1
    )                                                                 AS pct_undir_auglyst,
    count(*)::int                                                     AS fjoldi_para
  FROM avs_match
  WHERE postnr = p_postnr
    AND tegund = p_tegund
    AND thinglystdags >= NOW() - INTERVAL '12 months'
$$;


-- 5. Grant read access to anon role
GRANT SELECT ON avs_match TO anon;
GRANT EXECUTE ON FUNCTION get_avs_stats(int, text) TO anon;
GRANT EXECUTE ON FUNCTION addr_key(text) TO anon;
GRANT EXECUTE ON FUNCTION normalize_addr(text) TO anon;


-- ============================================================
-- Til að nota í JavaScript:
--
--   // Sjá allar pörur:
--   API.fetchAll('avs_match', { postnr: 'eq.311', tegund: 'eq.sumarhus' })
--
--   // Aggregate stats:
--   API.rpc('get_avs_stats', { p_postnr: 311, p_tegund: 'sumarhus' })
--
-- Munurinn á JS-side vs SQL:
--   - SQL view: server-side matching, hraðari, krefst þess að DDL sé keyrt
--   - JS-side:  virkar strax, sveigjanlegra, fetchar bæði dataset
-- ============================================================
