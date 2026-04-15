// ============================================================
// api.js — ibud v2 API module (Supabase Cloud)
// Centralized Supabase/PostgREST fetch with Bearer auth, pagination, error handling
// ============================================================

const API = (() => {
  const BASE_URL = 'https://nzuwplawwnlnjnbdpmei.supabase.co/rest/v1';
  const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im56dXdwbGF3d25sbmpuYmRwbWVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3OTIzNTgsImV4cCI6MjA5MDM2ODM1OH0.YK2lWlZQQB0jO-U6GhzME5YoiIsA1B-H7hRNx-yd56E';
  const DEFAULT_PAGE_SIZE = 500;

  // ---- Core fetch ----
  async function query(endpoint, params = {}, options = {}) {
    const url = new URL(`${BASE_URL}/${endpoint}`);

    // Add params
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    // Pagination defaults
    if (options.paginate !== false && !params['limit']) {
      const offset = options.offset || 0;
      const limit = options.limit || DEFAULT_PAGE_SIZE;
      url.searchParams.set('limit', limit);
      url.searchParams.set('offset', offset);
    }

    // Ordering
    if (options.order && !params['order']) {
      url.searchParams.set('order', options.order);
    }

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'apikey': ANON_KEY,
          'Authorization': 'Bearer ' + ANON_KEY
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      return { data, error: null };
    } catch (err) {
      console.error(`[API] ${endpoint} failed:`, err.message);
      return { data: null, error: err.message };
    }
  }

  // ---- RPC (POST) ----
  async function rpc(functionName, body = {}) {
    const url = new URL(`${BASE_URL}/rpc/${functionName}`);

    try {
      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'apikey': ANON_KEY,
          'Authorization': 'Bearer ' + ANON_KEY
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`RPC ${functionName} ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      return { data, error: null };
    } catch (err) {
      console.error(`[API] RPC ${functionName} failed:`, err.message);
      return { data: null, error: err.message };
    }
  }

  // ---- Paginated fetch (auto-fetches all pages) ----
  async function fetchAll(endpoint, params = {}, options = {}) {
    const pageSize = options.pageSize || DEFAULT_PAGE_SIZE;
    let offset = 0;
    let allData = [];
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await query(endpoint, params, {
        ...options,
        limit: pageSize,
        offset: offset,
        paginate: true
      });

      if (error || !data) {
        return { data: allData, error, partial: allData.length > 0 };
      }

      allData = allData.concat(data);

      if (data.length < pageSize) {
        hasMore = false;
      } else {
        offset += pageSize;
      }

      // Safety valve — max 50 pages (25,000 rows at 500/page)
      if (offset > pageSize * 50) {
        console.warn(`[API] fetchAll: hit safety limit at ${allData.length} rows`);
        hasMore = false;
      }
    }

    return { data: allData, error: null };
  }

  // ---- Convenience methods for ibud v2 views ----

  /** Verðþróun sumarhúsa eftir póstnúmeri (materialized view) */
  function getVerdthounPostnr(postnr) {
    return fetchAll('mv_verdthroun_postnr', {
      postnr: `eq.${postnr}`,
      order: 'manudur.asc'
    });
  }

  /** YoY árssamanburður */
  function getArssamanburdur(postnr, tegund = 'Sumarhús') {
    return fetchAll('mv_arssamanburdur', {
      postnr: `eq.${postnr}`,
      tegund: `eq.${tegund}`,
      order: 'ar.asc'
    });
  }

  /** 12 mánaða hreyfanlegt meðaltal */
  function getHreyfanlegtMedaltal(postnr, tegund = 'Sumarhús') {
    return fetchAll('mv_hreyfanlegt_medaltal', {
      postnr: `eq.${postnr}`,
      tegund: `eq.${tegund}`,
      order: 'manudur.asc'
    });
  }

  /** Sumarhúsa stats — aggregate eftir sveitarfélagi (RPC) */
  function getSumarhusStats(postnr) {
    return rpc('get_sumarhus_stats', { p_postnr: postnr });
  }

  /** Árleg verðþróun (RPC) */
  function getVerdthounAr(postnr, tegund = 'Sumarhús') {
    return rpc('get_verdthroun_ar', { p_postnr: postnr, p_tegund: tegund });
  }

  /** Raw kaupskra query — with JS-side filtering support */
  async function getKaupskra(params = {}, jsFilter = null) {
    const { data, error } = await fetchAll('kaupskra', params);
    if (error || !data) return { data, error };

    if (jsFilter) {
      return { data: data.filter(jsFilter), error: null };
    }
    return { data, error: null };
  }

  /** Nýjustu sölur — sækir nýjustu þinglýstu sölur úr kaupskra */
  function getNyjustuSolur(postnr, limit = 10) {
    return query('kaupskra', {
      postnr: `eq.${postnr}`,
      tegund: 'eq.Sumarhús',
      kaupverd: 'gt.500',
      einflm: 'gt.10',
      onothaefur_samningur: 'neq.1',
      order: 'thinglystdags.desc',
      limit: limit
    }, { paginate: false });
  }

  /** Sækir fastinn_listings úr Supabase (n8n scraper) */
  function getListingsDb(postnr, tegund) {
    const params = { postnr: `eq.${postnr}` };
    if (tegund) params.tegund = `eq.${tegund}`;
    // Fetcha bæði active og removed=true (til að geta matchað við kaupskra)
    return fetchAll('fastinn_listings', params, { order: 'last_seen.desc' });
  }

  /** Sækir fastinn.is listings úr Google Sheets (gviz API) */
  async function getSheetListings(postnr) {
    const SHEET_ID = '1ZHwaiL6InsBq4mCmraHPvTU27A1pvb4G9T93uOsfBv4';
    const gvizUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&tq=` +
      encodeURIComponent(`SELECT * WHERE F=${postnr}`);

    try {
      const response = await fetch(gvizUrl);
      const text = await response.text();
      // gviz wraps response in google.visualization.Query.setResponse(...)
      const jsonStr = text.match(/google\.visualization\.Query\.setResponse\((.+)\)/)?.[1];
      if (!jsonStr) throw new Error('Could not parse gviz response');

      const gviz = JSON.parse(jsonStr);
      const cols = gviz.table.cols.map(c => c.label);
      const rows = gviz.table.rows.map(row => {
        const obj = {};
        row.c.forEach((cell, i) => {
          obj[cols[i] || `col${i}`] = cell?.v ?? cell?.f ?? '';
        });
        return obj;
      });

      return { data: rows, error: null };
    } catch (err) {
      console.error('[API] Google Sheets fetch failed:', err.message);
      return { data: [], error: err.message };
    }
  }

  // ---- Public API ----
  return {
    // Core
    query,
    rpc,
    fetchAll,
    // v2 views
    getVerdthounPostnr,
    getArssamanburdur,
    getHreyfanlegtMedaltal,
    getSumarhusStats,
    getVerdthounAr,
    // fastinn_listings DB
    getListingsDb,
    // Nýjustu sölur
    getNyjustuSolur,
    getSheetListings,
    // Raw
    getKaupskra,
    // Constants
    BASE_URL,
    DEFAULT_PAGE_SIZE
  };
})();
