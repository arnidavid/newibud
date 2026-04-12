// ============================================================
// app.js — ibud v2  (Sumarhúsasvæði + Höfuðborgarsvæði)
// ============================================================

// ---- Shared constants ----
const CHART_GRID = 'rgba(0,0,0,.04)';
const CHART_TICK = 'rgba(0,0,0,.35)';
const CHART_TT   = { backgroundColor:'#fff', titleColor:'#1a1a18', bodyColor:'#5c5a54', borderColor:'rgba(0,0,0,.08)', borderWidth:1 };

// VNV ársmeðaltöl (grunnur maí 1988=100), uppfært jan 2026 frá Hagstofu
const VNV = {2006:281.4,2007:295.8,2008:332.4,2009:372.2,2010:392.7,2011:408.3,2012:429.5,2013:446.0,2014:457.2,2015:464.8,2016:474.5,2017:482.8,2018:496.0,2019:511.8,2020:525.5,2021:547.7,2022:592.0,2023:647.2,2024:690.3,2025:720.0,2026:740.0};
const VNV_BASE = 2024;

// ---- Shared helpers ----
function fISK(v) { return Number(v).toLocaleString('is-IS') + ' kr.'; }

function toReal(thkr, year) {
  const v = VNV[year], b = VNV[VNV_BASE];
  if (!v || !b) return thkr;
  return Math.round(thkr * b / v);
}

function addrKey(addr) {
  if (!addr) return '';
  const m = addr.match(/^(.+?\s+\d+[a-záðéíóúýþæö]?)\b/i);
  return m ? m[1].toLowerCase().trim() : addr.toLowerCase().trim();
}

function parseSheetPrice(priceStr) {
  if (!priceStr || priceStr === 'Tilboð') return 0;
  return parseInt(String(priceStr).replace(/[.\s]/g, '').replace(/kr\.?/, ''), 10) || 0;
}

function parseSheetSize(sizeStr) {
  if (!sizeStr) return 0;
  return parseFloat(String(sizeStr).replace(/fm|m2/gi, '').replace(',', '.').trim()) || 0;
}

function scoreListingVsAvg(listing, avg) {
  if (!listing.fm_thkr || !avg) return { s: 'ok', l: 'Sanngjarnt', t: 'Ekki nóg gögn til samanburðar.' };
  const r = listing.fm_thkr / avg;
  if (r < .85)  return { s: 'good', l: 'Gott tækifæri', t: `Fm.verð ${listing.fm_thkr} þ.kr/m² er ${Math.round((1 - r) * 100)}% undir meðaltali (${avg} þ.kr/m²). Hagstætt.` };
  if (r < 1.15) return { s: 'ok',   l: 'Sanngjarnt',   t: `Fm.verð ${listing.fm_thkr} þ.kr/m² er nálægt meðaltali (${avg} þ.kr/m²).` };
  return         { s: 'high', l: 'Hátt verð',    t: `Fm.verð ${listing.fm_thkr} þ.kr/m² er ${Math.round((r - 1) * 100)}% yfir meðaltali (${avg} þ.kr/m²). Dýrt.` };
}

function hist(rows, addr, sqm) {
  const b = addr.replace(/\s+\d+.*$/, '');
  return rows
    .filter(r => r.heimilisfang.startsWith(b) && Math.abs(Number(r.einflm) - sqm) < 20 && r.einflm > 0)
    .map(r => ({
      a: r.heimilisfang,
      d: new Date(r.thinglystdags).toLocaleDateString('is-IS'),
      d_raw: new Date(r.thinglystdags),
      v: Number(r.kaupverd),
      f: Math.round(r.kaupverd / r.einflm),
    }))
    .sort((a, b) => b.d_raw - a.d_raw)
    .slice(0, 4);
}

function lastSaleOnStreet(rows, addr) {
  const b = addr.replace(/\s+\d+.*$/, '');
  const matches = rows
    .filter(r => r.heimilisfang.startsWith(b) && r.einflm > 0 && r.kaupverd > 500)
    .map(r => new Date(r.thinglystdags))
    .sort((a, b) => b - a);
  return matches.length ? matches[0] : null;
}

function getMatInfo(rows, addr, sqm) {
  const b = addr.replace(/\s+\d+.*$/, '');
  const matches = rows
    .filter(r => r.heimilisfang.startsWith(b) && Math.abs(Number(r.einflm) - sqm) < 20 && (r.fasteignamat_gildandi || r.fasteignamat) > 0)
    .sort((a, b) => new Date(b.thinglystdags) - new Date(a.thinglystdags));
  if (!matches.length) return null;
  const m = matches[0];
  return { mat: Number(m.fasteignamat_gildandi || m.fasteignamat), addr: m.heimilisfang };
}

// Shared listing card HTML renderer
function renderListingCard(l, i, hist, mi, matRatioEnabled) {
  const sc = l._s;
  const tC = sc.s === 'good' ? 'tg-g' : sc.s === 'high' ? 'tg-h' : 'tg-o';
  const sC = 's' + sc.s[0], vC = 'v' + sc.s[0];

  const dagsInfo = [];
  if (l.dags) dagsInfo.push(`Skráð á fastinn.is: ${l.dags}`);
  if (l._lastSale) dagsInfo.push(`Síðasta sala á götu: ${l._lastSale.toLocaleDateString('is-IS')}`);
  const dagsH = dagsInfo.length
    ? `<div style="font-size:.72rem;color:var(--tx3);margin-bottom:.75rem;display:flex;gap:1.25rem;flex-wrap:wrap">${dagsInfo.map(d => `<span>${d}</span>`).join('')}</div>`
    : '';

  const hH = hist.length
    ? `<div class="lc-hi"><div class="ht">Þinglýstar sölur — sama gata</div>${hist.map(x => `<div class="hr"><span>${x.a} · ${x.d}</span><span>${(x.v / 1000).toFixed(1)}M · ${x.f} þ.kr/m²</span></div>`).join('')}</div>`
    : '';

  let matH = '';
  if (matRatioEnabled && mi && mi.mat > 0 && l.verd_kr > 0) {
    const ratio = Math.round(l.verd_kr / mi.mat / 10);
    const arrow = ratio > 100
      ? `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;color:var(--dng)"><path d="M8 3v10M3 8l5-5 5 5"/></svg>`
      : `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;color:var(--acc)"><path d="M8 13V3M3 8l5 5 5-5"/></svg>`;
    const matTxt = ratio > 100
      ? `Ásett verð er <strong>${ratio}%</strong> af fasteignamati (${(mi.mat / 1000).toFixed(1)}M) — yfir mati`
      : `Ásett verð er <strong>${ratio}%</strong> af fasteignamati (${(mi.mat / 1000).toFixed(1)}M) — undir mati`;
    matH = `<div style="font-size:.75rem;color:var(--tx2);margin-top:.5rem;padding:.5rem .75rem;background:var(--bg-alt);border-radius:8px;display:flex;align-items:center;gap:6px">${arrow}${matTxt}</div>`;
  }

  return `<div class="lc" data-sc="${sc.s}" style="animation-delay:${i * 60}ms">
    <div class="lc-t">
      <div class="lc-s ${sC}"></div>
      <div class="lc-b">
        <div class="lc-h"><span class="lc-n">${l.heimilisfang}</span><span class="tg ${tC}">${sc.l}</span></div>
        ${dagsH}
        <div class="lc-sts">
          <div><div class="sl2">Verð</div><div class="sv2">${l.verd_kr > 0 ? fISK(l.verd_kr) : 'Tilboð'}</div></div>
          <div><div class="sl2">Stærð</div><div class="sv2">${l.staerd} m²</div></div>
          <div><div class="sl2">Fm.verð</div><div class="sv2">${l.fm_thkr > 0 ? l.fm_thkr + ' þ.kr/m²' : '–'}</div></div>
        </div>
        ${hH}${matH}
        <div class="lc-v ${vC}">${sc.t}</div>
      </div>
    </div>
    <div class="lc-a"><a class="vb" href="${l.linkur}" target="_blank" rel="noopener">Fastinn.is<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h7v7"/><path d="M13 3L6 10"/></svg></a></div>
  </div>`;
}

// ============================================================
// ====  SUMARHÚSASVÆÐI  ======================================
// ============================================================

const POSTNR = 311;
const HVERFI = ['Fitjahlíð','Dagverðarnes','Vatnsendahlíð','Indriðastaðir','Refsholt',
  'Jötnagarðsás','Háahlíð','Mýrarholt','Þverásbyggð','Stóraborg','Fauskás','Skálalækjarás','Lækjarás'];
const HVERFI_LIT = {
  'Dagverðarnes':  { line: '#6b4c9a', bg: 'rgba(107,76,154,.06)', bar: 'rgba(107,76,154,.5)' },
  'Fitjahlíð':     { line: '#2d6a4f', bg: 'rgba(45,106,79,.06)',   bar: 'rgba(45,106,79,.5)' },
  'Vatnsendahlíð': { line: '#3a7ca5', bg: 'rgba(58,124,165,.06)',  bar: 'rgba(58,124,165,.5)' }
};

function hvS(addr) {
  if (!addr) return null;
  for (const h of HVERFI) if (addr.startsWith(h)) return h;
  return null;
}

function bldStats(rows) {
  const s = {};
  for (const r of rows) {
    const h = hvS(r.heimilisfang);
    if (!h) continue;
    const y = new Date(r.thinglystdags).getFullYear();
    const fm = r.einflm > 0 ? Math.round(r.kaupverd / r.einflm) : null;
    if (!fm || fm > 2000 || fm < 10) continue;
    if (!s[h]) s[h] = {};
    if (!s[h][y]) s[h][y] = { fs: [], c: 0 };
    s[h][y].fs.push(fm);
    s[h][y].c++;
  }
  return s;
}

function recAvg(rows) {
  const a = {};
  for (const h of HVERFI) {
    const rc = rows.filter(r => {
      const y = new Date(r.thinglystdags).getFullYear();
      return y >= 2022 && hvS(r.heimilisfang) === h && r.einflm > 0 && r.kaupverd / r.einflm < 2000 && r.kaupverd / r.einflm > 10;
    });
    if (rc.length) a[h] = Math.round(rc.reduce((s, r) => s + r.kaupverd / r.einflm, 0) / rc.length);
  }
  const al = rows.filter(r => {
    const y = new Date(r.thinglystdags).getFullYear();
    return y >= 2022 && r.einflm > 0 && r.kaupverd / r.einflm < 2000;
  });
  a._d = al.length ? Math.round(al.reduce((s, r) => s + r.kaupverd / r.einflm, 0) / al.length) : 400;
  return a;
}

async function fetchFastinnSumar(postnr) {
  try {
    const r = await fetch('https://chmqzsxu3l-dsn.algolia.net/1/indexes/*/queries?x-algolia-application-id=CHMQZSXU3L&x-algolia-api-key=9bfe0ddf26fdff0dd90dcdfc0e955eb7', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests: [{ indexName: 'listing_index', query: '', filters: 'type:sumarhus', hitsPerPage: 200, page: 0 }] })
    });
    const d = await r.json();
    const hits = d.results?.[0]?.hits || [];
    const seen = new Set();
    return hits
      .filter(h => h.removed === false && Number(h.zip) === postnr)
      .filter(h => { const k = h.address || h.street_name; if (seen.has(k)) return false; seen.add(k); return true; })
      .map(h => {
        const sqm = h.sqm || h.size || 0, price = h.price || 0;
        return {
          heimilisfang: h.address || h.street_name || '?',
          verd_kr: price,
          staerd: sqm,
          fm_thkr: sqm > 0 && price > 0 ? Math.round(price / sqm / 1000) : 0,
          linkur: `https://fastinn.is/soluskra/${h.mblAssetId || h.objectID}`,
          dags: h.dateadded ? new Date(h.dateadded).toLocaleDateString('is-IS') : '',
          dags_raw: h.dateadded ? new Date(h.dateadded) : null
        };
      });
  } catch (e) { console.error('Fastinn.is (sumar) error:', e); return []; }
}

function buildChartsSumar(hs, rows) {
  const yrs = [];
  for (let y = 2008; y <= 2026; y++) yrs.push(y);
  const av = (h, y) => { const d = hs[h]?.[y]; return d ? Math.round(d.fs.reduce((a, b) => a + b, 0) / d.fs.length) : null; };
  const cn = (h, y) => hs[h]?.[y]?.c || 0;

  new Chart(document.getElementById('c1'), {
    type: 'line',
    data: { labels: yrs.map(String), datasets: Object.entries(HVERFI_LIT).map(([h, c]) => ({ label: h, data: yrs.map(y => av(h, y)), borderColor: c.line, backgroundColor: c.bg, borderWidth: 2.5, tension: .35, pointRadius: 2, pointHoverRadius: 6, spanGaps: true })) },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { ...CHART_TT, callbacks: { label: c => c.dataset.label + ': ' + Math.round(c.parsed.y) + ' þ.kr/m²' } } }, scales: { x: { grid: { display: false }, ticks: { color: CHART_TICK, font: { size: 11 }, maxRotation: 45 } }, y: { grid: { color: CHART_GRID }, ticks: { color: CHART_TICK, font: { size: 11 }, callback: v => Math.round(v) }, beginAtZero: true } } }
  });

  new Chart(document.getElementById('c2'), {
    type: 'bar',
    data: { labels: yrs.map(String), datasets: Object.entries(HVERFI_LIT).map(([h, c]) => ({ label: h, data: yrs.map(y => cn(h, y) || null), backgroundColor: c.bar, borderRadius: 4, barPercentage: .7 })) },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: CHART_TT }, scales: { x: { grid: { display: false }, ticks: { color: CHART_TICK, font: { size: 11 }, maxRotation: 45 } }, y: { grid: { color: CHART_GRID }, ticks: { color: CHART_TICK, font: { size: 11 }, stepSize: 5 }, beginAtZero: true } } }
  });

  const realAv = (h, y) => { const v = av(h, y); return v ? toReal(v, y) : null; };
  new Chart(document.getElementById('c3'), {
    type: 'line',
    data: { labels: yrs.map(String), datasets: Object.entries(HVERFI_LIT).map(([h, c]) => ({ label: h + ' (raunverð)', data: yrs.map(y => realAv(h, y)), borderColor: c.line, backgroundColor: c.bg, borderWidth: 2.5, tension: .35, pointRadius: 2, pointHoverRadius: 6, spanGaps: true, borderDash: [6, 3] })) },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { ...CHART_TT, callbacks: { label: c => c.dataset.label + ': ' + Math.round(c.parsed.y) + ' þ.kr/m² (raunverð 2024)' } } }, scales: { x: { grid: { display: false }, ticks: { color: CHART_TICK, font: { size: 11 }, maxRotation: 45 } }, y: { grid: { color: CHART_GRID }, ticks: { color: CHART_TICK, font: { size: 11 }, callback: v => Math.round(v) }, beginAtZero: true } } }
  });

  const matRatio = (h, y) => {
    const recs = rows.filter(r => { const ry = new Date(r.thinglystdags).getFullYear(); return ry === y && hvS(r.heimilisfang) === h && r.fasteignamat > 0 && r.kaupverd > 1000; });
    if (!recs.length) return null;
    return Math.round(recs.reduce((s, r) => s + r.kaupverd / r.fasteignamat * 100, 0) / recs.length);
  };
  new Chart(document.getElementById('c4'), {
    type: 'line',
    data: { labels: yrs.map(String), datasets: [ ...Object.entries(HVERFI_LIT).map(([h, c]) => ({ label: h, data: yrs.map(y => matRatio(h, y)), borderColor: c.line, borderWidth: 2.5, tension: .35, pointRadius: 2, pointHoverRadius: 6, spanGaps: true })), { label: 'Fasteignamat = 100%', data: yrs.map(() => 100), borderColor: 'rgba(0,0,0,.15)', borderWidth: 1.5, borderDash: [4, 4], pointRadius: 0, spanGaps: true } ] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { ...CHART_TT, callbacks: { label: c => c.dataset.label + ': ' + Math.round(c.parsed.y) + '% af mati' } } }, scales: { x: { grid: { display: false }, ticks: { color: CHART_TICK, font: { size: 11 }, maxRotation: 45 } }, y: { grid: { color: CHART_GRID }, ticks: { color: CHART_TICK, font: { size: 11 }, callback: v => v + '%' }, min: 0 } } }
  });
}

function seasonalAnalysisSumar(rows) {
  _seasonalAnalysis(rows, 2000, { best: 'sBest', bestSub: 'sBestSub', worst: 'sWorst', worstSub: 'sWorstSub', diff: 'sDiff', advice: 'seasonAdvice', c5: 'c5', c6: 'c6' }, [2020, 2026]);
}

function updateMetricsSumar(rows, ls) {
  document.getElementById('m1').textContent = ls.length;
  const rc = rows.filter(r => { const y = new Date(r.thinglystdags).getFullYear(); return y >= 2023 && r.einflm > 0 && r.kaupverd / r.einflm < 2000 && r.kaupverd / r.einflm > 10; });
  if (rc.length) document.getElementById('m2').textContent = Math.round(rc.reduce((s, r) => s + r.kaupverd / r.einflm, 0) / rc.length) + ' þ.kr';
  document.getElementById('m3').textContent = rows.filter(r => new Date(r.thinglystdags).getFullYear() === 2025).length;
  const f = r => r.einflm > 0 && r.kaupverd / r.einflm < 2000 && r.kaupverd / r.einflm > 10;
  const a4 = rows.filter(r => new Date(r.thinglystdags).getFullYear() === 2024 && f(r));
  const a5 = rows.filter(r => new Date(r.thinglystdags).getFullYear() === 2025 && f(r));
  if (a4.length && a5.length) {
    const v4 = a4.reduce((s, r) => s + r.kaupverd / r.einflm, 0) / a4.length;
    const v5 = a5.reduce((s, r) => s + r.kaupverd / r.einflm, 0) / a5.length;
    const ch = ((v5 - v4) / v4) * 100;
    const e = document.getElementById('m4');
    e.textContent = (ch >= 0 ? '+' : '') + Math.round(ch) + '%';
    e.style.color = ch >= 0 ? 'var(--acc)' : 'var(--dng)';
  }
}

function renderListingsSumar(ls, rows) {
  const w = document.getElementById('lw');
  if (!ls.length) { w.innerHTML = '<div class="emp">Engar sumarhúsaeignir á póstnúmeri 311 á fastinn.is núna.</div>'; return; }
  for (const l of ls) l._lastSale = lastSaleOnStreet(rows, l.heimilisfang);
  const o = { good: 0, ok: 1, high: 2 };
  ls.sort((a, b) => {
    const sd = (o[a._s.s] ?? 1) - (o[b._s.s] ?? 1);
    if (sd !== 0) return sd;
    const aD = a._lastSale ? a._lastSale.getTime() : 0;
    const bD = b._lastSale ? b._lastSale.getTime() : 0;
    if (bD !== aD) return bD - aD;
    return (a.fm_thkr || 999) - (b.fm_thkr || 999);
  });
  w.innerHTML = '<div class="lcs">' + ls.map((l, i) => renderListingCard(l, i, hist(rows, l.heimilisfang, l.staerd), getMatInfo(rows, l.heimilisfang, l.staerd), true)).join('') + '</div>';
}

async function renderRecentSalesSumar(postnr) {
  const wrap = document.getElementById('recentSalesWrap');
  try {
    const [salesResult, sheetsResult] = await Promise.all([API.getNyjustuSolur(postnr, 10), API.getSheetListings(postnr)]);
    const sales = salesResult.data;
    const sheetRows = sheetsResult.data || [];
    if (!sales || !sales.length) { wrap.innerHTML = '<div class="ns-empty">Engar nýlegar sölur fundust í kaupskrá á póstnúmeri ' + postnr + '.</div>'; return; }
    const validSales = sales.filter(r => r.einflm > 10 && r.kaupverd > 500 && r.kaupverd / r.einflm >= 10 && r.kaupverd / r.einflm <= 2000).slice(0, 5);
    if (!validSales.length) { wrap.innerHTML = '<div class="ns-empty">Engar gildar sölur eftir síun.</div>'; return; }
    const sheetLookup = {};
    for (const sr of sheetRows) { const key = addrKey(sr.titill); if (key && !sheetLookup[key]) sheetLookup[key] = sr; }
    wrap.innerHTML = '<div class="ns-grid">' + validSales.map((sale, idx) => _recentSaleCard(sale, idx, sheetLookup)).join('') + '</div>';
  } catch (err) {
    console.error('Recent sales (sumar) error:', err);
    wrap.innerHTML = `<div class="err">Villa við að sækja nýjustu sölur: ${err.message}</div>`;
  }
}

function _recentSaleCard(sale, idx, sheetLookup) {
  const saleAddr  = sale.heimilisfang || '';
  const saleDate  = new Date(sale.thinglystdags).toLocaleDateString('is-IS');
  const salePrice = sale.kaupverd * 1000;
  const saleSqm   = sale.einflm;
  const saleFm    = Math.round(sale.kaupverd / sale.einflm);
  const matched   = sheetLookup[addrKey(saleAddr)];
  const adPrice   = matched ? parseSheetPrice(matched.verd) : 0;
  const adSqm     = matched ? parseSheetSize(matched.staerd) : 0;
  const adFm      = adSqm > 0 && adPrice > 0 ? Math.round(adPrice / adSqm / 1000) : 0;
  const adDate    = matched ? (matched.skrad || '') : '';

  let diffPct = 0, diffClass = 'ns-nomatch', diffLabel = '';
  if (adPrice > 0 && salePrice > 0) {
    diffPct = Math.round((1 - salePrice / adPrice) * 100);
    if (diffPct > 0)      { diffClass = 'ns-discount'; diffLabel = 'afsláttur'; }
    else if (diffPct < 0) { diffClass = 'ns-premium';  diffLabel = 'yfirverð'; diffPct = Math.abs(diffPct); }
    else                  { diffClass = 'ns-nomatch';   diffLabel = 'jafnt'; }
  }

  let compareH = '';
  if (matched && adPrice > 0) {
    const dvC = diffLabel === 'afsláttur' ? 'ns-green' : diffLabel === 'yfirverð' ? 'ns-orange' : '';
    compareH = `<div class="ns-compare">
      <div class="ns-col"><div class="ns-col-label">Auglýst verð</div><div class="ns-col-price">${(adPrice / 1000000).toFixed(1)}M</div><div class="ns-col-fm">${adFm > 0 ? adFm + ' þ.kr/m²' : '–'}</div></div>
      <div class="ns-arrow">→</div>
      <div class="ns-col"><div class="ns-col-label">Söluverð</div><div class="ns-col-price">${(salePrice / 1000000).toFixed(1)}M</div><div class="ns-col-fm">${saleFm} þ.kr/m²</div></div>
      <div class="ns-diff"><div class="ns-diff-val ${dvC}">${diffPct > 0 ? '-' : '+'}${diffPct}%</div><div class="ns-diff-label">${diffLabel}</div></div>
    </div>${adDate ? `<div style="font-size:.72rem;color:var(--tx3);margin-top:.5rem">Auglýst á fastinn.is: ${adDate}</div>` : ''}`;
  } else {
    compareH = `<div class="ns-nomatch-msg">Auglýsing ekki fundin á fastinn.is — eign gæti hafa selst utan markaðar eða áður en vöktun hófst.</div>`;
  }

  return `<div class="ns-card" style="animation-delay:${idx * 80}ms">
    <div class="ns-top">
      <div class="ns-stripe ${diffClass}"></div>
      <div class="ns-body">
        <div class="ns-header"><span class="ns-addr">${saleAddr}</span><span class="ns-date">Þinglýst ${saleDate}</span></div>
        <div class="ns-stats">
          <div class="ns-stat"><div class="ns-stat-label">Söluverð</div><div class="ns-stat-val">${fISK(salePrice)}</div></div>
          <div class="ns-stat"><div class="ns-stat-label">Stærð</div><div class="ns-stat-val">${saleSqm} m²</div></div>
          <div class="ns-stat"><div class="ns-stat-label">Selt fm.verð</div><div class="ns-stat-val">${saleFm} þ.kr/m²</div></div>
          ${sale.fasteignamat > 0 ? `<div class="ns-stat"><div class="ns-stat-label">Fasteignamat</div><div class="ns-stat-val">${fISK(sale.fasteignamat * 1000)}</div></div>` : ''}
        </div>
        ${compareH}
      </div>
    </div>
  </div>`;
}

// ============================================================
// ====  HÖFUÐBORGARSVÆÐI  ====================================
// ============================================================

const H_COLOR     = '#1a5a8a';
const H_COLOR_BG  = 'rgba(26,90,138,.07)';
const H_COLOR_BAR = 'rgba(26,90,138,.55)';
const H_CHARTS    = {};  // track instances for destruction

function destroyHofudCharts() {
  ['c1','c2','c3','c4','c5','c6'].forEach(k => {
    if (H_CHARTS[k]) { H_CHARTS[k].destroy(); H_CHARTS[k] = null; }
  });
}

// fm.verð filter for apartments (higher price range than sumarhús)
const H_FM_MIN = 50;
const H_FM_MAX = 5000;

async function fetchFastinnHofud(postnr) {
  try {
    const r = await fetch('https://chmqzsxu3l-dsn.algolia.net/1/indexes/*/queries?x-algolia-application-id=CHMQZSXU3L&x-algolia-api-key=9bfe0ddf26fdff0dd90dcdfc0e955eb7', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests: [{ indexName: 'listing_index', query: '', filters: 'type:fjolb', hitsPerPage: 200, page: 0 }] })
    });
    const d = await r.json();
    const hits = d.results?.[0]?.hits || [];
    const seen = new Set();
    return hits
      .filter(h => h.removed === false && Number(h.zip) === postnr)
      .filter(h => { const k = h.address || h.street_name; if (seen.has(k)) return false; seen.add(k); return true; })
      .map(h => {
        const sqm = h.sqm || h.size || 0, price = h.price || 0;
        return {
          heimilisfang: h.address || h.street_name || '?',
          verd_kr: price,
          staerd: sqm,
          fm_thkr: sqm > 0 && price > 0 ? Math.round(price / sqm / 1000) : 0,
          linkur: `https://fastinn.is/soluskra/${h.mblAssetId || h.objectID}`,
          dags: h.dateadded ? new Date(h.dateadded).toLocaleDateString('is-IS') : '',
          dags_raw: h.dateadded ? new Date(h.dateadded) : null
        };
      });
  } catch (e) { console.error('Fastinn.is (hofud) error:', e); return []; }
}

function buildChartsHofud(rows, postnr) {
  destroyHofudCharts();

  const yrs = [];
  for (let y = 2008; y <= 2026; y++) yrs.push(y);

  // Group by year, filter outliers for apartments
  const byYear = {};
  for (const r of rows) {
    const y = new Date(r.thinglystdags).getFullYear();
    const fm = r.einflm > 0 ? r.kaupverd / r.einflm : null;
    if (!fm || fm < H_FM_MIN || fm > H_FM_MAX) continue;
    if (!byYear[y]) byYear[y] = { fms: [], matRatios: [], count: 0 };
    byYear[y].fms.push(fm);
    byYear[y].count++;
    if (r.fasteignamat > 0 && r.kaupverd > 1000) {
      byYear[y].matRatios.push(r.kaupverd / r.fasteignamat * 100);
    }
  }

  const avg   = y => byYear[y]?.fms.length ? Math.round(byYear[y].fms.reduce((a, b) => a + b, 0) / byYear[y].fms.length) : null;
  const cnt   = y => byYear[y]?.count || null;
  const matR  = y => byYear[y]?.matRatios.length ? Math.round(byYear[y].matRatios.reduce((a, b) => a + b, 0) / byYear[y].matRatios.length) : null;
  const label = `Póstnúmer ${postnr}`;

  // Update legend
  const legHtml = `<span><span class="ld" style="background:${H_COLOR}"></span>${label}</span>`;
  ['h-cleg1','h-cleg2','h-cleg3','h-cleg4'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = legHtml;
  });

  // C1: avg fm.verð
  H_CHARTS.c1 = new Chart(document.getElementById('h-c1'), {
    type: 'line',
    data: { labels: yrs.map(String), datasets: [{ label, data: yrs.map(y => avg(y)), borderColor: H_COLOR, backgroundColor: H_COLOR_BG, borderWidth: 2.5, tension: .35, pointRadius: 2, pointHoverRadius: 6, spanGaps: true }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { ...CHART_TT, callbacks: { label: c => Math.round(c.parsed.y) + ' þ.kr/m²' } } }, scales: { x: { grid: { display: false }, ticks: { color: CHART_TICK, font: { size: 11 }, maxRotation: 45 } }, y: { grid: { color: CHART_GRID }, ticks: { color: CHART_TICK, font: { size: 11 }, callback: v => Math.round(v) }, beginAtZero: true } } }
  });

  // C2: fjöldi sölna
  H_CHARTS.c2 = new Chart(document.getElementById('h-c2'), {
    type: 'bar',
    data: { labels: yrs.map(String), datasets: [{ label, data: yrs.map(y => cnt(y)), backgroundColor: H_COLOR_BAR, borderRadius: 4, barPercentage: .7 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: CHART_TT }, scales: { x: { grid: { display: false }, ticks: { color: CHART_TICK, font: { size: 11 }, maxRotation: 45 } }, y: { grid: { color: CHART_GRID }, ticks: { color: CHART_TICK, font: { size: 11 } }, beginAtZero: true } } }
  });

  // C3: raunverð (inflation-adjusted)
  H_CHARTS.c3 = new Chart(document.getElementById('h-c3'), {
    type: 'line',
    data: { labels: yrs.map(String), datasets: [{ label: label + ' (raunverð)', data: yrs.map(y => { const v = avg(y); return v ? toReal(v, y) : null; }), borderColor: H_COLOR, backgroundColor: H_COLOR_BG, borderWidth: 2.5, tension: .35, pointRadius: 2, pointHoverRadius: 6, spanGaps: true, borderDash: [6, 3] }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { ...CHART_TT, callbacks: { label: c => Math.round(c.parsed.y) + ' þ.kr/m² (raunverð 2024)' } } }, scales: { x: { grid: { display: false }, ticks: { color: CHART_TICK, font: { size: 11 }, maxRotation: 45 } }, y: { grid: { color: CHART_GRID }, ticks: { color: CHART_TICK, font: { size: 11 }, callback: v => Math.round(v) }, beginAtZero: true } } }
  });

  // C4: kaupverð vs mat ratio
  H_CHARTS.c4 = new Chart(document.getElementById('h-c4'), {
    type: 'line',
    data: { labels: yrs.map(String), datasets: [{ label, data: yrs.map(y => matR(y)), borderColor: H_COLOR, borderWidth: 2.5, tension: .35, pointRadius: 2, pointHoverRadius: 6, spanGaps: true }, { label: 'Fasteignamat = 100%', data: yrs.map(() => 100), borderColor: 'rgba(0,0,0,.15)', borderWidth: 1.5, borderDash: [4, 4], pointRadius: 0, spanGaps: true }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { ...CHART_TT, callbacks: { label: c => c.dataset.label + ': ' + Math.round(c.parsed.y) + '% af mati' } } }, scales: { x: { grid: { display: false }, ticks: { color: CHART_TICK, font: { size: 11 }, maxRotation: 45 } }, y: { grid: { color: CHART_GRID }, ticks: { color: CHART_TICK, font: { size: 11 }, callback: v => v + '%' }, min: 0 } } }
  });
}

function seasonalAnalysisHofud(rows) {
  _seasonalAnalysis(rows, H_FM_MAX, {
    best: 'h-sBest', bestSub: 'h-sBestSub', worst: 'h-sWorst', worstSub: 'h-sWorstSub',
    diff: 'h-sDiff', advice: 'h-seasonAdvice', c5: 'h-c5', c6: 'h-c6'
  }, [2020, 2026]);
}

function updateMetricsHofud(rows, ls, postnr) {
  document.getElementById('h-m1').textContent = ls.length;
  document.getElementById('h-m1s').textContent = `fjölbýli á póstnr. ${postnr}`;
  document.getElementById('h-m3s').textContent = `fjölbýli á ${postnr}`;

  const f = r => r.einflm > 0 && r.kaupverd / r.einflm < H_FM_MAX && r.kaupverd / r.einflm > H_FM_MIN;
  const rc = rows.filter(r => { const y = new Date(r.thinglystdags).getFullYear(); return y >= 2023 && f(r); });
  if (rc.length) document.getElementById('h-m2').textContent = Math.round(rc.reduce((s, r) => s + r.kaupverd / r.einflm, 0) / rc.length) + ' þ.kr';
  document.getElementById('h-m3').textContent = rows.filter(r => new Date(r.thinglystdags).getFullYear() === 2025).length;

  const a4 = rows.filter(r => new Date(r.thinglystdags).getFullYear() === 2024 && f(r));
  const a5 = rows.filter(r => new Date(r.thinglystdags).getFullYear() === 2025 && f(r));
  if (a4.length && a5.length) {
    const v4 = a4.reduce((s, r) => s + r.kaupverd / r.einflm, 0) / a4.length;
    const v5 = a5.reduce((s, r) => s + r.kaupverd / r.einflm, 0) / a5.length;
    const ch = ((v5 - v4) / v4) * 100;
    const e = document.getElementById('h-m4');
    e.textContent = (ch >= 0 ? '+' : '') + Math.round(ch) + '%';
    e.style.color = ch >= 0 ? 'var(--acc)' : 'var(--dng)';
  }
}

function renderListingsHofud(ls, rows) {
  const w = document.getElementById('h-lw');
  if (!ls.length) {
    w.innerHTML = '<div class="emp">Engar íbúðir fundust á fastinn.is á þessu svæði. Athugaðu að Algolia-sían fyrir íbúðir gæti þurft leiðréttingu.</div>';
    return;
  }
  // Compute avg for scoring
  const validRows = rows.filter(r => r.einflm > 0 && r.kaupverd / r.einflm >= H_FM_MIN && r.kaupverd / r.einflm <= H_FM_MAX);
  const recent = validRows.filter(r => new Date(r.thinglystdags).getFullYear() >= 2022);
  const avgFm = recent.length ? Math.round(recent.reduce((s, r) => s + r.kaupverd / r.einflm, 0) / recent.length) : 0;

  for (const l of ls) {
    l._s = scoreListingVsAvg(l, avgFm);
    l._lastSale = lastSaleOnStreet(rows, l.heimilisfang);
  }

  const o = { good: 0, ok: 1, high: 2 };
  ls.sort((a, b) => {
    const sd = (o[a._s.s] ?? 1) - (o[b._s.s] ?? 1);
    if (sd !== 0) return sd;
    const aD = a._lastSale ? a._lastSale.getTime() : 0;
    const bD = b._lastSale ? b._lastSale.getTime() : 0;
    if (bD !== aD) return bD - aD;
    return (a.fm_thkr || 9999) - (b.fm_thkr || 9999);
  });

  w.innerHTML = '<div class="lcs">' + ls.map((l, i) => renderListingCard(l, i, hist(rows, l.heimilisfang, l.staerd), getMatInfo(rows, l.heimilisfang, l.staerd), true)).join('') + '</div>';
}

async function renderRecentSalesHofud(postnr) {
  const wrap = document.getElementById('h-recentSalesWrap');
  try {
    const salesResult = await API.query('kaupskra', {
      postnr: `eq.${postnr}`,
      tegund: 'eq.Fjölbýli',
      kaupverd: 'gt.5000',
      einflm: 'gt.20',
      onothaefur_samningur: 'neq.1',
      order: 'thinglystdags.desc',
      limit: 10
    }, { paginate: false });

    const sales = salesResult.data;
    if (!sales || !sales.length) { wrap.innerHTML = `<div class="ns-empty">Engar nýlegar sölur fundust í kaupskrá á póstnúmeri ${postnr}.</div>`; return; }

    const validSales = sales.filter(r =>
      r.einflm > 20 && r.kaupverd > 5000 &&
      r.kaupverd / r.einflm >= H_FM_MIN &&
      r.kaupverd / r.einflm <= H_FM_MAX
    ).slice(0, 5);

    if (!validSales.length) { wrap.innerHTML = '<div class="ns-empty">Engar gildar sölur eftir síun.</div>'; return; }

    // Try sheet lookup (may be empty for non-311 areas)
    const sheetsResult = await API.getSheetListings(postnr);
    const sheetLookup = {};
    for (const sr of (sheetsResult.data || [])) {
      const key = addrKey(sr.titill);
      if (key && !sheetLookup[key]) sheetLookup[key] = sr;
    }

    wrap.innerHTML = '<div class="ns-grid">' + validSales.map((sale, idx) => _recentSaleCard(sale, idx, sheetLookup)).join('') + '</div>';
  } catch (err) {
    console.error('Recent sales (hofud) error:', err);
    wrap.innerHTML = `<div class="err">Villa við að sækja nýjustu sölur: ${err.message}</div>`;
  }
}

// ============================================================
// ====  SHARED SEASONAL ANALYSIS  ============================
// ============================================================

function _seasonalAnalysis(rows, fmMax, ids, yearRange) {
  const MON    = ['Jan','Feb','Mar','Apr','Maí','Jún','Júl','Ágú','Sep','Okt','Nóv','Des'];
  const MON_IS = ['janúar','febrúar','mars','apríl','maí','júní','júlí','ágúst','september','október','nóvember','desember'];

  const [fromY, toY] = yearRange;
  const recent = rows.filter(r => {
    const y = new Date(r.thinglystdags).getFullYear();
    return y >= fromY && y <= toY && r.einflm > 0 && r.kaupverd / r.einflm < fmMax && r.kaupverd / r.einflm > 10;
  });

  const byMonth = Array(12).fill(null).map(() => ({ fms: [], count: 0 }));
  recent.forEach(r => { const m = new Date(r.thinglystdags).getMonth(); byMonth[m].fms.push(r.kaupverd / r.einflm); byMonth[m].count++; });
  const avgFm  = byMonth.map(m => m.fms.length ? Math.round(m.fms.reduce((a, b) => a + b, 0) / m.fms.length) : 0);
  const counts = byMonth.map(m => m.count);

  const valid = avgFm.map((v, i) => ({ v, i })).filter(x => x.v > 0);
  if (!valid.length) return;
  const best  = valid.reduce((a, b) => a.v < b.v ? a : b);
  const worst = valid.reduce((a, b) => a.v > b.v ? a : b);
  const diffPct = Math.round((1 - best.v / worst.v) * 100);

  document.getElementById(ids.best).textContent     = MON_IS[best.i].charAt(0).toUpperCase() + MON_IS[best.i].slice(1);
  document.getElementById(ids.bestSub).textContent  = best.v + ' þ.kr/m²';
  document.getElementById(ids.worst).textContent    = MON_IS[worst.i].charAt(0).toUpperCase() + MON_IS[worst.i].slice(1);
  document.getElementById(ids.worstSub).textContent = worst.v + ' þ.kr/m²';
  document.getElementById(ids.diff).textContent     = '-' + diffPct + '%';

  const now = new Date().getMonth(), nowAvg = avgFm[now] || 0;
  const cheapMonths = valid.filter(x => x.v < best.v * 1.1).map(x => MON_IS[x.i]).join(', ');
  document.getElementById(ids.advice).innerHTML = nowAvg > 0
    ? `<strong>Núna (${MON_IS[now]}):</strong> Meðalverð ${MON_IS[now]} er ${nowAvg} þ.kr/m². ${nowAvg <= best.v * 1.1 ? 'Þetta er <strong>góður tími</strong> til að kaupa — verð er nálægt lægstu gildum.' : 'Verð er <strong>yfir meðallagi</strong> núna. Hagstæðustu mánuðirnir eru ' + cheapMonths + '.'}`
    : 'Ekki nóg gögn til að meta núverandi mánuð.';

  const barCols = avgFm.map(v => {
    if (v <= best.v * 1.1) return 'rgba(45,106,79,.55)';
    if (v >= worst.v * .9) return 'rgba(193,18,31,.4)';
    return 'rgba(184,110,0,.4)';
  });

  // For hofud view, destroy existing charts before creating
  const c5el = document.getElementById(ids.c5);
  const c6el = document.getElementById(ids.c6);

  // Detect if this is hofud view (prefix h-)
  const isHofud = ids.c5.startsWith('h-');
  if (isHofud) {
    if (H_CHARTS.c5) { H_CHARTS.c5.destroy(); H_CHARTS.c5 = null; }
    if (H_CHARTS.c6) { H_CHARTS.c6.destroy(); H_CHARTS.c6 = null; }
  }

  const c5 = new Chart(c5el, {
    type: 'bar',
    data: { labels: MON, datasets: [
      { label: 'Fm.verð', data: avgFm, backgroundColor: barCols, borderRadius: 6, barPercentage: .6, yAxisID: 'y', order: 2 },
      { label: 'Fjöldi',  data: counts, type: 'line', borderColor: 'rgba(58,124,165,.7)', backgroundColor: 'rgba(58,124,165,.06)', borderWidth: 2, pointRadius: 4, pointHoverRadius: 7, tension: .4, yAxisID: 'y1', fill: true, order: 1 }
    ]},
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { ...CHART_TT, callbacks: { label: c => c.dataset.label === 'Fm.verð' ? Math.round(c.parsed.y) + ' þ.kr/m²' : c.parsed.y + ' sölur' } } }, scales: { x: { grid: { display: false }, ticks: { color: CHART_TICK, font: { size: 12 }, autoSkip: false } }, y: { position: 'left', grid: { color: CHART_GRID }, ticks: { color: CHART_TICK, font: { size: 11 }, callback: v => Math.round(v) }, beginAtZero: true, title: { display: true, text: 'þ.kr/m²', color: CHART_TICK, font: { size: 11 } } }, y1: { position: 'right', grid: { display: false }, ticks: { color: 'rgba(58,124,165,.6)', font: { size: 11 } }, beginAtZero: true, title: { display: true, text: 'fjöldi', color: 'rgba(58,124,165,.6)', font: { size: 11 } } } } }
  });
  if (isHofud) H_CHARTS.c5 = c5;

  // Heatmap
  const years = [];
  for (let y = fromY; y <= toY; y++) years.push(y);
  const hmData = [];
  years.forEach((yr, yi) => {
    for (let m = 0; m < 12; m++) {
      const recs = recent.filter(r => { const d = new Date(r.thinglystdags); return d.getFullYear() === yr && d.getMonth() === m; });
      if (recs.length > 0) {
        const a = Math.round(recs.reduce((s, r) => s + r.kaupverd / r.einflm, 0) / recs.length);
        hmData.push({ x: m, y: yi, v: a });
      }
    }
  });
  const maxV = Math.max(...hmData.map(d => d.v)), minV = Math.min(...hmData.map(d => d.v));

  const c6 = new Chart(c6el, {
    type: 'scatter',
    data: { datasets: [{ data: hmData.map(d => ({ x: d.x, y: d.y })), pointRadius: hmData.map(() => 18), pointStyle: 'rectRounded', pointHoverRadius: 22, backgroundColor: hmData.map(d => { const t = (d.v - minV) / (maxV - minV); const r = Math.round(230 - t * 190), g = Math.round(240 - t * 130), b = Math.round(225 - t * 150); return `rgb(${r},${g},${b})`; }) }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { ...CHART_TT, callbacks: { label: c => { const d = hmData[c.dataIndex]; return `${MON[d.x]} ${years[d.y]}: ${d.v} þ.kr/m²`; } } } }, scales: { x: { type: 'linear', min: -.5, max: 11.5, grid: { display: false }, ticks: { color: CHART_TICK, font: { size: 11 }, stepSize: 1, callback: v => MON[v] || '', autoSkip: false } }, y: { type: 'linear', min: -.5, max: years.length - .5, reverse: true, grid: { display: false }, ticks: { color: CHART_TICK, font: { size: 11 }, stepSize: 1, callback: v => years[v] || '' } } } }
  });
  if (isHofud) H_CHARTS.c6 = c6;
}

// ============================================================
// ====  FILTER BUTTONS  ======================================
// ============================================================

document.getElementById('fil').addEventListener('click', e => {
  const b = e.target.closest('.fb');
  if (!b) return;
  document.querySelectorAll('#fil .fb').forEach(x => x.classList.remove('on'));
  b.classList.add('on');
  const f = b.dataset.f;
  document.querySelectorAll('#view-sumar .lc').forEach(c => {
    c.style.display = (f === 'all' || c.dataset.sc === f) ? '' : 'none';
  });
});

document.getElementById('h-fil').addEventListener('click', e => {
  const b = e.target.closest('.fb');
  if (!b) return;
  document.querySelectorAll('#h-fil .fb').forEach(x => x.classList.remove('on'));
  b.classList.add('on');
  const f = b.dataset.f;
  document.querySelectorAll('#view-hofud .lc').forEach(c => {
    c.style.display = (f === 'all' || c.dataset.sc === f) ? '' : 'none';
  });
});

// ============================================================
// ====  VIEW MANAGEMENT  =====================================
// ============================================================

let sumarReady   = false;
let hofudReady   = false;
let hofudPostnr  = null;

const SUB_TEXTS = {
  sumar: 'Sumarhúsasvæðið — kauptækifæri í rauntíma',
  hofud: 'Höfuðborgarsvæðið — markaðsgreining fjölbýlishúsa'
};

async function initSumar() {
  if (sumarReady) return;
  sumarReady = true;
  try {
    const [kaupskraResult, ls] = await Promise.all([
      API.getKaupskra({
        select: 'heimilisfang,kaupverd,einflm,byggar,thinglystdags,onothaefur_samningur,fasteignamat,fasteignamat_gildandi',
        postnr: 'eq.311', tegund: 'eq.Sumarhús', kaupverd: 'gt.500', order: 'thinglystdags.asc'
      }),
      fetchFastinnSumar(POSTNR)
    ]);

    const rows = kaupskraResult.data;
    if (!rows || !rows.length) {
      document.getElementById('lw').innerHTML = '<div class="err">Engin gögn úr Supabase. Athugaðu API tengingu.</div>';
      return;
    }

    const hs   = bldStats(rows);
    const avgs = recAvg(rows);
    for (const l of ls) {
      const h = hvS(l.heimilisfang);
      l._s = scoreListingVsAvg(l, avgs[h] || avgs._d);
    }

    buildChartsSumar(hs, rows);
    seasonalAnalysisSumar(rows);
    updateMetricsSumar(rows, ls);
    renderListingsSumar(ls, rows);
    renderRecentSalesSumar(POSTNR);
    document.getElementById('upd').textContent = 'Uppfært: ' + new Date().toLocaleString('is-IS');
  } catch (e) {
    console.error('initSumar error:', e);
    document.getElementById('lw').innerHTML = `<div class="err">Villa: ${e.message}</div>`;
  }
}

async function initHofud(postnr) {
  if (hofudReady && hofudPostnr === postnr) return;
  hofudPostnr = postnr;
  hofudReady  = false;

  // Show loading state in all containers
  const loadingHtml = '<div class="ldw"><div class="ldr"></div>Sæki gögn…</div>';
  ['h-lw','h-recentSalesWrap'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = loadingHtml;
  });
  // Reset metrics
  ['h-m1','h-m2','h-m3','h-m4'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '—';
  });

  try {
    const [kaupskraResult, ls] = await Promise.all([
      API.getKaupskra({
        select: 'heimilisfang,kaupverd,einflm,byggar,thinglystdags,onothaefur_samningur,fasteignamat,fasteignamat_gildandi',
        postnr: `eq.${postnr}`, tegund: 'eq.Fjölbýli', kaupverd: 'gt.1000',
        onothaefur_samningur: 'neq.1', order: 'thinglystdags.asc'
      }),
      fetchFastinnHofud(postnr)
    ]);

    const rows = kaupskraResult.data;
    if (!rows || !rows.length) {
      document.getElementById('h-lw').innerHTML = `<div class="err">Engin gögn úr Supabase fyrir póstnúmer ${postnr}.</div>`;
      return;
    }

    buildChartsHofud(rows, postnr);
    seasonalAnalysisHofud(rows);
    updateMetricsHofud(rows, ls, postnr);
    renderListingsHofud(ls, rows);
    renderRecentSalesHofud(postnr);
    hofudReady = true;
    document.getElementById('upd').textContent = 'Uppfært: ' + new Date().toLocaleString('is-IS');
  } catch (e) {
    console.error('initHofud error:', e);
    document.getElementById('h-lw').innerHTML = `<div class="err">Villa: ${e.message}</div>`;
  }
}

// ---- Tab switching ----
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const view = btn.dataset.view;
    document.querySelectorAll('.tab-btn').forEach(b => { b.classList.remove('active'); b.setAttribute('aria-selected', 'false'); });
    btn.classList.add('active');
    btn.setAttribute('aria-selected', 'true');
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById('view-' + view).classList.add('active');

    const subEl = document.getElementById('header-sub');
    if (subEl) subEl.textContent = SUB_TEXTS[view] || '';

    if (view === 'sumar') initSumar();
    else if (view === 'hofud') {
      const postnr = parseInt(document.getElementById('hofud-postnr').value, 10);
      initHofud(postnr);
    }
  });
});

// ---- Postnr dropdown ----
document.getElementById('hofud-postnr').addEventListener('change', e => {
  hofudReady = false;  // force re-init with new postnr
  initHofud(parseInt(e.target.value, 10));
});

// ---- Startup: init sumar view ----
initSumar();
