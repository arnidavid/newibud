// ============================================================
// app.js — ibud v2  (Sumarhúsasvæði + Höfuðborgarsvæði)
// ============================================================

// ---- Shared constants ----

// VNV ársmeðaltöl (grunnur maí 1988=100), uppfært jan 2026 frá Hagstofu
const VNV = {2006:281.4,2007:295.8,2008:332.4,2009:372.2,2010:392.7,2011:408.3,2012:429.5,2013:446.0,2014:457.2,2015:464.8,2016:474.5,2017:482.8,2018:496.0,2019:511.8,2020:525.5,2021:547.7,2022:592.0,2023:647.2,2024:690.3,2025:720.0,2026:740.0};
const VNV_BASE = 2024;

// ---- Shared helpers ----
// Íslenskt tölu- og dagsetningasnið (ekki toLocaleString – sumir vafrar kunna ekki is-IS)
const MAN_STUTT = ['jan.','feb.','mars','apr.','maí','júní','júlí','ág.','sept.','okt.','nóv.','des.'];
const MAN_LANGT = ['janúar','febrúar','mars','apríl','maí','júní','júlí','ágúst','september','október','nóvember','desember'];
const fmtInt = n => String(Math.round(Number(n))).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const fmtMkr = thkr => (Math.round(thkr / 100) / 10).toFixed(1).replace('.', ',') + ' m.kr';
const fmtDag = d => { const x = new Date(d); return x.getDate() + '. ' + MAN_STUTT[x.getMonth()]; };
const fmtDagLangt = d => { const x = new Date(d); return x.getDate() + '. ' + MAN_LANGT[x.getMonth()] + ' ' + x.getFullYear(); };
const fmtDagAr = d => { const x = new Date(d); return x.getDate() + '. ' + MAN_STUTT[x.getMonth()] + ' ' + x.getFullYear(); };
const fmtM2 = m => String(Math.round(Number(m) * 10) / 10).replace('.', ',') + ' m²';
function fISK(v) { return fmtInt(v) + ' kr.'; }

function toReal(thkr, year) {
  const v = VNV[year], b = VNV[VNV_BASE];
  if (!v || !b) return thkr;
  return Math.round(thkr * b / v);
}

// Mat eignarinnar sjálfrar ef hún finnst (sama heimilisfang, næst að stærð),
// annars nýjasta sala af svipaðri stærð í sömu götu.
function getMatInfo(rows, addr, sqm) {
  const hus = addr.replace(/\s*\(.*\)\s*$/, '').trim().toLowerCase();
  const b = addr.replace(/\s+\d+.*$/, '');
  const matches = rows
    .filter(r => r.heimilisfang.startsWith(b) && Math.abs(Number(r.einflm) - sqm) < 20 && (r.fasteignamat_gildandi || r.fasteignamat) > 0);
  if (!matches.length) return null;
  const eigin = matches.filter(r => r.heimilisfang.trim().toLowerCase() === hus);
  const m = eigin.length
    ? eigin.sort((a, b) => Math.abs(a.einflm - sqm) - Math.abs(b.einflm - sqm) || new Date(b.thinglystdags) - new Date(a.thinglystdags))[0]
    : matches.sort((a, b) => new Date(b.thinglystdags) - new Date(a.thinglystdags))[0];
  return { mat: Number(m.fasteignamat_gildandi || m.fasteignamat), addr: m.heimilisfang };
}

// ============================================================
// ====  SUMARHÚSASVÆÐI  ======================================
// ============================================================

const POSTNR = 311;
// ---- Skorradalur (kortastefna) ----
const KS = { rows: [], real: false };
const KS_COL = { c: '#00897b', fill: '#E4F2EF', fill2: '#9FD0C8' };
const KS_HVERFI = ['Fitjahlíð', 'Dagverðarnes', 'Vatnsendahlíð'];

function ksFjall() {
  const by = yearStatsFromRows(KS.rows, 10, 2000), last = kLastYear(by), years = [];
  for (let y = 2008; y <= last; y++) years.push(y);
  const nom = years.map(y => kAvg(by, y));
  const vals = KS.real ? nom.map((v, i) => v ? toReal(v, years[i]) : null) : nom;
  let hi = 0; vals.forEach((v, i) => { if (v && v > (vals[hi] || 0)) hi = i; });
  const v1 = vals[vals.length - 1];
  document.getElementById('ks-now').innerHTML = v1 ? `<b style="color:var(--k-skorr-tx)">${fmtInt(v1)}</b><span>þ.kr/m² árið ${last}${KS.real ? ' á verðlagi 2024' : ''}${hi !== vals.length - 1 ? `, hæst ${fmtInt(vals[hi])} árið ${years[hi]}` : ''}</span>` : '';
  kProfile(document.getElementById('ks-fjall'), years, vals, KS_COL,
    { ariaLabel: `Fermetraverð sumarhúsa ${years[0]} til ${last}${KS.real ? ' á verðlagi 2024' : ''}: úr ${fmtInt(vals[0])} í ${fmtInt(v1)} þúsund krónur, hæst ${fmtInt(vals[hi])} árið ${years[hi]}.` });

  const n = years.map(y => by[y]?.nAll || 0);
  let nmax = 0; n.forEach((v, i) => { if (v > n[nmax]) nmax = i; });
  document.getElementById('ks-bars-t').textContent = `flestar ${n[nmax]} árið ${years[nmax]}, ${n[n.length - 1]} það sem af er ${last}`;
  kBars(document.getElementById('ks-bars'), years, n, KS_COL, `Fjöldi sölna á ári ${years[0]} til ${last}, flestar ${n[nmax]} árið ${years[nmax]}.`);

  const mat = years.map(y => {
    const r = KS.rows.filter(x => new Date(x.thinglystdags).getFullYear() === y && x.fasteignamat > 0 && x.kaupverd > 1000);
    return r.length ? Math.round(r.reduce((a, x) => a + x.kaupverd / x.fasteignamat * 100, 0) / r.length) : null;
  });
  const mLast = mat[mat.length - 1];
  document.getElementById('ks-mat-t').textContent = mLast ? `${mLast}% árið ${last}; brotna línan er 100%` : '';
  kLine(document.getElementById('ks-mat'), years, mat, KS_COL, { ref: 100, fmt: v => v + '%',
    ariaLabel: `Söluverð sem hlutfall af fasteignamati ${years[0]} til ${last}.` });
}

// Hverfin: lítil gröf í sama lit; punktur stærri með fleiri sölum, holur ef færri en 3
function ksHverfi() {
  const last = kLastYear(yearStatsFromRows(KS.rows, 10, 2000)), y0 = last - 10, W = 300, H = 150;
  const sx = y => +((y - y0) / 10 * W).toFixed(1), sy = v => +(H - v / 800 * H).toFixed(1);
  document.getElementById('ks-hverfi').innerHTML = KS_HVERFI.map(name => {
    const pts = [];
    for (let y = y0; y <= last; y++) {
      const r = KS.rows.filter(x => x.heimilisfang?.startsWith(name) && new Date(x.thinglystdags).getFullYear() === y && x.einflm > 0 && x.kaupverd / x.einflm >= 10 && x.kaupverd / x.einflm <= 2000);
      if (r.length) pts.push({ y, v: Math.round(r.reduce((a, x) => a + x.kaupverd / x.einflm, 0) / r.length), n: r.length });
    }
    if (!pts.length) return '';
    let d = ''; pts.forEach((p, i) => { d += (i && p.y - pts[i - 1].y === 1 ? ' L' : ' M') + sx(p.y) + ' ' + sy(p.v); });
    const lp = pts[pts.length - 1];
    return `<figure style="margin:0">
      <figcaption><b>${name}</b><span>${lp.y}: ${fmtInt(lp.v)}${lp.n < 3 ? ` (${lp.n} ${lp.n === 1 ? 'sala' : 'sölur'})` : ''}</span></figcaption>
      <div class="k-chart">
        <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${name}, fermetraverð á ári: ${pts.map(p => `${p.y} ${p.v} þ.kr/m² (${p.n} ${p.n === 1 ? 'sala' : 'sölur'})`).join(', ')}.">
          <line x1="0" x2="${W}" y1="${sy(400)}" y2="${sy(400)}" stroke="#D5DCDC" vector-effect="non-scaling-stroke"/>
          <line x1="0" x2="${W}" y1="${H}" y2="${H}" stroke="#1C2B33" vector-effect="non-scaling-stroke"/>
          <path d="${d.trim()}" fill="none" stroke="${KS_COL.c}" stroke-width="1.5" vector-effect="non-scaling-stroke"/>
          ${pts.map(p => `<circle cx="${sx(p.y)}" cy="${sy(p.v)}" r="${(2.5 + Math.sqrt(p.n) * 1.4).toFixed(1)}" fill="${p.n < 3 ? '#F2F4F1' : KS_COL.c}" stroke="${KS_COL.c}" stroke-width="1.5" vector-effect="non-scaling-stroke"><title>${p.y}: ${fmtInt(p.v)} þ.kr/m², ${p.n} ${p.n === 1 ? 'sala' : 'sölur'}</title></circle>`).join('')}
        </svg>
        <span class="k-xl" style="left:0;transform:none">${y0}</span>
        <span class="k-xl" style="left:100%;transform:translateX(-100%)">${last}</span>
      </div>
    </figure>`;
  }).join('');
}

// Auglýst og selt: nýjustu 20 sölur, ásett verð þar sem auglýsing fannst (pickListingForSale)
async function ksAvs() {
  const tb = document.getElementById('ks-avs'), sum = document.getElementById('ks-avs-sum');
  const { data: listings, error } = await API.getListingsDb(POSTNR, 'sumarhus');
  if (error || !listings) { tb.innerHTML = '<tr><td colspan="5">Ekki tókst að sækja auglýsingar. Reyndu aftur síðar.</td></tr>'; return; }
  const byKey = {};
  for (const l of listings) for (const k of [l.fastnum && 'f:' + l.fastnum, 'a:' + normAddr(l.heimilisfang)]) if (k) (byKey[k] = byKey[k] || []).push(l);
  const sales = KS.rows.filter(r => r.einflm > 0 && r.kaupverd / r.einflm >= 10 && r.kaupverd / r.einflm <= 2000)
    .slice().sort((a, b) => new Date(b.thinglystdags) - new Date(a.thinglystdags)).slice(0, 20);
  const pairs = sales.map(sale => {
    const l = pickListingForSale({ ...sale, postnr: POSTNR }, [...(sale.fastnum ? byKey['f:' + sale.fastnum] || [] : []), ...(byKey['a:' + normAddr(sale.heimilisfang)] || [])]);
    const ask = l?.verd ? l.verd / 1000 : 0;
    return { sale, l, ask, d: ask ? Math.round((sale.kaupverd / ask - 1) * 100) : null };
  });
  tb.innerHTML = pairs.map(({ sale, l, ask, d }) => {
    const url = sale.fastnum && sale.heinum ? `https://fastinn.is/fasteignir/${sale.heinum}/${sale.fastnum}` : l?.linkur;
    const a = vmEsc(sale.heimilisfang);
    return `<tr data-addr="${a.toLowerCase()}">
      <th scope="row" class="c-eign" style="text-align:left;font-weight:600">${url ? `<a href="${url}" target="_blank" rel="noopener">${a}</a>` : a}<span class="k-sub">${fmtM2(sale.einflm)}, þinglýst ${fmtDagAr(sale.thinglystdags)}</span></th>
      <td class="c-ask r" style="color:var(--k-muted)">${!ask ? '' : l.linkur ? `<a href="${l.linkur}" target="_blank" rel="noopener" title="Opna auglýsingu">${fmtMkr(ask)}</a>` : fmtMkr(ask)}</td>
      <td class="c-selt r" style="font-weight:700">${fmtMkr(sale.kaupverd)}</td>
      <td class="c-mun r ${d > 0 ? 'k-up' : d < 0 ? 'k-down' : ''}" style="font-weight:700">${d == null ? '' : (d > 0 ? '+' : d < 0 ? '−' : '±') + Math.abs(d) + '%'}</td>
      <td class="c-fm r">${fmtInt(sale.kaupverd / sale.einflm)}</td>
    </tr>`;
  }).join('') || '<tr><td colspan="5">Engar sölur fundust.</td></tr>';
  kMore(document.getElementById('ks-avs-more'), [...tb.querySelectorAll('tr')], 8, 'sölur');

  // Samantekt síðustu 12 mánaða (aðeins sölur þar sem auglýsing fannst)
  const cut = new Date(); cut.setFullYear(cut.getFullYear() - 1);
  const rec = pairs.filter(p => p.d != null && new Date(p.sale.thinglystdags) >= cut);
  if (rec.length >= 3) {
    const under = rec.filter(p => p.d < 0).length, med = rec.map(p => p.d).sort((a, b) => a - b)[Math.floor(rec.length / 2)];
    sum.textContent = `Síðustu 12 mánuði fannst auglýsing fyrir ${rec.length} af sölunum. ${under} ${under === 1 ? 'seldist' : 'seldust'} undir ásettu verði, og miðgildi munarins er ${med > 0 ? '+' : med < 0 ? '−' : '±'}${Math.abs(med)}%.`;
  } else sum.textContent = '';
}

// Götuleit: síar sölutöfluna og eignalistann (stærri en 1 stafur)
function ksFilter(q) {
  q = q.trim().toLowerCase();
  [['ks-avs', 'tr', 'ks-avs-more', 8, 'sölur'], ['ks-ls', '.k-lst', 'ks-ls-more', 10, 'eignir']].forEach(([id, sel, more, show, noun]) => {
    const items = [...document.getElementById(id).querySelectorAll(sel)].filter(e => e.dataset.addr != null);
    if (q.length >= 2) {
      items.forEach(e => { e.hidden = false; e.classList.toggle('k-off', !e.dataset.addr.includes(q)); });
      document.getElementById(more).hidden = true;
    } else {
      items.forEach(e => e.classList.remove('k-off'));
      kMore(document.getElementById(more), items, show, noun);
    }
  });
}

async function fetchFastinnSumar(postnr) {
  try {
    const r = await fetch('https://chmqzsxu3l-dsn.algolia.net/1/indexes/*/queries?x-algolia-application-id=CHMQZSXU3L&x-algolia-api-key=9bfe0ddf26fdff0dd90dcdfc0e955eb7', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests: [{ indexName: 'listing_index', query: '', filters: `type:sumarhus AND removed:false AND zip:${postnr}`, hitsPerPage: 200, page: 0 }] })
    });
    const d = await r.json();
    const hits = d.results?.[0]?.hits || [];
    const seen = new Set();
    return hits
      .filter(h => { const k = h.address || h.street_name; if (seen.has(k)) return false; seen.add(k); return true; })
      .map(h => {
        const sqm = h.sqm || h.size || 0, price = h.price || 0;
        return {
          heimilisfang: h.address || h.street_name || '?',
          verd_kr: price,
          staerd: sqm,
          fm_thkr: sqm > 0 && price > 0 ? Math.round(price / sqm / 1000) : 0,
          linkur: `https://fastinn.is/soluskra/${h.mblAssetId || h.objectID}`,
          dags: h.dateadded ? fmtDagAr(h.dateadded) : '',
          dags_raw: h.dateadded ? new Date(h.dateadded) : null
        };
      });
  } catch (e) { console.error('Fastinn.is (sumar) error:', e); return []; }
}

// ============================================================
// ====  HÖFUÐBORGARSVÆÐI  ====================================
// ============================================================


// fm.verð filter for apartments (higher price range than sumarhús)
const H_FM_MIN = 50;
const H_FM_MAX = 5000;

const TEGUND_MAP = {
  all:   { algolia: '(type:fjolb OR type:einb OR type:raðpar OR type:hæðir)', kaupskra: null },
  fjolb: { algolia: 'type:fjolb',  kaupskra: 'Fjölbýli' },
  einb:  { algolia: '(type:einb OR type:einbýlishús)', kaupskra: 'Einbýli' },
  raðpar:{ algolia: 'type:raðpar', kaupskra: 'Sérbýli' },
};

// Þéttbýlissvæði: postnr 0 í fellilista = allt svæðið (listinn `allt`).
// 190 Vogar og 230 Reykjanesbær eru ekki á höfuðborgarsvæðinu; 270 Mosfellsbær er það.
const SVAEDI = {
  hofud: {
    nafn: 'Höfuðborgarsvæðið', allt_txt: 'á öllu höfuðborgarsvæðinu',
    allt: [101, 102, 103, 104, 105, 107, 108, 109, 110, 111, 112, 113, 116, 161, 162, 170,
           200, 201, 202, 203, 206, 210, 212, 220, 221, 222, 225, 270],
    algolia: '(zip:101 TO 116 OR zip:161 TO 170 OR zip:200 TO 225 OR zip:270 TO 270)',
    col: { c: '#B8652A', tx: '#8A4519', fill: '#F7EEE6', fill2: '#D9B79C', faint: '#E1D3C8', lo: [247, 236, 226], hi: [122, 58, 22] }
  },
  akureyri: {
    nafn: 'Akureyri', allt_txt: 'á Akureyri',
    allt: [600, 603],
    algolia: '(zip:600 OR zip:603)',
    col: { c: '#5E4FA2', tx: '#433880', fill: '#EEEBF6', fill2: '#C3BADF', faint: '#DAD5EA', lo: [238, 235, 246], hi: [52, 40, 110] },
    valkostir: '<option value="0">Allur bærinn</option><option value="600">600 Akureyri</option><option value="603">603 Akureyri (norðan Glerár)</option>'
  },
  reykjanesbaer: {
    nafn: 'Reykjanesbær', allt_txt: 'í Reykjanesbæ',
    allt: [230, 233, 260, 262],
    algolia: '(zip:230 OR zip:233 OR zip:260 OR zip:262)',
    col: { c: '#2E6DA4', tx: '#1F4F7A', fill: '#E6EEF6', fill2: '#A9C3DC', faint: '#D2DEE9', lo: [230, 238, 246], hi: [22, 58, 98] },
    valkostir: '<option value="0">Allur bærinn</option><option value="230">230 Keflavík</option><option value="260">260 Njarðvík</option><option value="262">262 Ásbrú</option><option value="233">233 Hafnir</option>'
  },
  // Aðeins Selfoss (800 bærinn, 801 dreifbýlið í kring). Eyrarbakki (820) og Stokkseyri (825) eru
  // ~25 % ódýrari á fermetra og eldri hús, svo þau eru höfð utan svo þau skekki ekki meðaltölin.
  selfoss: {
    nafn: 'Selfoss', allt_txt: 'á Selfossi',
    allt: [800, 801],
    algolia: '(zip:800 OR zip:801)',
    col: { c: '#A23B63', tx: '#7A2547', fill: '#F6E8EE', fill2: '#D9A9BD', faint: '#E8D3DC', lo: [246, 232, 238], hi: [110, 28, 62] },
    valkostir: '<option value="0">Allur Selfoss</option><option value="800">800 Selfoss</option><option value="801">801 Selfoss (dreifbýli)</option>'
  },
  // Aðeins bærinn (300); Hvalfjarðarsveit (301) er sveit með sumarhúsum í bland
  akranes: {
    nafn: 'Akranes', allt_txt: 'á Akranesi',
    allt: [300],
    algolia: '(zip:300)',
    col: { c: '#5B7F2B', tx: '#3F5C1B', fill: '#EEF3E6', fill2: '#BFD0A6', faint: '#DCE5CF', lo: [238, 243, 230], hi: [44, 66, 18] },
    valkostir: '<option value="0">300 Akranes</option>'
  }
};
const svPostnrs = (sv, postnr) => postnr === 0 ? SVAEDI[sv].allt : [postnr];

async function fetchFastinnHofud(sv, postnr, tegund = 'all') {
  try {
    const typeFilter = TEGUND_MAP[tegund]?.algolia || TEGUND_MAP.all.algolia;
    const zipFilter  = postnr === 0 ? SVAEDI[sv].algolia : `zip:${postnr}`;
    // Aðeins virkar auglýsingar (áður voru 500 fyrstu sóttar með fjarlægðum og síaðar á eftir → allt of lágar tölur)
    const filters = `(${typeFilter}) AND ${zipFilter} AND removed:false`;
    const r = await fetch('https://chmqzsxu3l-dsn.algolia.net/1/indexes/*/queries?x-algolia-application-id=CHMQZSXU3L&x-algolia-api-key=9bfe0ddf26fdff0dd90dcdfc0e955eb7', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests: [{ indexName: 'listing_index', query: '', filters, hitsPerPage: 1000, page: 0 }] })
    });
    const d = await r.json();
    const hits = d.results?.[0]?.hits || [];
    // Ein færsla á söluferil (endurbirt auglýsing sömu eignar), ekki á heimilisfang: íbúðir í sama húsi eru ólíkar eignir
    const seen = new Set();
    const ls = hits
      .filter(h => { const k = h.journeyId || h.objectID; if (seen.has(k)) return false; seen.add(k); return true; })
      .map(h => {
        const sqm = h.sqm || h.size || 0, price = h.price || 0;
        return {
          heimilisfang: h.address || h.street_name || '?',
          verd_kr: price,
          staerd: sqm,
          fm_thkr: sqm > 0 && price > 0 ? Math.round(price / sqm / 1000) : 0,
          linkur: `https://fastinn.is/soluskra/${h.mblAssetId || h.objectID}`,
          dags: h.dateadded ? fmtDagAr(h.dateadded) : '',
          dags_raw: h.dateadded ? new Date(h.dateadded) : null
        };
      });
    // Heildarfjöldi á sölu: leitin skilar mest 1000 færslum. Aðeins ef listinn er styttur er nbHits notað
    // (það telur endurbirtar auglýsingar sömu eignar oftar en einu sinni, svo það er ekki rétt annars)
    const nb = d.results?.[0]?.nbHits || 0;
    ls.total = nb > hits.length ? nb : ls.length;
    return ls;
  } catch (e) { console.error('Fastinn.is (hofud) error:', e); return []; }
}

// Leggur mánaðarsamantekt (get_manadarsolur) saman eftir árum
function hofudByYear(agg) {
  const by = {};
  for (const a of agg) {
    const y = by[a.ar] || (by[a.ar] = { nAll: 0, nFm: 0, sumFm: 0, nMat: 0, sumMat: 0 });
    y.nAll += a.n_allt; y.nFm += a.n_fm; y.sumFm += Number(a.sum_fm || 0);
    y.nMat += a.n_mat;  y.sumMat += Number(a.sum_mat || 0);
  }
  return by;
}

// ---- Kortastefna: almenn teikniföll (Höfuðborg, síðar Skorradalur) ----
// Hæðarsnið eins svæðis: lína + fjall með hæðarlínu á hverjum 100 þ.kr/m²
// Lárétt staða (%) í grafi sem hefur ás-dálk (--gut) vinstra megin fyrir lóðréttu ás-tölurnar
const kXpos = p => `calc(var(--gut, 0px) + (100% - var(--gut, 0px)) * ${(p / 100).toFixed(4)})`;

function kProfile(el, years, vals, col, { tall = true, ariaLabel = '' } = {}) {
  const W = 1000, B = 300, n = years.length;
  const ok = vals.filter(v => v);
  if (ok.length < 2) { el.innerHTML = '<p class="k-sub">Of fáar sölur til að teikna.</p>'; return; }
  const top = Math.ceil((Math.max(...ok) + 60) / 100) * 100;
  const x = i => +(i * W / (n - 1)).toFixed(1), yv = v => +(B - v / top * B).toFixed(1);
  const pts = vals.map((v, i) => v ? [x(i), yv(v)] : null).filter(Boolean);
  const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0] + ' ' + p[1]).join(' ');
  const area = line + ` L${pts[pts.length - 1][0]} ${B} L${pts[0][0]} ${B} Z`;
  const step = top > 1200 ? 200 : 100, levels = [];
  for (let L = step; L < top; L += step) levels.push(yv(L));
  const grid = []; for (let g = step * 2; g < top; g += step * 2) grid.push(g);
  const id = 'kp' + Math.random().toString(36).slice(2, 7);
  const pct = (v, of) => +(v / of * 100).toFixed(1);
  const ticks = [years[0], ...years.filter(y => y % 4 === 0 && y > years[0] && y < years[n - 1] - 1), years[n - 1]];
  el.classList.toggle('k-tall', tall);
  el.classList.add('k-gut');
  el.innerHTML = `<svg viewBox="0 0 ${W} ${B}" preserveAspectRatio="none" role="img" aria-label="${ariaLabel}">
      <defs><clipPath id="${id}"><path d="${area}"/></clipPath></defs>
      ${grid.map(g => `<line x1="0" x2="${W}" y1="${yv(g)}" y2="${yv(g)}" stroke="#D5DCDC" vector-effect="non-scaling-stroke"/>`).join('')}
      <g clip-path="url(#${id})"><path d="${area}" fill="${col.fill}"/>${levels.map(y => `<line x1="0" x2="${W}" y1="${y}" y2="${y}" stroke="${col.c}" opacity=".55" vector-effect="non-scaling-stroke"/>`).join('')}</g>
      <path d="${line}" fill="none" stroke="${col.c}" stroke-width="2.5" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
      <line x1="0" x2="${W}" y1="${B}" y2="${B}" stroke="#1C2B33" vector-effect="non-scaling-stroke"/>
    </svg>`
    + grid.map(g => `<span class="k-yl" style="top:${pct(yv(g), B)}%">${fmtInt(g)}</span>`).join('')
    + ticks.map((y, i) => `<span class="k-xl${i && i < ticks.length - 1 ? ' mid' : i ? ' k-xl-end' : ' k-xl-start'}" style="left:${kXpos(pct(x(years.indexOf(y)), W))}">${y}</span>`).join('');
}

// Lítið súlurit (fjöldi á ári) og lítið línurit (hlutfall) í sama ramma og sniðið
function kBars(el, years, vals, col, ariaLabel) {
  const W = 1000, B = 80, n = years.length, max = Math.max(...vals.filter(Boolean), 1);
  const bw = Math.min(30, W / n * .6), x = i => i * W / (n - 1);
  const pct = (v, of) => +(v / of * 100).toFixed(1);
  el.innerHTML = `<svg viewBox="0 0 ${W} ${B}" preserveAspectRatio="none" role="img" aria-label="${ariaLabel}" style="height:90px">
      ${vals.map((v, i) => { if (!v) return ''; const h = v / max * (B - 4); const bx = Math.min(Math.max(x(i) - bw / 2, 0), W - bw);
        return `<rect x="${bx.toFixed(1)}" y="${(B - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" fill="${i === n - 1 ? col.fill2 : col.c}"><title>${years[i]}: ${fmtInt(v)}</title></rect>`; }).join('')}
      <line x1="0" x2="${W}" y1="${B}" y2="${B}" stroke="#1C2B33" vector-effect="non-scaling-stroke"/>
    </svg>`
    + [0, n - 1].map(i => `<span class="k-xl" style="left:${pct(x(i), W)}%;transform:${i ? 'translateX(-100%)' : 'none'}">${years[i]}</span>`).join('');
}

// kvardi: hæsta og lægsta gildi merkt hægra megin (fyrir línurit án viðmiðunarlínu)
function kLine(el, years, vals, col, { ref = null, fmt = v => v, ariaLabel = '', kvardi = false } = {}) {
  const W = 1000, B = 80, n = years.length, ok = vals.filter(v => v != null);
  if (ok.length < 2) { el.innerHTML = '<p class="k-sub">Of fáar sölur.</p>'; return; }
  const lo = Math.min(...ok, ref ?? Infinity) - 3, hi = Math.max(...ok, ref ?? -Infinity) + 3;
  const x = i => +(i * W / (n - 1)).toFixed(1), yv = v => +(B - (v - lo) / (hi - lo) * B).toFixed(1);
  const pts = vals.map((v, i) => v != null ? [x(i), yv(v)] : null).filter(Boolean);
  const pct = (v, of) => +(v / of * 100).toFixed(1);
  el.classList.toggle('k-gutr', kvardi);   // kvarðinn fær eigin dálk hægra megin svo hann lendi ekki á línunni
  el.innerHTML = `<svg viewBox="0 0 ${W} ${B}" preserveAspectRatio="none" role="img" aria-label="${ariaLabel}" style="height:90px">
      ${ref != null ? `<line x1="0" x2="${W}" y1="${yv(ref)}" y2="${yv(ref)}" stroke="#56656B" stroke-dasharray="4 4" vector-effect="non-scaling-stroke"/>` : ''}
      <path d="${pts.map((p, i) => (i ? 'L' : 'M') + p[0] + ' ' + p[1]).join(' ')}" fill="none" stroke="${col.c}" stroke-width="2" vector-effect="non-scaling-stroke"/>
      <line x1="0" x2="${W}" y1="${B}" y2="${B}" stroke="#1C2B33" vector-effect="non-scaling-stroke"/>
    </svg>`
    + (ref != null ? `<span class="k-yl" style="top:${pct(yv(ref), B)}%;left:auto;right:0">${fmt(ref)}</span>` : '')
    + (kvardi ? [Math.max(...ok), Math.min(...ok)].map(v => `<span class="k-yl" style="top:${pct(yv(v), B)}%;left:auto;right:0">${fmt(v)}</span>`).join('') : '')
    + [0, n - 1].map(i => `<span class="k-xl" style="left:${i && kvardi ? 'calc(100% - var(--gutr))' : pct(x(i), W) + '%'};transform:${i ? 'translateX(-100%)' : 'none'}">${years[i]}</span>`).join('');
}

// Hitatafla: fermetraverð eftir mánuðum (raðir = ár), einn litur ljós → dökkur
function kHeat(el, cells, fromY, toY, col) {
  const MON = ['jan','feb','mar','apr','maí','jún','júl','ágú','sep','okt','nóv','des'];
  const vals = cells.map(c => c.v), mn = Math.min(...vals), mx = Math.max(...vals);
  const cell = v => {
    if (v == null) return '<td></td>';
    const t = mx > mn ? (v - mn) / (mx - mn) : .5;
    const rgb = col.lo.map((a, k) => Math.round(a + t * (col.hi[k] - a)));
    return `<td style="background:rgb(${rgb.join(',')});color:${t > .5 ? '#fff' : '#1C2B33'}">${fmtInt(v)}</td>`;
  };
  let rows = '';
  for (let y = fromY; y <= toY; y++) {
    const m = Array(12).fill(null); cells.filter(c => c.yr === y).forEach(c => { m[c.m] = c.v; });
    if (m.some(v => v != null)) rows += `<tr><th scope="row">${y}</th>${m.map(cell).join('')}</tr>`;
  }
  el.innerHTML = `<table class="k-heat"><thead><tr><th scope="col" style="text-align:left">Ár</th>${MON.map(m => `<th scope="col">${m}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>`;
}

// „Sýna fleiri“ undir lista: sýnir `show` í byrjun og allt að 20 í viðbót við hvern smell
function kMore(btn, items, show, noun) {
  let shown = show;
  const draw = () => {
    items.forEach((el, i) => { el.hidden = i >= shown; });
    const rest = items.length - shown;
    btn.hidden = rest <= 0;
    btn.textContent = rest > 20 ? `Sýna 20 ${noun} í viðbót (${fmtInt(rest)} eftir)` : `Sýna ${rest} ${noun} í viðbót`;
  };
  btn.onclick = () => { shown += 20; draw(); items[shown - 20]?.querySelector('a, h3, th')?.focus?.(); };
  draw();
}

// ---- Höfuðborgarsvæðið ----
const KH = { agg: null, real: false };
const khCol = () => SVAEDI[hofudSvaedi].col;   // litir valins svæðis

function khFjall() {
  const by = hofudByYear(KH.agg);
  const last = kLastYear(by), years = [];
  for (let y = 2008; y <= last; y++) years.push(y);
  const nom = years.map(y => kAvg(by, y));
  const vals = KH.real ? nom.map((v, i) => v ? toReal(v, years[i]) : null) : nom;
  let lo = 0; vals.forEach((v, i) => { if (v && (!vals[lo] || v < vals[lo])) lo = i; });
  const v1 = vals[vals.length - 1];
  document.getElementById('kh-now').innerHTML = v1
    ? `<b style="color:var(--k-hofud-tx)">${fmtInt(v1)}</b><span>þ.kr/m² árið ${last}${KH.real ? ' á verðlagi 2024' : ''}, úr ${fmtInt(vals[lo])} árið ${years[lo]}</span>` : '';
  kProfile(document.getElementById('kh-fjall'), years, vals, khCol(),
    { ariaLabel: `Fermetraverð ${years[0]} til ${last}${KH.real ? ' á verðlagi 2024' : ''}: úr ${fmtInt(vals[0])} í ${fmtInt(v1)} þúsund krónur, lægst ${fmtInt(vals[lo])} árið ${years[lo]}.` });

  const n = years.map(y => by[y]?.nAll || 0);
  let nmax = 0; n.forEach((v, i) => { if (v > n[nmax]) nmax = i; });
  document.getElementById('kh-bars-t').textContent = `flestar ${fmtInt(n[nmax])} árið ${years[nmax]}, ${fmtInt(n[n.length - 1])} það sem af er ${last}`;
  kBars(document.getElementById('kh-bars'), years, n, khCol(), `Fjöldi sölna á ári ${years[0]} til ${last}, flestar ${fmtInt(n[nmax])} árið ${years[nmax]}.`);

  const mat = years.map(y => by[y]?.nMat ? Math.round(by[y].sumMat / by[y].nMat) : null);
  const mLast = mat[mat.length - 1];
  document.getElementById('kh-mat-t').textContent = mLast ? `${mLast}% árið ${last}; brotna línan er 100%` : '';
  kLine(document.getElementById('kh-mat'), years, mat, khCol(), { ref: 100, fmt: v => v + '%',
    ariaLabel: `Söluverð sem hlutfall af fasteignamati ${years[0]} til ${last}: ${mat.filter(Boolean).map((v, i) => v + '%').join(', ')}.` });
}

function khKpis(by, lsCount, elId = 'kh-kpis') {
  const el = document.getElementById(elId);
  const set = (k, v, cls) => { const e = el.querySelector(`[data-k="${k}"]`); if (e) { e.textContent = v; if (cls !== undefined) e.className = 'k-kv ' + cls; } };
  const y = kLastYear(by), a = y2 => kAvg(by, y2);
  const chg = (p, c) => p && c ? Math.round((c - p) / p * 100) : null;
  const sg = ch => (ch > 0 ? '+' : ch < 0 ? '−' : '±') + Math.abs(ch) + '%';
  set('ls', lsCount != null ? fmtInt(lsCount) : '—');
  set('fm-l', `Fermetraverð ${y}`); set('fm', a(y) ? fmtInt(a(y)) : '—');
  set('n-l', `Sölur ${y}`); set('n', fmtInt(by[y]?.nAll || 0)); set('n-s', `${fmtInt(by[y - 1]?.nAll || 0)} allt árið ${y - 1}`);
  [[1, y - 2, y - 1], [2, y - 1, y]].forEach(([k, p, c]) => {
    const ch = chg(a(p), a(c));
    set(`c${k}-l`, `${p} → ${c}`);
    set(`c${k}`, ch == null ? '—' : sg(ch), '');      // formerki nægir; rautt/blátt er frátekið fyrir markaðshita
    set(`c${k}-s`, a(p) && a(c) ? `${fmtInt(a(p))} → ${fmtInt(a(c))} þ.kr/m²` : '');
  });
}

function khSeason(agg) {
  const by = hofudByYear(agg), last = kLastYear(by);
  const { avgFm, cells } = _seasonFromAgg(agg, [last - 6, last]);
  const MON_IS = ['janúar','febrúar','mars','apríl','maí','júní','júlí','ágúst','september','október','nóvember','desember'];
  const v = avgFm.map((x, i) => ({ x, i })).filter(o => o.x > 0);
  const txt = document.getElementById('kh-man-txt');
  if (v.length >= 6) {
    const lo = v.reduce((a, b) => a.x < b.x ? a : b), hi = v.reduce((a, b) => a.x > b.x ? a : b);
    const d = Math.round((hi.x / lo.x - 1) * 100);
    txt.textContent = `Liturinn dökknar mun meira niður töfluna, ár frá ári, en þvert yfir hvert ár. Að meðaltali ${last - 6}–${last} hefur ${MON_IS[lo.i]} verið ódýrastur og ${MON_IS[hi.i]} dýrastur, ${d}% munur.`;
  } else txt.textContent = '';
  kHeat(document.getElementById('kh-heat'), cells, last - 6, last, khCol());
}

function khListings(ls, rows, pre = 'kh', col = 'var(--k-hofud-tx)') {
  const w = document.getElementById(pre + '-ls');
  const tot = ls.total ?? ls.length;   // leitin skilar mest 1000 nýjustu; heildarfjöldi getur verið meiri
  document.getElementById(pre + '-ls-n').textContent = !ls.length ? ''
    : tot > ls.length ? `${fmtInt(tot)} eignir, ${fmtInt(ls.length)} nýjustu sýndar`
    : `${fmtInt(ls.length)} ${ls.length === 1 ? 'eign' : 'eignir'}, nýjast fyrst`;
  if (!ls.length) { w.innerHTML = '<p class="k-sub" style="padding:16px 0">Engar eignir á sölu á þessu svæði.</p>'; document.getElementById(pre + '-ls-more').hidden = true; return; }
  ls.sort((a, b) => (b.dags_raw?.getTime() || 0) - (a.dags_raw?.getTime() || 0));
  w.innerHTML = ls.map(l => {
    const mi = rows.length ? getMatInfo(rows, l.heimilisfang, l.staerd) : null;
    const diff = mi && mi.mat > 0 && l.verd_kr > 0 ? Math.round(l.verd_kr / mi.mat / 10) - 100 : null;
    return `<article class="k-lst" data-addr="${vmEsc(l.heimilisfang.toLowerCase())}">
      <div><h3>${vmEsc(l.heimilisfang)}</h3><div class="k-sub">${l.dags ? 'Skráð ' + l.dags : ''}</div></div>
      <div><div class="k-lab">Ásett verð</div><div style="font-weight:700">${l.verd_kr > 0 ? fmtMkr(l.verd_kr / 1000) : 'Tilboð'}</div></div>
      <div><div class="k-lab">Stærð</div><div>${l.staerd ? fmtM2(l.staerd) : '–'}</div></div>
      <div><div class="k-lab">Þ.kr/m²</div><div>${l.fm_thkr > 0 ? fmtInt(l.fm_thkr) : '–'}</div></div>
      <div><div class="k-lab">${diff < 0 ? 'Undir' : 'Yfir'} fasteignamati</div><div class="${diff > 0 ? 'k-up' : diff < 0 ? 'k-down' : ''}">${diff === null ? '–' : Math.abs(diff) + '%'}</div></div>
      <a href="${l.linkur}" target="_blank" rel="noopener" style="color:${col}">Opna auglýsingu</a>
    </article>`;
  }).join('');
  kMore(document.getElementById(pre + '-ls-more'), [...w.querySelectorAll('.k-lst')], 10, 'eignir');
}

// ---- Verð eftir stærð og aldri (RPC get_verd_staerd_aldur) ----
const SA_BINS = {
  staerd: ['undir 50 m²', '50–69 m²', '70–89 m²', '90–109 m²', '110–139 m²', '140–199 m²', '200 m² +'],
  aldur:  ['fyrir 1950', '1950–69', '1970–89', '1990–2009', '2010–19', '2020 +']
};
const SA_MIN_N = 5;   // færri sölur en þetta → dauf súla, ekki notuð í samanburð

async function renderStaerdAldur(sv, postnr, tegund, kaupTegund) {
  const args = { p_postnrs: svPostnrs(sv, postnr), p_tegund: kaupTegund };
  let { data } = await API.rpc('get_verd_staerd_aldur_svaedi', args);
  // Fyrsta kall eftir hlé getur runnið út á tíma (gögn ekki í minni); seinna kallið er ~0,3 sek.
  if (!data && khCurrent(sv, postnr, tegund)) ({ data } = await API.rpc('get_verd_staerd_aldur_svaedi', args));
  if (!khCurrent(sv, postnr, tegund)) return;
  document.getElementById('kh-sa-desc').textContent = postnr === 0
    ? 'Sölur síðustu 24 mánuði, leiðrétt fyrir staðsetningu svo hverfið skekki ekki samanburðinn.'
    : `Sölur síðustu 24 mánuði í ${postnr}.`;
  const pct = (a, b) => Math.round((a / b - 1) * 100);
  for (const flokkur of ['staerd', 'aldur']) {
    const box = document.getElementById('kh-sa-' + flokkur), note = document.getElementById(`kh-sa-${flokkur}-n`);
    const rows = SA_BINS[flokkur].map((_, i) => (data || []).find(r => r.flokkur === flokkur && r.bil === i + 1) || null);
    const ok = rows.filter(r => r && r.n >= SA_MIN_N);
    if (!ok.length) { box.innerHTML = ''; note.textContent = 'Of fáar sölur til að sýna.'; continue; }
    const max = Math.max(...ok.map(r => Number(r.fm))) * 1.1, top = Math.max(...ok.map(r => Number(r.fm)));
    box.innerHTML = rows.map((r, i) => {
      const faint = !r || r.n < SA_MIN_N, v = r ? Number(r.fm) : 0;
      const t = r ? `${fmtInt(r.n)} ${r.n === 1 ? 'sala' : 'sölur'}, miðgildi söluverðs ${fmtMkr(r.verd)}, stærð ${fmtInt(r.m2)} m²` : 'engar sölur';
      return `<div class="k-bar${faint ? ' faint' : ''}" title="${t}">
        <span class="k-bar-l">${SA_BINS[flokkur][i]}</span>
        <span class="k-bar-t"><span style="width:${r ? Math.round(v / max * 100) : 0}%;background:${faint ? khCol().faint : v === top ? khCol().tx : khCol().c}"></span></span>
        <span class="k-bar-v">${r ? fmtInt(v) : '–'}</span>
        <span class="sr-only">${t}</span></div>`;
    }).join('');
    if (ok.length < 2) { note.textContent = 'Of fáar sölur í flestum flokkum til að bera saman.'; continue; }
    if (flokkur === 'staerd') {
      const a = ok[0], b = ok[ok.length - 1], d = pct(a.fm, b.fm);
      note.textContent = d > 0 ? `Fermetrinn í minnstu eignunum (${SA_BINS.staerd[a.bil - 1]}) er um ${d}% dýrari en í þeim stærstu (${SA_BINS.staerd[b.bil - 1]}).` : 'Fermetraverð er svipað óháð stærð hér.';
    } else {
      const hi = ok.reduce((x, y) => Number(y.fm) > Number(x.fm) ? y : x), lo = ok.reduce((x, y) => Number(y.fm) < Number(x.fm) ? y : x), d = pct(hi.fm, lo.fm);
      note.textContent = d >= 3 ? `Dýrast á fermetra: byggt ${SA_BINS.aldur[hi.bil - 1]}. Ódýrast: byggt ${SA_BINS.aldur[lo.bil - 1]}, um ${d}% munur.` : 'Byggingarár skiptir litlu um fermetraverð hér.';
    }
  }
}

// ---- Nýbyggingar: fjöldi á ári (kaupskrá, mv_nybyggingar) og söluhraði (auglýsingar, reiknað í n8n) ----
// Nýbygging = fyrsta sala eignar sem var byggð sama ár eða árið áður.
// Markaðshitataflan er sótt einu sinni og samnýtt af þessum kafla og Markaðshita-flipanum.
const mhLoad = () => (mhLoad.p ||= API.query('markadshiti', { select: '*', order: 'timabil.asc' }, { paginate: false })
  .then(r => r.data?.length ? r.data : null));
const NY_MIN_N = 5;   // færri nýbyggingar en þetta → ekkert fermetraverð sýnt

async function renderNybyggingar(sv, postnr, tegund, kaupTegund) {
  const [{ data }, mh] = await Promise.all([
    API.rpc('get_nybyggingar_svaedi', { p_postnrs: svPostnrs(sv, postnr), p_tegund: kaupTegund }),
    mhLoad().catch(() => null)
  ]);
  if (!khCurrent(sv, postnr, tegund)) return;
  const sec = document.getElementById('kh-ny');
  const rows = (data || []).filter(r => r.ar >= 2010).map(r => ({ ...r, n_allt: +r.n_allt, n_ny: +r.n_ny, n_fm: +r.n_fm, n_fm_ny: +r.n_fm_ny }));
  sec.hidden = !rows.length;
  if (!rows.length) return;

  const years = rows.map(r => r.ar), last = years[years.length - 1], cur = rows[rows.length - 1];
  const nNy = rows.map(r => r.n_ny), pctNy = rows.map(r => r.n_allt ? Math.round(100 * r.n_ny / r.n_allt) : null);
  const fmNy = r => r.n_fm_ny >= NY_MIN_N ? r.sum_fm_ny / r.n_fm_ny : null;
  const fmEldra = r => r.n_fm - r.n_fm_ny > 0 ? (r.sum_fm - (r.sum_fm_ny || 0)) / (r.n_fm - r.n_fm_ny) : null;

  let imax = 0; nNy.forEach((v, i) => { if (v > nNy[imax]) imax = i; });
  document.getElementById('kh-ny-bars-t').textContent = `flestar ${fmtInt(nNy[imax])} árið ${years[imax]}, ${fmtInt(cur.n_ny)} það sem af er ${last}`;
  kBars(document.getElementById('kh-ny-bars'), years, nNy, khCol(),
    `Seldar nýbyggingar á ári ${years[0]} til ${last}, flestar ${fmtInt(nNy[imax])} árið ${years[imax]}.`);
  let pmax = 0; pctNy.forEach((v, i) => { if (v > pctNy[pmax]) pmax = i; });
  document.getElementById('kh-ny-pct-t').textContent = `${pctNy[pctNy.length - 1]}% árið ${last}, mest ${pctNy[pmax]}% árið ${years[pmax]}`;
  kLine(document.getElementById('kh-ny-pct'), years, pctNy, khCol(), { fmt: v => v + '%', kvardi: true,
    ariaLabel: `Hlutfall nýbygginga af sölum ${years[0]} til ${last}: ${pctNy.map((v, i) => `${years[i]} ${v}%`).join(', ')}.` });

  // Söluhraði: aðeins til fyrir svæðið allt og allar tegundir (reiknað úr auglýsingum)
  const mhSv = (mh || []).filter(r => r.svaedi === sv);
  const arNy = mhSv.filter(r => r.gerd === 'ar_ny'), arEl = mhSv.filter(r => r.gerd === 'ar_eldra');
  const latest = g => mhSv.filter(r => r.gerd === g).sort((a, b) => b.timabil.localeCompare(a.timabil))[0];
  const nunaNy = latest('nuna_ny'), nunaEl = latest('nuna_eldra');
  const hNy = arNy[arNy.length - 1], hEl = hNy && arEl.find(r => r.timabil === hNy.timabil);
  const hYr = hNy?.timabil.slice(0, 4);

  const fN = fmNy(cur), fE = fmEldra(cur), dFm = fN && fE ? Math.round((fN / fE - 1) * 100) : null;
  const card = (dt, kv, ks) => `<div><dt>${dt}</dt><dd class="k-kv">${kv}</dd><dd class="k-ks">${ks}</dd></div>`;
  const cards = [
    card(`Nýbyggingar ${last}`, `${pctNy[pctNy.length - 1]}%`, `af sölum, ${fmtInt(cur.n_ny)} ${cur.n_ny === 1 ? 'eign' : 'eignir'}`),
    card(`Fermetraverð nýbygginga ${last}`, fN ? fmtInt(fN) : '—',
      dFm != null ? `${dFm > 0 ? '+' : dFm < 0 ? '−' : '±'}${Math.abs(dFm)}% miðað við eldri (${fmtInt(fE)})` : 'of fáar sölur')
  ];
  if (hNy) cards.push(card(`Dagar á sölu ${hYr}`, fmtInt(hNy.dagar), `nýbyggingar; eldri eignir ${hEl ? fmtInt(hEl.dagar) : '—'}`));
  if (nunaNy) cards.push(card('Nýbyggingar á sölu núna', fmtInt(nunaNy.n), `miðgildi ${fmtInt(nunaNy.dagar)} daga á sölu`));
  const kpis = document.getElementById('kh-ny-kpis');
  kpis.innerHTML = cards.join('');
  kpis.style.setProperty('--mh-n', cards.length);

  const box = document.getElementById('kh-ny-hradi-box');
  box.hidden = !arNy.length;
  if (!arNy.length) return;
  const pair = (a, b, fmt) => `<b>${a != null ? fmt(a) : '–'}</b> <span class="k-sub">/ ${b != null ? fmt(b) : '–'}</span>`;
  const dg = v => fmtInt(v), pc = v => String(Math.round(Number(v) * 10) / 10).replace('.', ',') + '%';
  const tr = (lbl, n, e, soluverd) => `<tr><th scope="row">${lbl}</th>
    <td class="r">${pair(n?.dagar, e?.dagar, dg)}</td>
    <td class="r">${soluverd ? pair(n?.soluhlutfall, e?.soluhlutfall, pc) : '<span class="k-sub">–</span>'}</td>
    <td class="r">${pair(n?.laekkad, e?.laekkad, pc)}</td></tr>`;
  document.getElementById('kh-ny-hradi').innerHTML = arNy.map(n => tr(n.timabil.slice(0, 4) + (n.timabil.slice(0, 4) === String(new Date().getFullYear()) ? ' (það sem af er)' : ''),
      n, arEl.find(e => e.timabil === n.timabil), true)).join('')
    + (nunaNy ? tr('Á sölu núna', nunaNy, nunaEl, false) : '');
  const svNafn = SVAEDI[sv].nafn;
  document.getElementById('kh-ny-hradi-n').textContent =
    (hEl ? `Árið ${hYr} voru nýbyggingar að jafnaði ${fmtInt(hNy.dagar)} daga á sölu en eldri eignir ${fmtInt(hEl.dagar)}. ` : '')
    + (postnr !== 0 || tegund !== 'all' ? `Söluhraðinn á við ${svNafn} allt og allar tegundir íbúðarhúsnæðis.` : '');
}

// Íbúðarhúsnæði í PostgREST (tegund=in.(...) virkar ekki → or)
const IBUD_OR = '(tegund.eq.Fjölbýli,tegund.eq.Sérbýli,tegund.eq.Einbýli)';
async function renderRecentSalesHofud(sv, postnr, tegund = 'all') {
  const tb = document.getElementById('kh-sales');
  try {
    const kaupTegund = TEGUND_MAP[tegund]?.kaupskra;
    const q = {
      select: 'heimilisfang,postnr,tegund,kaupverd,einflm,thinglystdags,fastnum,heinum',
      kaupverd: 'gt.5000', einflm: 'gt.20', onothaefur_samningur: 'neq.1', order: 'thinglystdags.desc', limit: 30
    };
    q.postnr = `in.(${svPostnrs(sv, postnr)})`;
    if (kaupTegund) q.tegund = `eq.${kaupTegund}`; else q.or = IBUD_OR;
    const { data } = await API.query('kaupskra', q, { paginate: false });
    if (!khCurrent(sv, postnr, tegund)) return;
    const valid = (data || []).filter(r => r.kaupverd / r.einflm >= H_FM_MIN && r.kaupverd / r.einflm <= H_FM_MAX).slice(0, 20);
    const draw = rows => {
      if (!khCurrent(sv, postnr, tegund)) return;
      tb.innerHTML = rows.length ? rows.map(r => kSaleRow(r, 'hofud', { postnrOnly: true })).join('')
        : '<tr><td colspan="6">Engar nýlegar sölur fundust á þessu svæði.</td></tr>';
      kMore(document.getElementById('kh-sales-more'), [...tb.querySelectorAll('tr')], 6, 'sölur');
    };
    draw(valid);
    matchSalesToListings(valid).then(draw);
  } catch (err) {
    console.error('Recent sales (hofud) error:', err);
    tb.innerHTML = '<tr><td colspan="6">Ekki tókst að sækja nýjustu sölur. Reyndu aftur síðar.</td></tr>';
  }
}

// ============================================================
// ====  SHARED SEASONAL ANALYSIS  ============================
// ============================================================

// Árstíðagreining: gögnin eru {avgFm[12], counts[12], cells:[{yr, m, v}]} — reiknuð úr
// einstökum sölum (sumarhús) eða mánaðarsamantekt úr Supabase (höfuðborgarsvæði).
function _seasonFromAgg(agg, [fromY, toY]) {
  const byMonth = Array(12).fill(null).map(() => ({ sum: 0, count: 0 }));
  const cells = [];
  for (const a of agg) {
    if (a.ar < fromY || a.ar > toY || !a.n_fm) continue;
    byMonth[a.man - 1].sum += Number(a.sum_fm); byMonth[a.man - 1].count += a.n_fm;
    cells.push({ yr: a.ar, m: a.man - 1, v: Math.round(Number(a.sum_fm) / a.n_fm) });
  }
  return {
    avgFm:  byMonth.map(m => m.count ? Math.round(m.sum / m.count) : 0),
    counts: byMonth.map(m => m.count),
    cells
  };
}

// ============================================================
// ====  AUGLÝST VS. SELT  ====================================
// ============================================================

/**
 * Normaliserar heimilisfang fyrir match:
 *   "Indriðastaðir 51 skorradal" → "indriðastaðir 51"
 *   "Melabraut 4A"               → "melabraut 4a"
 *   "Fitjahlíð 66"               → "fitjahlíð 66"
 */
function normAddr(addr) {
  if (!addr) return '';
  let s = addr.toLowerCase().trim();
  // Strip þekkt staðarviðbætur sem koma í fastinn en ekki kaupskrá
  s = s.replace(/\s+(borgarbygg[ðd]?|skorradal|svæðið|svaedid|hreppur|dalsvegur|reykjavik|kópavogi?r?)\b.*/i, '');
  // Dregur út "gata númer[bókstafur]" hlutann
  const m = s.match(/^(.+?\s+\d+[a-záðéíóúýþæö]?)\b/);
  return m ? m[1].trim() : s.trim();
}

// Velur auglýsingu (fastinn_listings) sem á við tiltekna sölu (kaupskra).
// Fastanúmer, stærð og verð þurfa ÖLL að hanga saman (mælt á ~2.400 sölum maí–okt. 2026:
// þegar stærð passar er söluverð 90–102% af ásettu; þegar stærð víkur >25% er verðið út um allt):
//  1) sama eign: sama fastanúmer og í kaupskrá, eða sama heimilisfang ef auglýsingin hefur ekkert fastanúmer
//     (auglýsing með annað fastanúmer er önnur eign, t.d. önnur íbúð í sama húsi)
//  2) stærð innan 10% (ef stærð er skráð á báðum stöðum)
//  3) söluverð 75–115% af ásettu verði
//  4) auglýsingin birtist fyrir þinglýsingu og var á skrá innan 4 mánaða fyrir hana;
//     ef eignin var auglýst oftar en einu sinni gildir síðasta auglýsingin (síðasta ásetta verð).
function pickListingForSale(sale, listings) {
  const saleDay = String(sale.thinglystdags).slice(0, 10);
  const minLast = new Date(new Date(saleDay).getTime() - 120 * 86400000).toISOString().slice(0, 10);
  const day     = v => String(v || '').slice(0, 10);
  const sqm     = Number(sale.einflm) || 0;
  const key     = normAddr(sale.heimilisfang);
  const fast    = sale.fastnum ? String(sale.fastnum) : null;

  const sameProperty = l => l.fastnum ? (fast && l.fastnum === fast) : normAddr(l.heimilisfang) === key;
  const sizeOk  = l => !sqm || !Number(l.staerd) || Math.abs(Number(l.staerd) - sqm) <= sqm * 0.10;
  const priceOk = l => { const ask = Number(l.verd) / 1000; if (!ask) return false;
                         const r = Number(sale.kaupverd) / ask; return r >= 0.75 && r <= 1.15; };
  const timeOk  = l => (!l.first_seen || day(l.first_seen) <= saleDay) && (!l.last_seen || day(l.last_seen) >= minLast);
  const latest  = (a, b) => day(b.first_seen).localeCompare(day(a.first_seen)) || day(b.last_seen).localeCompare(day(a.last_seen));

  return (listings || [])
    .filter(l => sameProperty(l) && timeOk(l) && sizeOk(l) && priceOk(l))
    // Nákvæm fastanúmers-pör ganga fyrir pörum eftir heimilisfangi
    .sort((a, b) => (!!b.fastnum - !!a.fastnum) || latest(a, b))[0] || null;
}

/** Reiknar aggregate tölfræði úr pörum (síðustu 12 mánuðir) */
// ============================================================
// ====  VIEW MANAGEMENT  (filter buttons removed — listings sorted by date) ======

// ============================================================
// ====  VIEW MANAGEMENT  =====================================
// ============================================================

let sumarReady   = false;
let hofudReady   = false;
let hofudSvaedi  = 'hofud';   // lykill í SVAEDI ('hofud', 'akureyri', 'reykjanesbaer', 'selfoss', 'akranes') – sami flipi, mismunandi svæði
let hofudPostnr  = null;
let hofudTegund  = 'all';
// Á enn við? (notandi gæti hafa skipt um svæði/val á meðan beðið var eftir gögnum)
const khCurrent = (sv, p, t) => hofudSvaedi === sv && hofudPostnr === p && hofudTegund === t;

const SUB_TEXTS = {
  yfirlit: 'Höfuðborgarsvæðið, Akureyri, Reykjanesbær, Selfoss, Akranes og Skorradalur',
  hiti: 'Hversu auðvelt er að selja núna?',
  verdmat: 'Hvað er eignin mín virði?',
  sumar: 'Skorradalur — kauptækifæri í rauntíma',
  hofud: 'Höfuðborgarsvæðið — markaðsgreining íbúðarhúsnæðis',
  akureyri: 'Akureyri — markaðsgreining íbúðarhúsnæðis',
  reykjanesbaer: 'Reykjanesbær — markaðsgreining íbúðarhúsnæðis',
  selfoss: 'Selfoss — markaðsgreining íbúðarhúsnæðis',
  akranes: 'Akranes — markaðsgreining íbúðarhúsnæðis'
};

// Skorradalsgögn sótt einu sinni og samnýtt af forsíðu og Skorradals-flipa
let _sumarDataPromise = null;
function loadSumarData() {
  if (!_sumarDataPromise) {
    _sumarDataPromise = Promise.all([
      API.getKaupskra({
        select: 'heimilisfang,kaupverd,einflm,byggar,thinglystdags,onothaefur_samningur,fasteignamat,fasteignamat_gildandi,fastnum,heinum',
        postnr: 'eq.311', tegund: 'eq.Sumarhús', kaupverd: 'gt.500', order: 'thinglystdags.asc'
      }),
      fetchFastinnSumar(POSTNR)
    ]).then(([k, ls]) => [
      // Ónothæfir samningar (gjafir, innan fjölskyldu o.þ.h.) skekkja meðaltöl – t.d. 2 m.kr. bústaður í Fitjahlíð 2022.
      // Síað hér svo Skorradals-flipinn og forsíðan fái sömu tölur.
      { ...k, data: k.data ? k.data.filter(r => r.onothaefur_samningur !== '1') : k.data }, ls
    ]);
  }
  return _sumarDataPromise;
}

async function initSumar() {
  if (sumarReady) return;
  sumarReady = true;
  try {
    const [k, ls] = await loadSumarData();
    KS.rows = k.data || [];
    if (!KS.rows.length) { document.getElementById('ks-fjall').innerHTML = '<p class="k-sub">Ekki tókst að sækja gögn. Reyndu aftur síðar.</p>'; return; }
    ksFjall();
    khKpis(yearStatsFromRows(KS.rows, 10, 2000), ls.length, 'ks-kpis');
    ksHverfi();
    khListings(ls, KS.rows, 'ks', 'var(--k-skorr-tx)');
    await ksAvs();
    const q = document.getElementById('avs-filter').value;
    if (q) ksFilter(q);
  } catch (e) {
    console.error('initSumar error:', e);
    document.getElementById('ks-fjall').innerHTML = '<p class="k-sub">Ekki tókst að sækja gögn. Reyndu aftur síðar.</p>';
  }
}

document.addEventListener('click', e => {
  const b = e.target.closest('[data-sverdlag]');
  if (!b || !KS.rows.length) return;
  KS.real = b.dataset.sverdlag === 'real';
  document.querySelectorAll('[data-sverdlag]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  ksFjall();
});

async function initHofud(sv, postnr, tegund = hofudTegund) {
  if (hofudReady && khCurrent(sv, postnr, tegund)) return;
  hofudSvaedi = sv;
  hofudPostnr = postnr;
  hofudTegund = tegund;
  hofudReady  = false;
  const loading = '<div class="ldw"><div class="ldr"></div>Sæki gögn…</div>';
  ['kh-fjall', 'kh-ls'].forEach(id => { document.getElementById(id).innerHTML = loading; });
  document.querySelectorAll('#kh-kpis .k-kv').forEach(e => { e.textContent = '—'; });

  // Undirfyrirsögn eftir vali
  const pSel = document.getElementById('hofud-postnr'), tSel = document.getElementById('hofud-tegund');
  const tegTxt = tegund === 'all' ? 'Íbúðarhúsnæði' : tSel.options[tSel.selectedIndex].text;
  document.getElementById('kh-h1').textContent = SVAEDI[sv].nafn;
  document.getElementById('kh-sub').textContent = postnr === 0 ? `${tegTxt} ${SVAEDI[sv].allt_txt}` : `${tegTxt} í ${pSel.options[pSel.selectedIndex].text}`;

  try {
    const kaupTegund = TEGUND_MAP[tegund]?.kaupskra || null;
    const [aggResult, ls] = await Promise.all([API.getManadarsolur(svPostnrs(sv, postnr), kaupTegund), fetchFastinnHofud(sv, postnr, tegund)]);
    if (!khCurrent(sv, postnr, tegund)) return;
    const agg = aggResult.data;
    if (!agg || !agg.length) {
      document.getElementById('kh-fjall').innerHTML = '<p class="k-sub">Engin gögn fundust fyrir þetta val.</p>';
      return;
    }
    KH.agg = agg;
    khFjall();
    khKpis(hofudByYear(agg), ls.total ?? ls.length);
    khSeason(agg);
    renderStaerdAldur(sv, postnr, tegund, kaupTegund);
    renderNybyggingar(sv, postnr, tegund, kaupTegund);
    renderRecentSalesHofud(sv, postnr, tegund);
    khListings(ls, []);                                   // auglýsingar strax…
    const gotur = [...new Set(ls.map(l => l.heimilisfang.replace(/\s+\d.*$/, '')))];
    if (gotur.length) API.getSolurGotur(gotur).then(({ data }) => {   // …hlutfall af mati þegar það berst
      if (data?.length && khCurrent(sv, postnr, tegund)) khListings(ls, data);
    });
    hofudReady = true;
  } catch (e) {
    console.error('initHofud error:', e);
    document.getElementById('kh-fjall').innerHTML = '<p class="k-sub">Ekki tókst að sækja gögn. Reyndu aftur síðar.</p>';
  }
}

document.addEventListener('click', e => {
  const b = e.target.closest('[data-verdlag]');
  if (!b || !KH.agg) return;
  KH.real = b.dataset.verdlag === 'real';
  document.querySelectorAll('[data-verdlag]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  khFjall();
});

// ============================================================
// ====  YFIRLIT (forsíða)  ===================================
// ============================================================
let yfirlitReady = false;
// Íslensk sniðun óháð vafra (ekki allir vafrar styðja 'is-IS')

// Ársmeðaltöl {ár: {nAll, nFm, sumFm}} úr einstökum sölum (sama síun og Skorradals-flipinn)
function yearStatsFromRows(rows, fmMin, fmMax) {
  const by = {};
  for (const r of rows) {
    const y = new Date(r.thinglystdags).getFullYear();
    const b = by[y] || (by[y] = { nAll: 0, nFm: 0, sumFm: 0 });
    b.nAll++;
    const fm = r.einflm > 0 ? r.kaupverd / r.einflm : 0;
    if (fm > fmMin && fm < fmMax) { b.nFm++; b.sumFm += fm; }
  }
  return by;
}

// Finnur auglýsingu fyrir hverja sölu (reglan: pickListingForSale). Supabase keyrir sömu reglu
// og skilar mest einni auglýsingu á sölu – annars fóru þúsundir raða yfir 1.000 raða þakið.
async function matchSalesToListings(sales) {
  if (!sales?.length) return sales;
  const { data } = await API.rpc('auglysing_fyrir_solu', {
    p_postnr: sales.map(s => s.postnr),
    p_heimilisfong: sales.map(s => s.heimilisfang),
    p_fastnum: sales.map(s => s.fastnum ? String(s.fastnum) : null),
    p_dags: sales.map(s => String(s.thinglystdags).slice(0, 10)),
    p_einflm: sales.map(s => Number(s.einflm) || null),
    p_kaupverd: sales.map(s => Number(s.kaupverd))
  });
  return sales.map(s => {
    const hit = pickListingForSale(s, (data || []).filter(l => l.postnr === s.postnr));
    return hit ? { ...s, listing: hit } : s;
  });
}

// ---- Forsíða (kortastefna) ----
const K_COL = { hofud: SVAEDI.hofud.col, akureyri: SVAEDI.akureyri.col, reykjanesbaer: SVAEDI.reykjanesbaer.col, selfoss: SVAEDI.selfoss.col, akranes: SVAEDI.akranes.col, sumar: { c: '#00897b', tx: '#00695E', fill: '#E4F2EF' } };
// Önnur þéttbýlissvæði á forsíðu: línur í verðfjalli, dálkur (id) og nýjustu sölur
const K_AUKA = [{ sv: 'akureyri', id: 'k-reg-aku' }, { sv: 'reykjanesbaer', id: 'k-reg-rnb' }, { sv: 'selfoss', id: 'k-reg-sel' }, { sv: 'akranes', id: 'k-reg-akr' }];
const kAvg = (by, y) => by?.[y]?.nFm ? by[y].sumFm / by[y].nFm : null;
const kLastYear = by => Math.max(...Object.keys(by).filter(y => by[y].nFm > 0).map(Number));

function kRegion(id, by, lsCount) {
  const el = document.getElementById(id);
  const set = (k, v) => { const e = el.querySelector(`[data-k="${k}"]`); if (e) e.textContent = v; };
  const y = kLastYear(by), v = kAvg(by, y), p = kAvg(by, y - 1);
  set('fm-l', 'Fermetraverð');   // árið sést af „Frá …“ við hliðina; með ártali brotnaði merkið í tvær línur
  set('fm', v ? fmtInt(v) : '—');
  set('chg-l', `Frá ${y - 1}`);
  set('ls', lsCount != null ? fmtInt(lsCount) : '—');
  const chg = el.querySelector('[data-k="chg"]');
  if (v && p) {
    const ch = Math.round((v - p) / p * 100);
    chg.textContent = (ch > 0 ? '+' : ch < 0 ? '−' : '±') + Math.abs(ch) + '%';
    chg.className = '';
  }
}

// Verðfjallið: fermetraverð á ári sem hæðarsnið; hver lárétt lína í fjallinu = 100 þ.kr/m²
// auka: [{ sv, by }] fyrir önnur þéttbýlissvæði (by má vanta ef sókn mistókst)
function kFjall(hBy, sBy, auka, lastDate) {
  const y1 = Math.max(kLastYear(hBy), kLastYear(sBy)), years = [];
  for (let y = 2008; y <= y1; y++) years.push(y);
  const H = years.map(y => kAvg(hBy, y)), S = years.map(y => kAvg(sBy, y));
  const L = auka.filter(a => a.by).map(a => ({ sv: a.sv, v: years.map(y => kAvg(a.by, y)) }));
  const all = [...H, ...S, ...L.flatMap(l => l.v)].filter(Boolean), top = Math.ceil((Math.max(...all) + 60) / 100) * 100;
  const W = 1000, B = 300, n = years.length;
  const x = i => +(i * W / (n - 1)).toFixed(1), yv = v => +(B - v / top * B).toFixed(1);
  const pts = a => a.map((v, i) => v ? [x(i), yv(v)] : null).filter(Boolean);
  const line = a => pts(a).map((p, i) => (i ? 'L' : 'M') + p[0] + ' ' + p[1]).join(' ');
  const area = a => { const p = pts(a); return line(a) + ` L${p[p.length - 1][0]} ${B} L${p[0][0]} ${B} Z`; };
  const levels = []; for (let L = 100; L < top; L += 100) levels.push(yv(L));
  const lv = c => levels.map(y => `<line x1="0" x2="${W}" y1="${y}" y2="${y}" stroke="${c}" stroke-width="1" opacity=".6" vector-effect="non-scaling-stroke"/>`).join('');
  const grid = [200, 400, 600, 800].filter(v => v < top);
  // lægsti punktur höfuðborgarsvæðisins (eftir hrun)
  let lo = 0; H.forEach((v, i) => { if (v && v < H[lo]) lo = i; });
  const pct = (v, of) => +(v / of * 100).toFixed(1);
  const hLast = H[n - 1], sLast = S[n - 1];
  const svg = `<svg viewBox="0 0 ${W} ${B}" preserveAspectRatio="none" role="img" aria-label="Fermetraverð ${years[0]} til ${y1}. Höfuðborgarsvæðið úr ${fmtInt(H[0])} í ${fmtInt(hLast)} þúsund krónur á fermetra, lægst ${fmtInt(H[lo])} árið ${years[lo]}.${L.map(l => ` ${SVAEDI[l.sv].nafn} úr ${fmtInt(l.v[0])} í ${fmtInt(l.v[n - 1])}.`).join('')} Skorradalur úr ${fmtInt(S[0])} í ${fmtInt(sLast)}.">
    <defs><clipPath id="kH"><path d="${area(H)}"/></clipPath></defs>
    ${grid.map(v => `<line x1="0" x2="${W}" y1="${yv(v)}" y2="${yv(v)}" stroke="#D5DCDC" vector-effect="non-scaling-stroke"/>`).join('')}
    <g clip-path="url(#kH)" data-sv="hofud"><path d="${area(H)}" fill="${K_COL.hofud.fill}"/>${lv(K_COL.hofud.c)}</g>
    ${L.map(l => `<path data-sv="${l.sv}" d="${line(l.v)}" fill="none" stroke="${K_COL[l.sv].c}" stroke-width="2" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`).join('')}
    <path data-sv="sumar" d="${line(S)}" fill="none" stroke="${K_COL.sumar.c}" stroke-width="2" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
    <path data-sv="hofud" d="${line(H)}" fill="none" stroke="${K_COL.hofud.c}" stroke-width="2.5" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
    <line x1="0" x2="${W}" y1="${B}" y2="${B}" stroke="#1C2B33" vector-effect="non-scaling-stroke"/>
  </svg>`;
  const ticks = [years[0], ...years.filter(y => y % 4 === 0 && y > years[0] && y < y1 - 1), y1];
  // Aðeins höfuðborgarsvæðið er fyllt „fjall“ með hæðarlínum; hin svæðin eru línur ofan á
  const fjall = document.getElementById('k-fjall');
  fjall.classList.add('k-gut');
  fjall.innerHTML = svg
    + grid.map(v => `<span class="k-yl" style="top:${pct(yv(v), B)}%">${v}</span>`).join('')
    + ticks.map((y, i) => `<span class="k-xl${i && i < ticks.length - 1 ? ' mid' : i ? ' k-xl-end' : ' k-xl-start'}" style="left:${kXpos(pct(x(years.indexOf(y)), W))}">${y}</span>`).join('')
    + `<span class="k-note" style="left:${kXpos(pct(x(lo), W))};top:${pct(yv(H[lo]) - 10, B)}%;color:${K_COL.hofud.tx}">${years[lo]}: ${fmtInt(H[lo])}</span>`
    // Punktur við enda hverrar línu (HTML, því SVG-ið er teygt og hringir yrðu sporöskjur)
    + [['hofud', hLast], ...L.map(l => [l.sv, l.v[n - 1]]), ['sumar', sLast]].filter(([, v]) => v)
      .map(([sv, v]) => `<span class="k-dot" data-sv="${sv}" style="left:${kXpos(pct(W, W))};top:${pct(yv(v), B)}%;background:${K_COL[sv].c}"></span>`).join('');

  // Skýringar = hnappar: smellur (eða mús yfir) auðkennir línu svæðisins og deyfir hinar
  const end = (sv, v, txt) => `<button type="button" class="k-end" data-sv="${sv}" aria-pressed="false" aria-label="Auðkenna ${txt} í grafinu, ${fmtInt(v)} þúsund krónur á fermetra"><i style="background:${K_COL[sv].c}"></i><b style="color:${K_COL[sv].tx}">${fmtInt(v)}</b><span>${txt}</span></button>`;
  document.getElementById('k-ends').innerHTML = end('hofud', hLast, 'Höfuðborgarsvæðið, íbúðir')
    + L.filter(l => l.v[n - 1]).map(l => end(l.sv, l.v[n - 1], `${SVAEDI[l.sv].nafn}, íbúðir`)).join('')
    + end('sumar', sLast, 'Skorradalur, sumarhús');

  // Fyrirsögn: hve mikið verðið hefur margfaldast frá lægsta punkti
  const f = Math.floor(hLast / H[lo]);
  const ord = { 2: 'tvöfaldast', 3: 'þrefaldast', 4: 'fjórfaldast', 5: 'fimmfaldast' }[f];
  if (ord) document.getElementById('k-hero-h').textContent = `Fermetraverð hefur meira en ${ord} síðan ${years[lo]}`;
  if (lastDate) {
    const d = new Date(lastDate);
    document.getElementById('k-fjall-cap').textContent = `Þ.kr á fermetra, meðaltal ársins. ${y1} til og með ${d.getDate()}. ${MAN_LANGT[d.getMonth()]}.`;
  }
}

// Auðkenning í verðfjallinu: valið svæði (smellt) eða tímabundið (mús yfir); null = öll jafnt
let kFjallVal = null;
function kFjallAudkenna(sv) {
  document.querySelectorAll('#k-fjall [data-sv], #k-ends [data-sv]').forEach(e => e.classList.toggle('k-dim', !!sv && e.dataset.sv !== sv));
}
document.getElementById('k-ends').addEventListener('click', e => {
  const b = e.target.closest('.k-end'); if (!b) return;
  kFjallVal = kFjallVal === b.dataset.sv ? null : b.dataset.sv;
  document.querySelectorAll('#k-ends .k-end').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.sv === kFjallVal)));
  kFjallAudkenna(kFjallVal);
});
document.getElementById('k-ends').addEventListener('mouseover', e => { const b = e.target.closest('.k-end'); if (b) kFjallAudkenna(b.dataset.sv); });
document.getElementById('k-ends').addEventListener('mouseleave', () => kFjallAudkenna(kFjallVal));

function kSaleRow(r, reg, { postnrOnly = false } = {}) {
  const l = r.listing, c = K_COL[reg];
  const propUrl = r.fastnum && r.heinum ? `https://fastinn.is/fasteignir/${r.heinum}/${r.fastnum}` : l?.linkur;
  const askThkr = l?.verd ? l.verd / 1000 : 0;
  const diff = askThkr ? Math.round((r.kaupverd - askThkr) / askThkr * 100) : null;
  // Ásett verð vísar á auglýsinguna sjálfa (heimilisfangið á eignasíðuna)
  const askTxt = askThkr && l.linkur ? `<a href="${l.linkur}" target="_blank" rel="noopener" title="Opna auglýsingu">${fmtMkr(askThkr)}</a>` : fmtMkr(askThkr);
  const ask = askThkr ? `${askTxt} <span class="${diff < 0 ? 'k-down' : diff > 0 ? 'k-up' : ''}" style="font-weight:600">${diff > 0 ? '+' : diff < 0 ? '−' : '±'}${Math.abs(diff)}%</span>` : '';
  const svaedi = reg === 'sumar' ? '311 Skorradal' : postnrOnly ? r.postnr : reg === 'akureyri' ? r.postnr + ' Akureyri' : vmPostTxt(r.postnr);
  const addr = vmEsc(r.heimilisfang);
  return `<tr>
    <th scope="row" class="c-eign" style="text-align:left;font-weight:600">${postnrOnly ? '' : `<span class="k-sw" style="background:${c.c}"></span>`}${propUrl ? `<a href="${propUrl}" target="_blank" rel="noopener">${addr}</a>` : addr}<span class="k-sub"${postnrOnly ? '' : ' style="margin-left:14px"'}>${vmEsc(r.tegund)}, ${fmtDag(r.thinglystdags)}${postnrOnly ? `<span class="k-mob">, ${r.postnr}</span>` : ''}</span></th>
    <td class="c-svaedi" style="color:var(--k-muted)">${svaedi}</td>
    <td class="c-staerd r">${fmtM2(r.einflm)}</td>
    <td class="c-ask r" style="color:var(--k-muted)">${ask}</td>
    <td class="c-selt r" style="font-weight:700">${fmtMkr(r.kaupverd)}</td>
    <td class="c-fm r">${fmtInt(r.kaupverd / r.einflm)}</td>
  </tr>`;
}

// hopar: [[svæðislykill, sölur], …] í birtingarröð. Í byrjun sést nýjasta sala hvers svæðis
// (tvær á höfuðborgarsvæðinu); hnappurinn sýnir hinar.
let kSolurOpin = false;
function kSalesTable(hopar) {
  const tb = document.getElementById('k-solur'), btn = document.getElementById('k-solur-more');
  const rows = hopar.flatMap(([reg, sales]) => sales.map((r, i) =>
    kSaleRow(r, reg).replace('<tr>', i < (reg === 'hofud' ? 2 : 1) ? '<tr>' : '<tr class="k-x">')));
  tb.innerHTML = rows.length ? rows.join('') : '<tr><td colspan="6">Engar sölur fundust.</td></tr>';
  const fl = tb.querySelectorAll('.k-x').length;
  const draw = () => {
    tb.querySelectorAll('.k-x').forEach(tr => { tr.hidden = !kSolurOpin; });
    btn.hidden = !fl;
    btn.textContent = kSolurOpin ? 'Sýna færri sölur' : `Sýna ${fl} sölur í viðbót`;
    btn.setAttribute('aria-expanded', String(kSolurOpin));
  };
  btn.onclick = () => { kSolurOpin = !kSolurOpin; draw(); };
  draw();
}

async function initYfirlit() {
  if (yfirlitReady) return;
  yfirlitReady = true;
  const fail = id => { const e = document.getElementById(id); if (e) e.innerHTML = '<p class="k-sub">Ekki tókst að sækja gögn. Reyndu aftur síðar.</p>'; };

  const hBy = API.getManadarsolur(SVAEDI.hofud.allt, null).then(r => r.data ? hofudByYear(r.data) : null);
  const sum = loadSumarData().then(([k, ls]) => ({ rows: k.data || [], ls }));
  Promise.all([hBy, fetchFastinnHofud('hofud', 0, 'all')]).then(([by, ls]) => { if (by) kRegion('k-reg-hofud', by, ls.total ?? ls.length); });
  sum.then(s => kRegion('k-reg-sumar', yearStatsFromRows(s.rows, 10, 2000), s.ls.length));
  const aukaBy = K_AUKA.map(({ sv, id }) => {
    const by = API.getManadarsolur(SVAEDI[sv].allt, null).then(r => r.data ? hofudByYear(r.data) : null).catch(() => null);
    Promise.all([by, fetchFastinnHofud(sv, 0, 'all')]).then(([b, ls]) => { if (b) kRegion(id, b, ls.total ?? ls.length); });
    return by;
  });

  const ibudSales = (sv, limit) => API.query('kaupskra', {
    select: 'heimilisfang,postnr,tegund,kaupverd,einflm,thinglystdags,fastnum,heinum',
    kaupverd: 'gt.5000', einflm: 'gt.20', onothaefur_samningur: 'neq.1', or: IBUD_OR,
    postnr: `in.(${SVAEDI[sv].allt})`, order: 'thinglystdags.desc', limit
  }, { paginate: false }).then(r => r.data || []);
  const hSales = ibudSales('hofud', 5);
  const aukaSales = K_AUKA.map(({ sv }) => ibudSales(sv, 3).catch(() => []));
  const sSales = sum.then(s => s.rows.filter(r => r.einflm > 10).slice(-3).reverse()
    .map(r => ({ ...r, postnr: POSTNR, tegund: 'Sumarhús' })));

  Promise.all([hBy, sum, hSales, ...aukaBy]).then(([h, s, hs, ...auka]) => {
    if (!h) return fail('k-fjall');
    kFjall(h, yearStatsFromRows(s.rows, 10, 2000), auka.map((by, i) => ({ sv: K_AUKA[i].sv, by })), hs[0]?.thinglystdags);
  }).catch(() => fail('k-fjall'));

  const regs = ['hofud', ...K_AUKA.map(a => a.sv), 'sumar'];
  Promise.all([hSales, ...aukaSales, sSales]).then(async lists => {
    kSalesTable(lists.map((l, i) => [regs[i], l]));     // sölur strax…
    const matched = await Promise.all(lists.map(matchSalesToListings));
    kSalesTable(matched.map((l, i) => [regs[i], l]));   // …ásett verð þegar það finnst
  }).catch(() => fail('k-solur'));
}

// ============================================================
// ====  MARKAÐSHITI  =========================================
// ============================================================
// Gögn: tafla markadshiti (reiknuð á hverri nóttu). Þéttbýlissvæðin (höfuðborgarsvæðið, Akureyri, Reykjanesbær, Selfoss, Akranes) eftir mánuðum,
// Skorradalur eftir hálfum árum (of fáar sölur á mánuði) + staða eigna á sölu núna.
const MH = { data: null, svaedi: 'hofud', metric: 'yfir_asettu', table: false };
const MH_COOL = '#2f5f8a', MH_WARM = '#a3312a';
// Hitakvarði eins og á veðurkorti: kalt (blátt) → hlutlaust grátt → heitt (rautt)
const MH_SCALE = [
  { label: 'Kaldur',   bg: '#2f5f8a' }, { label: 'Svalur',  bg: '#8fb3cc' },
  { label: 'Jafnvægi', bg: '#c9cfcf' }, { label: 'Heitur',  bg: '#e3a57c' }, { label: 'Sjóðandi', bg: '#a3312a' }
];
// Mælikvarðar: hvaða átt þýðir „kólnun“ (cool = -1: lækkun er kólnun, +1: hækkun er kólnun)
const MH_METRICS = {
  yfir_asettu:  { label: 'Yfir ásettu verði', kpi: 'Seldust yfir ásettu verði', unit: '%', dec: 0, cool: -1, thr: 2, unitChg: 'prósentustig',
                  sig: ['Kaupendur hafa sterkari stöðu', 'Meiri samkeppni um eignir'] },
  soluhlutfall: { label: 'Söluverð af ásettu', kpi: 'Söluverð sem hlutfall af ásettu', unit: '%', dec: 1, cool: -1, thr: 0.3, unitChg: 'stig',
                  sig: ['Afsláttur að aukast', 'Minni afsláttur'] },
  dagar:        { label: 'Dagar á sölu', kpi: 'Dagar á sölu (miðgildi)', unit: '', dec: 0, cool: +1, thr: 5, unitChg: 'dagar',
                  sig: ['Salan tekur lengri tíma', 'Eignir seljast hraðar'] },
  laekkad:      { label: 'Lækkuðu verð', kpi: 'Lækkuðu ásett verð fyrir sölu', unit: '%', dec: 0, cool: +1, thr: 2, unitChg: 'prósentustig',
                  sig: ['Fleiri seljendur slaka á', 'Færri lækka verð'] }
};
const mhFmt = (v, key) => {
  if (v == null || isNaN(v)) return '—';
  const m = MH_METRICS[key];
  return (m.dec ? Number(v).toFixed(m.dec).replace('.', ',') : String(Math.round(v))) + m.unit;
};
const mhAvg = arr => { const a = arr.filter(v => v != null).map(Number); return a.length ? a.reduce((x, y) => x + y, 0) / a.length : null; };
const mhYm  = d => String(d).slice(0, 7);
const mhShift = (ym, months) => { const [y, m] = ym.split('-').map(Number); const t = y * 12 + (m - 1) + months;
  return `${Math.floor(t / 12)}-${String(t % 12 + 1).padStart(2, '0')}`; };

// Hitastig eftir söluverði sem hlutfalli af ásettu verði
function mhLevel(hlut) {
  if (hlut == null) return 2;
  return hlut >= 100.5 ? 4 : hlut >= 99.3 ? 3 : hlut >= 98.6 ? 2 : hlut >= 96 ? 1 : 0;
}

// Reiknar núverandi tímabil og sama tímabil ári fyrr fyrir valið svæði
function mhCompute(svaedi) {
  const rows = MH.data.filter(r => r.svaedi === svaedi);
  const today = new Date(), curYm = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  if (svaedi !== 'skorr') {                          // þéttbýlissvæðin: eftir mánuðum
    const months = rows.filter(r => r.gerd === 'manudur').sort((a, b) => a.timabil.localeCompare(b.timabil));
    const full = months.filter(r => mhYm(r.timabil) < curYm);       // aðeins heilir mánuðir
    const last = full.slice(-3).map(r => mhYm(r.timabil));
    const byYm = Object.fromEntries(months.map(r => [mhYm(r.timabil), r]));
    const cur = {}, prev = {};
    for (const k of Object.keys(MH_METRICS)) {
      cur[k]  = mhAvg(last.map(ym => byYm[ym]?.[k]));
      prev[k] = mhAvg(last.map(ym => byYm[mhShift(ym, -12)]?.[k]));
    }
    const [a, b] = [last[0], last[last.length - 1]].map(ym => MAN_LANGT[Number(ym.slice(5)) - 1]);
    return {
      cur, prev, keys: Object.keys(MH_METRICS), series: months, fullMonths: full,
      period: `Staðan núna – ${a} til ${b} ${last[last.length - 1].slice(0, 4)}`,
      refLabel: 'Sama tíma ' + (Number(last[0].slice(0, 4)) - 1)
    };
  }
  // Skorradalur: síðasta heila hálfa ár borið saman við sama hálfa ár árið áður
  const halves = rows.filter(r => r.gerd === 'halfar').sort((a, b) => a.timabil.localeCompare(b.timabil));
  const isFull = r => mhShift(mhYm(r.timabil), 6) <= curYm;
  const full = halves.filter(isFull);
  const curH = full[full.length - 1], prevH = halves.find(r => mhYm(r.timabil) === mhShift(mhYm(curH.timabil), -12));
  const hName = (r, fall) => (mhYm(r.timabil).slice(5) === '01' ? 'fyrri' : 'seinni') + (fall === 'þgf' ? ' hluta ' : ' hluti ') + r.timabil.slice(0, 4);
  const nuna = rows.filter(r => r.gerd === 'nuna').sort((a, b) => b.timabil.localeCompare(a.timabil))[0];
  const keys = ['soluhlutfall', 'dagar', 'laekkad'];
  const cur = {}, prev = {};
  for (const k of keys) { cur[k] = curH?.[k] != null ? Number(curH[k]) : null; prev[k] = prevH?.[k] != null ? Number(prevH[k]) : null; }
  return {
    cur, prev, keys, series: halves, nuna, isFull,
    period: `Staðan núna – ${hName(curH)} borinn saman við ${prevH ? hName(prevH, 'þgf') : 'fyrra ár'}`,
    refLabel: prevH ? hName(prevH).replace(/^./, c => c.toUpperCase()) : 'Fyrra ár',
    halfName: hName
  };
}

// Breyting milli ára: stefna (kólnun/hlýnun/lítil) og texti
function mhChange(key, cur, prev) {
  const m = MH_METRICS[key];
  if (cur == null || prev == null) return { dir: 0, text: '' };
  const d = cur - prev, abs = Math.abs(d);
  if (abs < m.thr) return { dir: 0, text: 'Lítil breyting' };
  const cooling = Math.sign(d) === m.cool;
  const n = m.dec ? abs.toFixed(m.dec).replace('.', ',') : String(Math.round(abs));
  const unit = key === 'dagar' && Math.round(abs) % 10 === 1 && Math.round(abs) % 100 !== 11 ? 'dagur' : m.unitChg;
  return { dir: cooling ? -1 : 1, text: `${d > 0 ? '↑' : '↓'} ${n} ${unit}` };
}

function mhSummary(svaedi, c, changes) {
  if (svaedi === 'skorr') {
    const p = c.cur.soluhlutfall != null ? mhFmt(c.cur.soluhlutfall, 'soluhlutfall') : null;
    const nuna = c.nuna?.dagar != null ? ` og þau sem eru á sölu núna hafa verið þar í um ${fmtInt(Math.round(c.nuna.dagar / 10) * 10)} daga` : '';
    return (p ? `Sumarhús seljast að jafnaði á um ${p} af ásettu verði${nuna}.` : '') + ' Fáar sölur, svo tölurnar sveiflast milli tímabila.';
  }
  const parts = { yfir_asettu: ['færri eignir seljast yfir ásettu verði', 'fleiri eignir seljast yfir ásettu verði'],
                  soluhlutfall: ['afslættir aukast', 'afslættir minnka'],
                  dagar: ['eignir eru lengur á sölu', 'eignir seljast hraðar'],
                  laekkad: ['fleiri seljendur lækka verð', 'færri seljendur lækka verð'] };
  const list = c.keys.filter(k => changes[k].dir !== 0).map(k => parts[k][changes[k].dir < 0 ? 0 : 1]);
  if (!list.length) return 'Litlar breytingar frá sama tíma í fyrra.';
  const txt = list.length === 1 ? list[0] : list.slice(0, -1).join(', ') + ' og ' + list[list.length - 1];
  return txt.charAt(0).toUpperCase() + txt.slice(1) + ' en á sama tíma í fyrra.';
}

function mhHeadline(level, changes) {
  const v = Object.values(changes), cool = v.filter(c => c.dir < 0).length, warm = v.filter(c => c.dir > 0).length;
  if (level === 0) return 'Rólegur markaður – kaupendur hafa samningsstöðu';
  if (cool >= 2 && cool > warm) return 'Markaðurinn er að kólna';
  if (warm >= 2 && warm > cool) return 'Markaðurinn er að hitna';
  return ['', 'Frekar rólegur markaður', 'Markaðurinn er í jafnvægi', 'Mikil eftirspurn – seljendur hafa yfirhöndina', 'Mikil eftirspurn – seljendur hafa yfirhöndina'][level];
}

function mhRender() {
  if (!MH.data) return;
  const sv = MH.svaedi, c = mhCompute(sv), isH = sv !== 'skorr';
  document.querySelectorAll('.mh-seg-btn').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.svaedi === sv)));

  const changes = Object.fromEntries(c.keys.map(k => [k, mhChange(k, c.cur[k], c.prev[k])]));
  const level = mhLevel(c.cur.soluhlutfall);
  document.getElementById('mh-period').textContent = c.period;
  document.getElementById('mh-headline').textContent = mhHeadline(level, changes);
  document.getElementById('mh-summary').textContent = mhSummary(sv, c, changes);
  document.getElementById('mh-heatlabel').textContent = MH_SCALE[level].label;
  document.getElementById('mh-scale').innerHTML = MH_SCALE.map((s, i) =>
    `<div${i === level ? ' class="on"' : ''}><i style="background:${s.bg}"></i><span>${s.label}</span></div>`).join('');

  // Lykiltölur
  const cards = c.keys.map(k => {
    const m = MH_METRICS[k], ch = changes[k];
    const cls = ch.dir < 0 ? 'k-down' : ch.dir > 0 ? 'k-up' : '';
    // Breyting sýnd sem tala með formerki (hækkun/lækkun), litur segir kólnun/hlýnun
    return `<div><dt>${m.kpi}</dt>
      <dd class="k-kvrow"><b>${mhFmt(c.cur[k], k)}</b><span class="${cls}">${ch.text.replace('↑ ', '+').replace('↓ ', '−')}</span></dd>
      <dd class="k-ks">${c.refLabel}: ${mhFmt(c.prev[k], k)}</dd></div>`;
  });
  if (!isH && c.nuna) {
    cards.push(`<div><dt>Á sölu núna, tími á sölu</dt>
      <dd class="k-kvrow"><b>${fmtInt(c.nuna.dagar)}</b><span style="font-weight:400;color:var(--k-muted)">dagar</span></dd>
      <dd class="k-ks">${fmtInt(c.nuna.laekkad)}% hafa lækkað ásett verð</dd></div>`);
  }
  document.getElementById('mh-kpis').innerHTML = cards.join('');

  // Val á mælikvarða
  if (!c.keys.includes(MH.metric)) MH.metric = c.keys[0];
  document.getElementById('mh-metrics').innerHTML = c.keys.map(k =>
    `<button type="button" class="mh-pill" data-metric="${k}" aria-pressed="${k === MH.metric}">${MH_METRICS[k].label}</button>`).join('');
  mhRenderChart(c);
}

function mhRenderChart(c) {
  const k = MH.metric, m = MH_METRICS[k], isH = MH.svaedi !== 'skorr';
  const W = 1000, H = 240, pct = (v, of) => +(v / of * 100).toFixed(1);
  document.getElementById('mh-chart-title').textContent = 'Þróun: ' + m.label.toLowerCase();
  let svg, labels, legend, aria, note, rows;
  if (isH) {
    // Mánuðir þessa árs (heilir) bornir saman við sömu mánuði árið áður
    const cur = c.fullMonths, y1 = mhYm(cur[cur.length - 1].timabil).slice(0, 4), y0 = String(y1 - 1);
    const by = Object.fromEntries(c.series.map(r => [mhYm(r.timabil), r[k] == null ? null : Number(r[k])]));
    const mon = [...Array(12).keys()].map(i => String(i + 1).padStart(2, '0'));
    const a0 = mon.map(mm => by[`${y0}-${mm}`] ?? null);
    const a1 = mon.map(mm => cur.some(r => mhYm(r.timabil) === `${y1}-${mm}`) ? by[`${y1}-${mm}`] ?? null : null);
    const all = [...a0, ...a1].filter(v => v != null), span = Math.max(...all) - Math.min(...all) || 1;
    const lo = Math.min(...all) - span * .25, hi = Math.max(...all) + span * .25;
    const x = i => +(i / 11 * W).toFixed(1), yv = v => +(H - (v - lo) / (hi - lo) * H).toFixed(1);
    const path = a => a.map((v, i) => v == null ? null : [x(i), yv(v)]).filter(Boolean).map((p, i) => (i ? 'L' : 'M') + p[0] + ' ' + p[1]).join(' ');
    const grid = [lo + (hi - lo) * .25, (lo + hi) / 2, lo + (hi - lo) * .75];
    svg = `${grid.map(g => `<line x1="0" x2="${W}" y1="${yv(g)}" y2="${yv(g)}" stroke="#D5DCDC" vector-effect="non-scaling-stroke"/>`).join('')}
      <path d="${path(a0)}" fill="none" stroke="#8B98A0" stroke-width="2" stroke-dasharray="6 5" vector-effect="non-scaling-stroke"/>
      <path d="${path(a1)}" fill="none" stroke="#1C2B33" stroke-width="2.5" vector-effect="non-scaling-stroke"/>
      ${a1.map((v, i) => v == null ? '' : `<circle cx="${x(i)}" cy="${yv(v)}" r="4" fill="#1C2B33" stroke="#F2F4F1" stroke-width="2" vector-effect="non-scaling-stroke"><title>${MAN_LANGT[i]} ${y1}: ${mhFmt(v, k)} (${y0}: ${mhFmt(a0[i], k)})</title></circle>`).join('')}`;
    labels = grid.map(g => `<span class="k-yl" style="top:${pct(yv(g), H)}%;left:auto;right:0">${mhFmt(g, k)}</span>`).join('')
      + MAN_STUTT.map((l, i) => `<span class="k-xl${i % 3 ? ' mid' : ''}" style="left:${pct(x(i), W)}%">${l}</span>`).join('');
    legend = `<span><i style="border-top:2px dashed #8B98A0"></i>${y0}</span><span><i style="height:3px;background:#1C2B33"></i>${y1}</span>`;
    const both = a1.map((v, i) => v != null && a0[i] != null ? Math.sign(v - a0[i]) : null).filter(v => v != null);
    const lower = both.filter(v => v < 0).length;
    note = both.length ? `Í ${lower} af ${both.length} mánuðum ${y1} var gildið lægra en sama mánuð ${y0}.` : '';
    if (MH.svaedi !== 'hofud') {
      const ns = cur.map(r => r.n);
      note += ` Fáar sölur á mánuði (${Math.min(...ns)}–${Math.max(...ns)}), svo einstakir mánuðir sveiflast meira en á höfuðborgarsvæðinu.`;
    }
    aria = `${m.label} eftir mánuðum ${y1} borið saman við ${y0}. ${y1}: ${a1.filter(v => v != null).map(v => mhFmt(v, k)).join(', ')}. Sömu mánuðir ${y0}: ${a0.slice(0, a1.filter(v => v != null).length).map(v => mhFmt(v, k)).join(', ')}.`;
    rows = mon.map((mm, i) => ({ p: MAN_LANGT[i].replace(/^./, ch => ch.toUpperCase()), a: a1[i], b: a0[i] })).filter(r => r.a != null || r.b != null);
    document.getElementById('mh-table').innerHTML = `<div class="k-tblbox"><table class="k-tbl"><caption class="k-sub" style="text-align:left;padding-bottom:6px">${m.label} eftir mánuðum</caption>
      <thead><tr><th scope="col">Mánuður</th><th scope="col" class="r">${y1}</th><th scope="col" class="r">${y0}</th></tr></thead>
      <tbody>${rows.map(r => `<tr><th scope="row" style="text-align:left;font-weight:500">${r.p}</th><td class="r">${mhFmt(r.a, k)}</td><td class="r">${mhFmt(r.b, k)}</td></tr>`).join('')}</tbody></table></div>`;
  } else {
    // Skorradalur: hálf ár (of fáar sölur á mánuði)
    const pts = c.series.map(r => ({ v: r[k] == null ? null : Number(r[k]), n: r.n, p: (c.halfName(r) + (c.isFull(r) ? '' : ' (til þessa)')).replace(/^./, ch => ch.toUpperCase()),
      x: (mhYm(r.timabil).slice(5) === '01' ? 'fyrri' : 'seinni') + ' ’' + r.timabil.slice(2, 4) }));
    const all = pts.map(p => p.v).filter(v => v != null), span = Math.max(...all) - Math.min(...all) || 1;
    const lo = Math.max(0, Math.min(...all) - span * .25), hi = Math.max(...all) + span * .25, n = pts.length;
    const x = i => +((i + .5) / n * W).toFixed(1), yv = v => +(H - (v - lo) / (hi - lo) * H).toFixed(1);
    const grid = [lo + (hi - lo) * .25, (lo + hi) / 2, lo + (hi - lo) * .75];
    svg = `${grid.map(g => `<line x1="0" x2="${W}" y1="${yv(g)}" y2="${yv(g)}" stroke="#D5DCDC" vector-effect="non-scaling-stroke"/>`).join('')}
      <path d="${pts.map((p, i) => p.v == null ? null : [x(i), yv(p.v)]).filter(Boolean).map((p, i) => (i ? 'L' : 'M') + p[0] + ' ' + p[1]).join(' ')}" fill="none" stroke="var(--k-skorr)" stroke-width="2.5" vector-effect="non-scaling-stroke"/>
      ${pts.map((p, i) => p.v == null ? '' : `<circle cx="${x(i)}" cy="${yv(p.v)}" r="4" fill="var(--k-skorr)" stroke="#F2F4F1" stroke-width="2" vector-effect="non-scaling-stroke"><title>${p.p}: ${mhFmt(p.v, k)} (${p.n} sölur)</title></circle>`).join('')}`;
    labels = grid.map(g => `<span class="k-yl" style="top:${pct(yv(g), H)}%;left:auto;right:0">${mhFmt(g, k)}</span>`).join('')
      + pts.map((p, i) => `<span class="k-xl${i && i < n - 1 ? ' mid' : ''}" style="left:${pct(x(i), W)}%">${p.x}</span>`).join('');
    legend = `<span><i style="height:3px;background:var(--k-skorr)"></i>Sumarhús í Skorradal, eftir hálfum árum</span>`;
    note = `Fáar sölur (${Math.min(...pts.map(p => p.n))}–${Math.max(...pts.map(p => p.n))} á hverju tímabili), svo tölurnar sveiflast mikið milli tímabila.`;
    aria = `${m.label} eftir hálfum árum: ${pts.map(p => `${p.p} ${mhFmt(p.v, k)}`).join(', ')}.`;
    document.getElementById('mh-table').innerHTML = `<div class="k-tblbox"><table class="k-tbl"><caption class="k-sub" style="text-align:left;padding-bottom:6px">${m.label} eftir hálfum árum</caption>
      <thead><tr><th scope="col">Tímabil</th><th scope="col" class="r">${m.label}</th><th scope="col" class="r">Seldar eignir</th></tr></thead>
      <tbody>${pts.map(p => `<tr><th scope="row" style="text-align:left;font-weight:500">${p.p}</th><td class="r">${mhFmt(p.v, k)}</td><td class="r">${fmtInt(p.n)}</td></tr>`).join('')}</tbody></table></div>`;
  }
  document.getElementById('mh-chart').innerHTML = `<div class="k-legend">${legend}</div>
    <div class="k-chart"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="height:240px" role="img" aria-label="${aria}">${svg}
      <line x1="0" x2="${W}" y1="${H}" y2="${H}" stroke="#1C2B33" vector-effect="non-scaling-stroke"/></svg>${labels}</div>
    <p class="k-figp" style="margin-top:34px">${note}</p>`;
  document.getElementById('mh-chart').hidden = MH.table;
  document.getElementById('mh-table').hidden = !MH.table;
  const tb = document.getElementById('mh-table-btn');
  tb.setAttribute('aria-pressed', String(MH.table));
  tb.textContent = MH.table ? 'Sýna sem graf' : 'Sýna sem töflu';
}

async function initHiti() {
  if (MH.data) return mhRender();
  const data = await mhLoad().catch(() => null);
  if (!data?.length) {
    document.getElementById('mh-headline').textContent = 'Ekki tókst að sækja gögn. Reyndu aftur síðar.';
    return;
  }
  MH.data = data;
  // Hnappar annarra svæða en höfuðborgarsvæðisins aðeins ef tölur eru komnar (n8n reiknar á nóttunni)
  for (const sv of ['akureyri', 'reykjanesbaer', 'selfoss', 'akranes'])
    document.querySelector(`.mh-seg-btn[data-svaedi="${sv}"]`).hidden = !data.some(r => r.svaedi === sv);
  mhRender();
}

document.addEventListener('click', e => {
  const seg = e.target.closest('.mh-seg-btn');
  if (seg) { MH.svaedi = seg.dataset.svaedi; return mhRender(); }
  const pill = e.target.closest('.mh-pill');
  if (pill) { MH.metric = pill.dataset.metric;
    document.querySelectorAll('.mh-pill').forEach(b => b.setAttribute('aria-pressed', String(b === pill)));
    return mhRenderChart(mhCompute(MH.svaedi)); }
  if (e.target.closest('#mh-table-btn')) { MH.table = !MH.table; return mhRenderChart(mhCompute(MH.svaedi)); }
});

// ============================================================
// VERÐMAT – „Hvað er eignin mín virði?“
// fasteignamat × miðgildi (söluverð / mat) í nýlegum sölum í hverfinu.
// Bilið = 25.–75. hundraðshluti. Gögn: RPC leita_eign, eignir_a_heimilisfangi, get_verdmat.
// ============================================================
const VM_POSTNR = [
  [101, 'Reykjavík'], [102, 'Reykjavík'], [103, 'Reykjavík'], [104, 'Reykjavík'], [105, 'Reykjavík'],
  [107, 'Reykjavík'], [108, 'Reykjavík'], [109, 'Reykjavík'], [110, 'Reykjavík'], [111, 'Reykjavík'],
  [112, 'Reykjavík'], [113, 'Reykjavík'], [116, 'Reykjavík'], [170, 'Seltjarnarnes'],
  [200, 'Kópavogur'], [201, 'Kópavogur'], [203, 'Kópavogur'], [210, 'Garðabær'], [225, 'Garðabær'],
  [220, 'Hafnarfjörður'], [221, 'Hafnarfjörður'], [270, 'Mosfellsbær'], [271, 'Mosfellsbær'], [276, 'Mosfellsbær'],
  [230, 'Reykjanesbær'], [233, 'Reykjanesbær'], [260, 'Reykjanesbær'], [262, 'Reykjanesbær'],
  [800, 'Selfoss'], [801, 'Selfoss'], [300, 'Akranes'],
  [600, 'Akureyri'], [603, 'Akureyri']
];
const VM_TEG = { 'Fjölbýli': ['Íbúð', 'íbúðir í fjölbýli'], 'Sérbýli': ['Sérbýli', 'sérbýli'], 'Einbýli': ['Einbýli', 'einbýlishús'] };
const VM = { mode: 'addr', addr: null, units: [], unit: null, qseq: 0, cseq: 0, ready: false };

const vmEsc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const vmPct = r => (r * 100).toFixed(1).replace('.', ',') + '%';
const vmM2 = m => String(Math.round(m * 10) / 10).replace('.', ',') + ' m²';
const vmPostTxt = p => { const x = VM_POSTNR.find(a => a[0] === p); return p + (x ? ' ' + x[1] : ''); };

function initVerdmat() {
  if (VM.ready) return;
  VM.ready = true;
  const sel = document.getElementById('vm-postnr');
  sel.innerHTML = VM_POSTNR.map(([p, n]) => `<option value="${p}">${p} ${n}</option>`).join('');
  sel.value = '105';

  let t;
  document.getElementById('vm-q').addEventListener('input', e => {
    clearTimeout(t);
    t = setTimeout(() => vmSearch(e.target.value), 250);
  });
  document.getElementById('vm-manual').addEventListener('submit', e => { e.preventDefault(); vmManual(); });
}

function vmSetMode(mode) {
  VM.mode = mode;
  document.querySelectorAll('.vm-mode').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
  document.getElementById('vm-addr').hidden = mode !== 'addr';
  document.getElementById('vm-manual').hidden = mode !== 'manual';
}

async function vmSearch(q) {
  const box = document.getElementById('vm-results');
  q = q.split(',')[0].trim();
  if (q.length < 3) { box.innerHTML = ''; return; }
  const seq = ++VM.qseq;
  const { data: rows } = await API.rpc('leita_eign', { p_q: q });
  if (seq !== VM.qseq) return;                                   // nýrri leit komin af stað
  if (!rows) { box.innerHTML = '<p class="vm-help">Ekki tókst að leita. Reyndu aftur síðar.</p>'; return; }
  if (!rows.length) { box.innerHTML = '<p class="vm-help">Ekkert heimilisfang fannst sem byrjar svona.</p>'; return; }
  box.innerHTML = '<ul class="vm-list">' + rows.map(r =>
    `<li><button type="button" class="vm-opt vm-addr-btn" data-h="${vmEsc(r.heimilisfang)}" data-p="${r.postnr}">
      <span class="vm-opt-main">${vmEsc(r.heimilisfang)}, ${vmEsc(vmPostTxt(r.postnr))}</span>
      <span class="vm-opt-side">${r.eignir} ${r.eignir === 1 ? 'eign' : 'eignir'}</span>
    </button></li>`).join('') + '</ul>';
}

async function vmPickAddr(h, p) {
  const box = document.getElementById('vm-results');
  document.getElementById('vm-q').value = h;
  box.innerHTML = '<p class="vm-help">Sæki eignir…</p>';
  ++VM.qseq;                                                    // hunsa eldri leitarniðurstöður
  const { data: units } = await API.rpc('eignir_a_heimilisfangi', { p_heimilisfang: h, p_postnr: p });
  if (!units?.length) { box.innerHTML = '<p class="vm-help">Ekki tókst að sækja eignir. Reyndu aftur síðar.</p>'; return; }
  units.sort((a, b) => a.einflm - b.einflm || a.fasteignamat - b.fasteignamat);
  VM.addr = { h, p };
  VM.units = units;
  vmRenderUnits();
  if (units.length === 1) vmPickUnit(0);
}

function vmRenderUnits() {
  const { h, p } = VM.addr;
  const n = VM.units.length;
  document.getElementById('vm-results').innerHTML =
    `<p class="vm-help vm-help-dk">${n === 1 ? '1 eign' : n + ' eignir'} fundust á ${vmEsc(h)}, ${vmEsc(vmPostTxt(p))}${n > 1 ? ' – veldu þína:' : ''}</p>
     <ul class="vm-list">` + VM.units.map((u, i) =>
    `<li><button type="button" class="vm-opt vm-unit-btn" data-i="${i}" aria-pressed="${VM.unit === i}">
      <span class="vm-opt-txt">
        <span class="vm-opt-main">${VM_TEG[u.tegund]?.[0] || 'Eign'}, ${vmM2(u.einflm)}</span>
        <span class="vm-opt-sub">${u.byggar ? 'Byggt ' + u.byggar + ', f' : 'F'}astanúmer F${vmEsc(u.fastnum)}</span>
      </span>
      <span class="vm-opt-side">Mat ${fmtMkr(u.fasteignamat)}</span>
    </button></li>`).join('') + '</ul>';
}

function vmPickUnit(i) {
  VM.unit = i;
  vmRenderUnits();
  const u = VM.units[i];
  vmCompute({
    mat: u.fasteignamat, mat27: u.fasteignamat_2027, postnr: VM.addr.p, tegund: u.tegund,
    einflm: u.einflm, fastnum: u.fastnum,
    title: `${VM.addr.h}, ${(VM_TEG[u.tegund]?.[0] || 'eign').toLowerCase()} ${vmM2(u.einflm)}`
  });
}

// Tekur „68.000.000“, „68000000“, „68000“ (þ.kr) eða „68“ (m.kr) → þ.kr
function vmParseMat(s) {
  const n = parseInt(String(s).replace(/\D/g, ''), 10);
  if (!n) return null;
  if (n >= 1e6) return Math.round(n / 1000);
  if (n >= 1000) return n;
  return n * 1000;
}

function vmManual() {
  const err = document.getElementById('vm-mat-err');
  const mat = vmParseMat(document.getElementById('vm-mat').value);
  if (!mat || mat < 5000 || mat > 1000000) {
    err.textContent = 'Sláðu inn fasteignamat í krónum, t.d. 68.000.000.';
    document.getElementById('vm-mat').setAttribute('aria-invalid', 'true');
    return;
  }
  err.textContent = '';
  document.getElementById('vm-mat').removeAttribute('aria-invalid');
  const postnr = parseInt(document.getElementById('vm-postnr').value, 10);
  const tegund = document.getElementById('vm-tegund').value;
  vmCompute({ mat, postnr, tegund, title: `${VM_TEG[tegund][1].replace(/^./, c => c.toUpperCase())}, ${vmPostTxt(postnr)}` });
}

async function vmCompute(e) {
  const body = document.getElementById('vm-res-body');
  document.getElementById('vm-res-sub').textContent = '';
  body.innerHTML = '<p class="vm-empty">Reikna…</p>';
  const seq = ++VM.cseq;
  const args = { p_postnr: e.postnr, p_tegund: e.tegund, p_einflm: e.einflm ?? null, p_fastnum: e.fastnum ?? null };
  let { data: d, error } = await API.rpc('get_verdmat', args);
  // Fyrsta kall eftir hlé getur runnið á tímamörk; annað kall er yfirleitt hratt
  if (error && seq === VM.cseq) {
    await new Promise(r => setTimeout(r, 800));
    if (seq !== VM.cseq) return;
    ({ data: d } = await API.rpc('get_verdmat', args));
  }
  if (seq !== VM.cseq) return;
  if (!d || !d.p50) { body.innerHTML = '<p class="vm-empty">Ekki tókst að reikna verðmat. Reyndu aftur síðar.</p>'; return; }

  const lo = e.mat * d.p25, mid = e.mat * d.p50, hi = e.mat * d.p75;
  const mark = 12 + (d.p50 - d.p25) / ((d.p75 - d.p25) || 1) * 76;
  const teg = VM_TEG[e.tegund][1];
  const hvar = d.svaedi === 'postnr' ? `í ${e.postnr}`
             : d.svaedi === 'sveitarfelag' ? `í sama sveitarfélagi (of fáar sölur í ${e.postnr} einu)`
             : `${{ akureyri: 'á Akureyri', reykjanesbaer: 'í Reykjanesbæ', selfoss: 'á Selfossi', akranes: 'á Akranesi' }[d.svaedi] || 'á höfuðborgarsvæðinu'} (of fáar sölur í ${e.postnr} einu)`;
  const breyt27 = e.mat27 ? (e.mat27 / e.mat - 1) * 100 : null;

  document.getElementById('vm-res-sub').textContent = e.title;
  body.innerHTML = `
    <div class="k-vbig">${fmtMkr(mid)}</div>
    <p class="k-vrange">Líklegt bil: <strong>${fmtMkr(lo)} – ${fmtMkr(hi)}</strong></p>
    <div class="k-vbar" role="img" aria-label="Áætlað verð ${fmtMkr(mid)}, líklegt bil ${fmtMkr(lo)} til ${fmtMkr(hi)}.">
      <i class="k-vbar-axis"></i><i class="k-vbar-band"></i><i class="k-vbar-mark" style="left:${mark.toFixed(1)}%"></i>
    </div>
    <div class="k-vbar-ends"><span>${fmtMkr(lo)}</span><span>${fmtMkr(hi)}</span></div>
    <dl class="k-vfacts">
      <div><dt>Fasteignamat 2026</dt><dd>${fmtMkr(e.mat)}</dd></div>
      <div><dt>Sölur ${d.svaedi === 'postnr' ? 'í ' + e.postnr : 'á svæðinu'}, % af mati</dt><dd>${vmPct(d.p50)}</dd></div>
      ${e.mat27 ? `<div><dt>Fasteignamat 2027</dt><dd>${fmtMkr(e.mat27)} <small>${breyt27 >= 0 ? '+' : '−'}${Math.abs(breyt27).toFixed(1).replace('.', ',')}%</small></dd></div>` : ''}
    </dl>
    <p class="k-figp" style="margin-top:18px">${teg.replace(/^./, c => c.toUpperCase())} ${hvar} seldust að jafnaði á ${vmPct(d.p50)} af fasteignamati síðustu 12 mánuði (${fmtInt(d.n)} sölur). Helmingur seldist á ${vmPct(d.p25)}–${vmPct(d.p75)} af mati, og það er bilið. Ástand, útsýni og innréttingar ráða hvar í bilinu eignin lendir.</p>`;

  // Sambærilegar sölur
  const cBox = document.getElementById('vm-comps-box');
  cBox.hidden = false;
  document.getElementById('vm-comps-sub').textContent =
    `${teg.replace(/^./, c => c.toUpperCase())} í ${e.postnr}${e.einflm ? `, ${Math.round(e.einflm * 0.8)}–${Math.round(e.einflm * 1.2)} m²` : ''}, nýjustu sölur síðustu 12 mánuði.`;
  document.getElementById('vm-comps').innerHTML = d.samb.length ? `
    <table class="k-tbl k-tbl-vm">
      <thead><tr><th scope="col">Gata</th><th scope="col">Þinglýst</th><th scope="col" class="r">Stærð</th><th scope="col" class="r">Byggt</th><th scope="col" class="r">Söluverð</th><th scope="col" class="r">% af mati</th></tr></thead>
      <tbody>${d.samb.map(s => `<tr>
        <th scope="row" class="c-eign" style="text-align:left;font-weight:600">${vmEsc(s.gata)}</th><td class="c-d" style="color:var(--k-muted)">${fmtDagAr(s.thinglystdags)}</td>
        <td class="c-staerd r">${vmM2(s.einflm)}</td><td class="c-b r">${s.byggar || '–'}</td>
        <td class="c-selt r" style="font-weight:700">${fmtMkr(s.kaupverd)}</td><td class="c-r r ${s.r >= 1 ? 'k-up' : 'k-down'}" style="font-weight:600">${vmPct(s.r)}</td></tr>`).join('')}
      </tbody></table>`
    : '<p class="k-sub">Engar sambærilegar sölur í þessu póstnúmeri síðustu 12 mánuði.</p>';

  // Fyrri sölur eignarinnar
  const sBox = document.getElementById('vm-saga-box');
  sBox.hidden = !d.saga.length;
  document.getElementById('vm-saga').innerHTML = d.saga.map(s =>
    `<li><span>${fmtDagLangt(s.thinglystdags)}</span><b>${fmtMkr(s.kaupverd)}</b></li>`).join('');
}

document.addEventListener('click', e => {
  const m = e.target.closest('.vm-mode');
  if (m) return vmSetMode(m.dataset.mode);
  const a = e.target.closest('.vm-addr-btn');
  if (a) return vmPickAddr(a.dataset.h, parseInt(a.dataset.p, 10));
  const u = e.target.closest('.vm-unit-btn');
  if (u) return vmPickUnit(parseInt(u.dataset.i, 10));
});

// ---- Tab switching ----
const VIEW_HASH = { yfirlit: 'yfirlit', hofud: 'hofud', akureyri: 'akureyri', reykjanesbaer: 'reykjanesbaer', selfoss: 'selfoss', akranes: 'akranes', sumar: 'skorradalur', hiti: 'markadshiti', verdmat: 'verdmat' };
// Titill vafraflipa (og sögu) eftir flipa; forsíðan heldur aðaltitlinum
const VIEW_TITLE = { hofud: 'Höfuðborgarsvæðið', akureyri: 'Akureyri', reykjanesbaer: 'Reykjanesbær', selfoss: 'Selfoss', akranes: 'Akranes', sumar: 'Skorradalur', hiti: 'Markaðshiti', verdmat: 'Verðmat' };
// Önnur þéttbýlissvæði nota sama skjáhluta og höfuðborgarsvæðið (view-hofud)
const VIEW_DOM = { akureyri: 'hofud', reykjanesbaer: 'hofud', selfoss: 'hofud', akranes: 'hofud' };

// Fellilisti svæðis: valkostir höfuðborgarsvæðis teknir úr index.html, annarra svæða úr SVAEDI
SVAEDI.hofud.valkostir = document.getElementById('hofud-postnr').innerHTML;
document.querySelector('.tab-btn[data-view="svaedi"]').style.setProperty('--k-svaedi', SVAEDI.hofud.col.c);
function khSetSvaedi(sv) {
  if (hofudSvaedi === sv) return;
  hofudSvaedi = sv;
  hofudReady = false;
  document.getElementById('hofud-postnr').innerHTML = SVAEDI[sv].valkostir;
  document.getElementById('view-hofud').dataset.svaedi = sv;   // CSS skiptir um lit
  document.querySelectorAll('.kh-seg [data-sv]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.sv === sv)));
  document.querySelector('.tab-btn[data-view="svaedi"]').style.setProperty('--k-svaedi', SVAEDI[sv].col.c);
}
function khInitFromForm() {
  const postnr = parseInt(document.getElementById('hofud-postnr').value, 10);
  initHofud(hofudSvaedi, postnr, document.getElementById('hofud-tegund').value);
}

function showView(view, { push = true } = {}) {
  if (!VIEW_HASH[view]) view = 'yfirlit';
  const dom = VIEW_DOM[view] || view;
  document.querySelectorAll('.tab-btn').forEach(b => {
    const on = b.dataset.view === (dom === 'hofud' ? 'svaedi' : view);   // öll þéttbýlissvæðin undir „Svæði“
    b.classList.toggle('active', on);
    if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + dom));

  document.title = VIEW_TITLE[view] ? `${VIEW_TITLE[view]} – Fasteignavaktin` : 'Fasteignavaktin – fasteignaverð í tölum';

  const subEl = document.getElementById('header-sub');
  if (subEl) subEl.textContent = SUB_TEXTS[view] || '';
  if (push && location.hash !== '#' + VIEW_HASH[view]) history.pushState(null, '', '#' + VIEW_HASH[view]);

  if (view === 'yfirlit') initYfirlit();
  else if (view === 'hiti') initHiti();
  else if (view === 'verdmat') initVerdmat();
  else if (view === 'sumar') initSumar();
  else if (dom === 'hofud') { khSetSvaedi(view); khInitFromForm(); }
}

function viewFromHash() {
  const h = location.hash.replace('#', '');
  return Object.keys(VIEW_HASH).find(k => VIEW_HASH[k] === h) || 'yfirlit';
}

// „Svæði“ opnar síðasta valda svæðið (höfuðborgarsvæðið í byrjun); hvert svæði hefur áfram eigin slóð (#selfoss o.s.frv.)
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => showView(btn.dataset.view === 'svaedi' ? hofudSvaedi : btn.dataset.view));
});
document.querySelectorAll('.kh-seg [data-sv]').forEach(btn => {
  btn.addEventListener('click', () => { if (btn.dataset.sv !== hofudSvaedi) showView(btn.dataset.sv); });
});
document.querySelectorAll('[data-goto]').forEach(a => {
  a.addEventListener('click', e => { e.preventDefault(); showView(a.dataset.goto); window.scrollTo({ top: 0, behavior: 'smooth' }); });
});
window.addEventListener('popstate', () => showView(viewFromHash(), { push: false }));

// ---- Postnr dropdown ----
// ---- Verðmatsleit á forsíðu → Verðmat-flipinn með sömu leit ----
document.getElementById('k-vm-form').addEventListener('submit', e => {
  e.preventDefault();
  const q = document.getElementById('k-vm-q').value.trim();
  showView('verdmat');
  window.scrollTo({ top: 0 });
  const inp = document.getElementById('vm-q');
  inp.value = q;
  inp.focus();
  if (q) vmSearch(q);
});

// ---- Svæði og tegund (þéttbýlissvæðin í SVAEDI) ----
document.getElementById('hofud-postnr').addEventListener('change', () => { hofudReady = false; khInitFromForm(); });
document.getElementById('hofud-tegund').addEventListener('change', () => { hofudReady = false; khInitFromForm(); });

// ---- Götuleit í Skorradal ----
let _streetFilterTimer = null;
document.addEventListener('input', e => {
  if (e.target.id !== 'avs-filter') return;
  clearTimeout(_streetFilterTimer);
  _streetFilterTimer = setTimeout(() => ksFilter(e.target.value), 200);
});

// ---- Startup: forsíða nema slóðin vísi á svæði (#hofud, #skorradalur) ----
showView(viewFromHash(), { push: false });
