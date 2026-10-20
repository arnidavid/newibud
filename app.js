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

// Sumarhúsasvæði: sami flipi (view-sumar) með svæðavali, hvert svæði með eigin slóð.
// Lykillinn 'sumar' er Skorradalur (eldri slóð #skorradalur og data-sv="sumar" á forsíðu haldast).
// hverfi: litlu gröfin í „Hverfin“ – aðeins handvalin fyrir Skorradal enn sem komið er.
const SUMAR = {
  sumar: {
    nafn: 'Skorradalur', postnr: 311, stadur: 'í Skorradal', i_txt: '311 Skorradal',
    lead: 'Sumarhús í póstnúmeri 311, við Skorradalsvatn og í stærsta skógi landsins.',
    hverfi: ['Fitjahlíð', 'Dagverðarnes', 'Vatnsendahlíð'],
    col: { c: '#00897b', tx: '#00695E', fill: '#E4F2EF', fill2: '#9FD0C8' }
  },
  grimsnes: {
    nafn: 'Grímsnes', postnr: 805, stadur: 'í Grímsnesi', i_txt: '805 Grímsnesi',
    lead: 'Sumarhús í Grímsnes- og Grafningshreppi, póstnúmeri 805. Hvergi á landinu seljast fleiri sumarhús.',
    col: { c: '#A88400', tx: '#6E5600', fill: '#F5EFD6', fill2: '#D9C77F' }
  },
  blaskogar: {
    nafn: 'Bláskógabyggð', postnr: 806, stadur: 'í Bláskógabyggð', i_txt: '806 Bláskógabyggð',
    lead: 'Sumarhús í Bláskógabyggð, póstnúmeri 806.',
    col: { c: '#55687D', tx: '#3B4A5B', fill: '#E8ECF0', fill2: '#AEB9C5' }
  }
};
// ---- Sumarhúsaflipinn (kortastefna); KS.sv = valið svæði ----
const KS = { sv: 'sumar', rows: [], real: false };
const ksS = () => SUMAR[KS.sv];

function ksFjall() {
  const col = ksS().col;
  const by = yearStatsFromRows(KS.rows, 10, 2000), last = kLastYear(by), years = [];
  for (let y = 2008; y <= last; y++) years.push(y);
  const nom = years.map(y => kAvg(by, y));
  const vals = KS.real ? nom.map((v, i) => v ? toReal(v, years[i]) : null) : nom;
  let hi = 0; vals.forEach((v, i) => { if (v && v > (vals[hi] || 0)) hi = i; });
  const v1 = vals[vals.length - 1];
  document.getElementById('ks-now').innerHTML = v1 ? `<b style="color:${col.tx}">${fmtInt(v1)}</b><span>þ.kr/m² árið ${last}${KS.real ? ' á verðlagi 2024' : ''}${hi !== vals.length - 1 ? `, hæst ${fmtInt(vals[hi])} árið ${years[hi]}` : ''}</span>` : '';
  kProfile(document.getElementById('ks-fjall'), years, vals, col,
    { ariaLabel: `Fermetraverð sumarhúsa ${ksS().stadur} ${years[0]} til ${last}${KS.real ? ' á verðlagi 2024' : ''}: úr ${fmtInt(vals[0])} í ${fmtInt(v1)} þúsund krónur, hæst ${fmtInt(vals[hi])} árið ${years[hi]}.` });

  const n = years.map(y => by[y]?.nAll || 0);
  let nmax = 0; n.forEach((v, i) => { if (v > n[nmax]) nmax = i; });
  document.getElementById('ks-bars-t').textContent = `flestar ${n[nmax]} árið ${years[nmax]}, ${n[n.length - 1]} það sem af er ${last}`;
  kBars(document.getElementById('ks-bars'), years, n, col, `Fjöldi sölna á ári ${years[0]} til ${last}, flestar ${n[nmax]} árið ${years[nmax]}.`);

  const mat = years.map(y => {
    const r = KS.rows.filter(x => new Date(x.thinglystdags).getFullYear() === y && x.fasteignamat > 0 && x.kaupverd > 1000);
    return r.length ? Math.round(r.reduce((a, x) => a + x.kaupverd / x.fasteignamat * 100, 0) / r.length) : null;
  });
  const mLast = mat[mat.length - 1];
  document.getElementById('ks-mat-t').textContent = mLast ? `${mLast}% árið ${last}; brotna línan er 100%` : '';
  kLine(document.getElementById('ks-mat'), years, mat, col, { ref: 100, fmt: v => v + '%',
    ariaLabel: `Söluverð sem hlutfall af fasteignamati ${years[0]} til ${last}.` });
}

// Hverfin: lítil gröf í sama lit; punktur stærri með fleiri sölum, holur ef færri en 3
function ksHverfi() {
  const sec = document.getElementById('ks-hv-sec'), hverfi = ksS().hverfi || [], col = ksS().col;
  sec.hidden = !hverfi.length;
  if (!hverfi.length) return;
  const last = kLastYear(yearStatsFromRows(KS.rows, 10, 2000)), y0 = last - 10, W = 300, H = 150;
  const sx = y => +((y - y0) / 10 * W).toFixed(1), sy = v => +(H - v / 800 * H).toFixed(1);
  document.getElementById('ks-hverfi').innerHTML = hverfi.map(name => {
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
          <path d="${d.trim()}" fill="none" stroke="${col.c}" stroke-width="1.5" vector-effect="non-scaling-stroke"/>
          ${pts.map(p => `<circle cx="${sx(p.y)}" cy="${sy(p.v)}" r="${(2.5 + Math.sqrt(p.n) * 1.4).toFixed(1)}" fill="${p.n < 3 ? '#F2F4F1' : col.c}" stroke="${col.c}" stroke-width="1.5" vector-effect="non-scaling-stroke"><title>${p.y}: ${fmtInt(p.v)} þ.kr/m², ${p.n} ${p.n === 1 ? 'sala' : 'sölur'}</title></circle>`).join('')}
        </svg>
        <span class="k-xl" style="left:0;transform:none">${y0}</span>
        <span class="k-xl" style="left:100%;transform:translateX(-100%)">${last}</span>
      </div>
    </figure>`;
  }).join('');
}

// Auglýst og selt: nýjustu 20 sölur, ásett verð þar sem auglýsing fannst (pickListingForSale)
async function ksAvs() {
  const sv = KS.sv, postnr = ksS().postnr;
  const tb = document.getElementById('ks-avs'), sum = document.getElementById('ks-avs-sum');
  const { data: listings, error } = await API.getListingsDb(postnr, 'sumarhus');
  if (KS.sv !== sv) return;   // annað svæði valið á meðan
  if (error || !listings) { tb.innerHTML = '<tr><td colspan="5">Ekki tókst að sækja auglýsingar. Reyndu aftur síðar.</td></tr>'; return; }
  const byKey = {};
  for (const l of listings) for (const k of [l.fastnum && 'f:' + l.fastnum, 'a:' + normAddr(l.heimilisfang)]) if (k) (byKey[k] = byKey[k] || []).push(l);
  const sales = KS.rows.filter(r => r.einflm > 0 && r.kaupverd / r.einflm >= 10 && r.kaupverd / r.einflm <= 2000)
    .slice().sort((a, b) => new Date(b.thinglystdags) - new Date(a.thinglystdags)).slice(0, 20);
  const pairs = sales.map(sale => {
    const l = pickListingForSale({ ...sale, postnr }, [...(sale.fastnum ? byKey['f:' + sale.fastnum] || [] : []), ...(byKey['a:' + normAddr(sale.heimilisfang)] || [])]);
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

// Auglýsingar á sölu úr okkar gagnagrunni (RPC auglysingar_a_solu, safnað reglulega í n8n).
// Ein lína á söluferil: endurbirtingar sömu eignar teljast saman, svo dagar á sölu og lækkun
// miðast við fyrstu birtingu. ls.total / ls.midgildi / ls.nLk ná yfir allar auglýsingar,
// líka þegar aðeins `limit` nýjustu eru sóttar.
async function fetchAuglysingar(postnrs, tegundir, limit = 1000) {
  const { data, error } = await API.rpc('auglysingar_a_solu', { p_postnrs: postnrs, p_tegundir: tegundir, p_limit: limit });
  if (error || !data) { console.error('Auglýsingar:', error); return []; }
  const now = Date.now();
  const ls = data.map(r => {
    const sqm = Number(r.staerd) || 0, price = Number(r.verd) || 0, max = Number(r.haest_verd) || 0;
    const first = r.fyrst_birt ? new Date(r.fyrst_birt) : null;
    return {
      heimilisfang: r.heimilisfang || '?',
      verd_kr: price,
      staerd: sqm,
      fm_thkr: sqm > 0 && price > 0 ? Math.round(price / sqm / 1000) : 0,
      linkur: r.linkur,
      dags: first ? fmtDagAr(first) : '',
      dags_raw: first,
      dagar: first ? Math.max(0, Math.floor((now - first) / 864e5)) : null,
      haest_kr: max > price && price > 0 ? max : 0          // hæsta ásetta verð í ferlinum, ef hærra en núna
    };
  });
  ls.total = data.length ? Number(data[0].alls) : 0;
  ls.midgildi = data.length ? data[0].midgildi_daga : null;
  ls.nLk = data.length ? Number(data[0].n_laekkad) : 0;
  return ls;
}
const fmtDagar = n => `${fmtInt(n)} ${n % 10 === 1 && n % 100 !== 11 ? 'dag' : 'daga'}`;

// ============================================================
// ====  HÖFUÐBORGARSVÆÐI  ====================================
// ============================================================


// fm.verð filter for apartments (higher price range than sumarhús)
const H_FM_MIN = 50;
const H_FM_MAX = 5000;

const TEGUND_MAP = {
  all:   { teg: ['fjolb', 'einb', 'einbýlishús', 'raðpar', 'hæðir'], kaupskra: null },
  fjolb: { teg: ['fjolb'], kaupskra: 'Fjölbýli' },
  einb:  { teg: ['einb', 'einbýlishús'], kaupskra: 'Einbýli' },
  raðpar:{ teg: ['raðpar'], kaupskra: 'Sérbýli' },
};

// Þéttbýlissvæði: postnr 0 í fellilista = allt svæðið (listinn `allt`).
// 190 Vogar og 230 Reykjanesbær eru ekki á höfuðborgarsvæðinu; 270 Mosfellsbær er það.
const SVAEDI = {
  hofud: {
    nafn: 'Höfuðborgarsvæðið', allt_txt: 'á öllu höfuðborgarsvæðinu',
    allt: [101, 102, 103, 104, 105, 107, 108, 109, 110, 111, 112, 113, 116, 161, 162, 170,
           200, 201, 202, 203, 206, 210, 212, 220, 221, 222, 225, 270],
    col: { c: '#B8652A', tx: '#8A4519', fill: '#F7EEE6', fill2: '#D9B79C', faint: '#E1D3C8', lo: [247, 236, 226], hi: [122, 58, 22] }
  },
  akureyri: {
    nafn: 'Akureyri', allt_txt: 'á Akureyri',
    allt: [600, 603],
    col: { c: '#5E4FA2', tx: '#433880', fill: '#EEEBF6', fill2: '#C3BADF', faint: '#DAD5EA', lo: [238, 235, 246], hi: [52, 40, 110] },
    valkostir: '<option value="0">Allur bærinn</option><option value="600">600 Akureyri</option><option value="603">603 Akureyri (norðan Glerár)</option>'
  },
  reykjanesbaer: {
    nafn: 'Reykjanesbær', allt_txt: 'í Reykjanesbæ',
    allt: [230, 233, 260, 262],
    col: { c: '#2E6DA4', tx: '#1F4F7A', fill: '#E6EEF6', fill2: '#A9C3DC', faint: '#D2DEE9', lo: [230, 238, 246], hi: [22, 58, 98] },
    valkostir: '<option value="0">Allur bærinn</option><option value="230">230 Keflavík</option><option value="260">260 Njarðvík</option><option value="262">262 Ásbrú</option><option value="233">233 Hafnir</option>'
  },
  // Aðeins Selfoss (800 bærinn, 801 dreifbýlið í kring). Eyrarbakki (820) og Stokkseyri (825) eru
  // ~25 % ódýrari á fermetra og eldri hús, svo þau eru höfð utan svo þau skekki ekki meðaltölin.
  selfoss: {
    nafn: 'Selfoss', allt_txt: 'á Selfossi',
    allt: [800, 801],
    col: { c: '#A23B63', tx: '#7A2547', fill: '#F6E8EE', fill2: '#D9A9BD', faint: '#E8D3DC', lo: [246, 232, 238], hi: [110, 28, 62] },
    valkostir: '<option value="0">Allur Selfoss</option><option value="800">800 Selfoss</option><option value="801">801 Selfoss (dreifbýli)</option>'
  },
  // Aðeins bærinn (300); Hvalfjarðarsveit (301) er sveit með sumarhúsum í bland
  akranes: {
    nafn: 'Akranes', allt_txt: 'á Akranesi',
    allt: [300],
    col: { c: '#5B7F2B', tx: '#3F5C1B', fill: '#EEF3E6', fill2: '#BFD0A6', faint: '#DCE5CF', lo: [238, 243, 230], hi: [44, 66, 18] },
    valkostir: '<option value="0">300 Akranes</option>'
  }
};
const svPostnrs = (sv, postnr) => postnr === 0 ? SVAEDI[sv].allt : [postnr];

const fetchSvaediAuglysingar = (sv, postnr, tegund = 'all', limit = 1000) =>
  fetchAuglysingar(svPostnrs(sv, postnr), (TEGUND_MAP[tegund] || TEGUND_MAP.all).teg, limit);

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
  // Miðgildi og lækkanir reiknuð í gagnagrunninum yfir allar auglýsingar, ekki bara þær sem sóttar eru
  const nLk = ls.nLk ?? 0;
  document.getElementById(pre + '-ls-n').textContent = !ls.length ? ''
    : (tot > ls.length ? `${fmtInt(tot)} eignir, ${fmtInt(ls.length)} nýjustu sýndar`
    : `${fmtInt(ls.length)} ${ls.length === 1 ? 'eign' : 'eignir'}, nýjast fyrst`)
    + (tot >= 5 && ls.midgildi != null ? ` · miðgildi ${fmtDagar(ls.midgildi)} á sölu · ${fmtInt(nLk)} ${nLk % 10 === 1 && nLk % 100 !== 11 ? 'hefur' : 'hafa'} lækkað verð` : '');
  if (!ls.length) { w.innerHTML = '<p class="k-sub" style="padding:16px 0">Engar eignir á sölu á þessu svæði.</p>'; document.getElementById(pre + '-ls-more').hidden = true; return; }
  ls.sort((a, b) => (b.dags_raw?.getTime() || 0) - (a.dags_raw?.getTime() || 0));
  w.innerHTML = ls.map(l => {
    const mi = rows.length ? getMatInfo(rows, l.heimilisfang, l.staerd) : null;
    const diff = mi && mi.mat > 0 && l.verd_kr > 0 ? Math.round(l.verd_kr / mi.mat / 10) - 100 : null;
    const lk = l.haest_kr ? Math.round((1 - l.verd_kr / l.haest_kr) * 100) : 0;   // lækkun frá hæsta ásetta verði, %
    return `<article class="k-lst" data-addr="${vmEsc(l.heimilisfang.toLowerCase())}">
      <div><h3>${vmEsc(l.heimilisfang)}</h3><div class="k-sub"${l.dags ? ` title="Fyrst auglýst ${l.dags}"` : ''}>${l.dagar == null ? '' : l.dagar < 2 ? 'Nýtt á sölu' : `${fmtDagar(l.dagar)} á sölu`}</div></div>
      <div><div class="k-lab">Ásett verð</div><div style="font-weight:700">${l.verd_kr > 0 ? fmtMkr(l.verd_kr / 1000) : 'Tilboð'}</div>${lk >= 1 ? `<div class="k-sub">−${lk}% frá ${fmtMkr(l.haest_kr / 1000)}</div>` : ''}</div>
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
  const { data } = await API.rpc('get_verd_staerd_aldur_svaedi', args);   // API reynir aftur við tímamörk
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

let sumarReady   = null;    // svæðið sem er teiknað í sumarhúsaflipanum
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

// Sumarhúsagögn hvers svæðis sótt einu sinni og samnýtt af forsíðu og sumarhúsaflipa
const _sumarData = {};
function loadSumarData(sv = 'sumar') {
  if (!_sumarData[sv]) {
    const postnr = SUMAR[sv].postnr;
    _sumarData[sv] = Promise.all([
      API.getKaupskra({
        select: 'heimilisfang,kaupverd,einflm,byggar,thinglystdags,onothaefur_samningur,fasteignamat,fasteignamat_gildandi,fastnum,heinum',
        postnr: `eq.${postnr}`, tegund: 'eq.Sumarhús', kaupverd: 'gt.500', order: 'thinglystdags.asc'
      }),
      fetchAuglysingar([postnr], ['sumarhus'])
    ]).then(([k, ls]) => {
      // Misheppnuð sókn er ekki geymd: næsta kall (t.d. þegar farið er í flipann) reynir aftur
      if (k.error || !ls.length) delete _sumarData[sv];
      return [
      // Ónothæfir samningar (gjafir, innan fjölskyldu o.þ.h.) skekkja meðaltöl – t.d. 2 m.kr. bústaður í Fitjahlíð 2022.
      // Síað hér svo flipinn og forsíðan fái sömu tölur.
      { ...k, data: k.data ? k.data.filter(r => r.onothaefur_samningur !== '1') : k.data }, ls
    ]; });
  }
  return _sumarData[sv];
}

// Velur sumarhúsasvæði: fyrirsögn, litur (CSS-breytur á view-sumar), svæðahnappar
function ksSetSvaedi(sv) {
  KS.sv = sv;
  const S = SUMAR[sv], view = document.getElementById('view-sumar');
  view.dataset.svaedi = sv;
  document.getElementById('ks-h1').textContent = S.nafn;
  document.getElementById('ks-sub').textContent = S.lead;
  document.querySelectorAll('.ks-seg [data-ssv]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.ssv === sv)));
  document.querySelector('.tab-btn[data-view="sumar"]').style.setProperty('--k-sumar', S.col.c);
}

async function initSumar(sv = KS.sv) {
  if (sumarReady === sv) return;
  sumarReady = sv;
  ksSetSvaedi(sv);
  const fail = () => { if (KS.sv === sv) document.getElementById('ks-fjall').innerHTML = '<p class="k-sub">Ekki tókst að sækja gögn. Reyndu aftur síðar.</p>'; };
  const loading = '<div class="ldw"><div class="ldr"></div>Sæki gögn…</div>';
  ['ks-fjall', 'ks-ls'].forEach(id => { document.getElementById(id).innerHTML = loading; });
  ['ks-bars', 'ks-mat', 'ks-hverfi', 'ks-now', 'ks-ls-n', 'ks-avs-sum', 'ks-bars-t', 'ks-mat-t'].forEach(id => { document.getElementById(id).innerHTML = ''; });
  document.getElementById('ks-avs').innerHTML = '<tr><td colspan="5"><div class="ldw"><div class="ldr"></div>Sæki sölur og auglýsingar…</div></td></tr>';
  document.querySelectorAll('#ks-kpis .k-kv').forEach(e => { e.textContent = '—'; });
  try {
    const [k, ls] = await loadSumarData(sv);
    if (KS.sv !== sv) return;   // annað svæði valið á meðan
    KS.rows = k.data || [];
    if (k.error || !KS.rows.length) { sumarReady = null; return fail(); }
    ksFjall();
    khKpis(yearStatsFromRows(KS.rows, 10, 2000), ls.total ?? ls.length, 'ks-kpis');
    ksHverfi();
    khListings(ls, KS.rows, 'ks', 'var(--k-skorr-tx)');
    await ksAvs();
    const q = document.getElementById('avs-filter').value;
    if (q && KS.sv === sv) ksFilter(q);
  } catch (e) {
    console.error('initSumar error:', e);
    sumarReady = null;
    fail();
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
    const [aggResult, ls] = await Promise.all([API.getManadarsolur(svPostnrs(sv, postnr), kaupTegund), fetchSvaediAuglysingar(sv, postnr, tegund)]);
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
const K_COL = { hofud: SVAEDI.hofud.col, akureyri: SVAEDI.akureyri.col, reykjanesbaer: SVAEDI.reykjanesbaer.col, selfoss: SVAEDI.selfoss.col, akranes: SVAEDI.akranes.col,
  sumar: SUMAR.sumar.col, grimsnes: SUMAR.grimsnes.col, blaskogar: SUMAR.blaskogar.col };
// Önnur þéttbýlissvæði á forsíðu (á eftir höfuðborgarsvæðinu)
const K_AUKA = [{ sv: 'akureyri' }, { sv: 'reykjanesbaer' }, { sv: 'selfoss' }, { sv: 'akranes' }];
const kAvg = (by, y) => by?.[y]?.nFm ? by[y].sumFm / by[y].nFm : null;
const kLastYear = by => Math.max(...Object.keys(by).filter(y => by[y].nFm > 0).map(Number));

// Forsíðan sýnir eina tegund í einu (íbúðir eða sumarhús): fjall, svæðatafla og nýjustu sölur.
// Fyrsta svæðið í hverri tegund er fyllta „fjallið“ með hæðarlínum; hin eru línur ofan á.
const K_FAM = {
  ibudir:   { svs: ['hofud', ...K_AUKA.map(a => a.sv)], teg: 'íbúðir' },
  sumarhus: { svs: ['grimsnes', 'sumar', 'blaskogar'], teg: 'sumarhús' }
};
const kNafn = sv => SVAEDI[sv]?.nafn || SUMAR[sv].nafn;
const kUndir = sv => SUMAR[sv] ? `Sumarhús, ${SUMAR[sv].postnr}` : sv === 'hofud' ? 'Íbúðarhúsnæði, allt svæðið' : `Íbúðarhúsnæði, ${SVAEDI[sv].allt.join(', ')}`;
// Gögn forsíðunnar: by[sv] = ársmeðaltöl, ls[sv] = fjöldi á sölu, solur[sv] = nýjustu sölur
const KY = { fam: 'ibudir', by: {}, ls: {}, solur: {}, lastDate: null, solurOpin: false };

// Verðfjallið: fermetraverð á ári sem hæðarsnið; hver lárétt lína í fjallinu = 100 þ.kr/m²
function kFjall() {
  const svs = K_FAM[KY.fam].svs.filter(sv => KY.by[sv]);
  if (!svs.length) return;
  const y1 = Math.max(...svs.map(sv => kLastYear(KY.by[sv]))), years = [];
  for (let y = 2008; y <= y1; y++) years.push(y);
  const S = svs.map(sv => ({ sv, v: years.map(y => kAvg(KY.by[sv], y)) }));
  const F = S[0], L = S.slice(1);   // F = fyllta fjallið
  const all = S.flatMap(l => l.v).filter(Boolean), top = Math.ceil((Math.max(...all) + 60) / 100) * 100;
  const W = 1000, B = 300, n = years.length;
  const x = i => +(i * W / (n - 1)).toFixed(1), yv = v => +(B - v / top * B).toFixed(1);
  const pts = a => a.map((v, i) => v ? [x(i), yv(v)] : null).filter(Boolean);
  const line = a => pts(a).map((p, i) => (i ? 'L' : 'M') + p[0] + ' ' + p[1]).join(' ');
  const area = a => { const p = pts(a); return line(a) + ` L${p[p.length - 1][0]} ${B} L${p[0][0]} ${B} Z`; };
  const levels = []; for (let lv = 100; lv < top; lv += 100) levels.push(yv(lv));
  const lvl = c => levels.map(y => `<line x1="0" x2="${W}" y1="${y}" y2="${y}" stroke="${c}" stroke-width="1" opacity=".6" vector-effect="non-scaling-stroke"/>`).join('');
  const grid = [200, 400, 600, 800].filter(v => v < top);
  // lægsti punktur fyllta svæðisins (eftir hrun)
  let lo = F.v.findIndex(Boolean); F.v.forEach((v, i) => { if (v && v < F.v[lo]) lo = i; });
  const pct = (v, of) => +(v / of * 100).toFixed(1);
  const fc = K_COL[F.sv], fLast = F.v[n - 1];
  const svg = `<svg viewBox="0 0 ${W} ${B}" preserveAspectRatio="none" role="img" aria-label="Fermetraverð ${K_FAM[KY.fam].teg} ${years[0]} til ${y1}.${S.map(l => ` ${kNafn(l.sv)} úr ${fmtInt(l.v.find(Boolean))} í ${fmtInt(l.v[n - 1])} þúsund krónum á fermetra.`).join('')}">
    <defs><clipPath id="kH"><path d="${area(F.v)}"/></clipPath></defs>
    ${grid.map(v => `<line x1="0" x2="${W}" y1="${yv(v)}" y2="${yv(v)}" stroke="#D5DCDC" vector-effect="non-scaling-stroke"/>`).join('')}
    <g clip-path="url(#kH)" data-sv="${F.sv}"><path d="${area(F.v)}" fill="${fc.fill}"/>${lvl(fc.c)}</g>
    ${L.map(l => `<path data-sv="${l.sv}" d="${line(l.v)}" fill="none" stroke="${K_COL[l.sv].c}" stroke-width="2" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`).join('')}
    <path data-sv="${F.sv}" d="${line(F.v)}" fill="none" stroke="${fc.c}" stroke-width="2.5" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
    <line x1="0" x2="${W}" y1="${B}" y2="${B}" stroke="#1C2B33" vector-effect="non-scaling-stroke"/>
  </svg>`;
  const ticks = [years[0], ...years.filter(y => y % 4 === 0 && y > years[0] && y < y1 - 1), y1];
  const fjall = document.getElementById('k-fjall');
  fjall.classList.add('k-gut');
  fjall.innerHTML = svg
    + grid.map(v => `<span class="k-yl" style="top:${pct(yv(v), B)}%">${v}</span>`).join('')
    + ticks.map((y, i) => `<span class="k-xl${i && i < ticks.length - 1 ? ' mid' : i ? ' k-xl-end' : ' k-xl-start'}" style="left:${kXpos(pct(x(years.indexOf(y)), W))}">${y}</span>`).join('')
    + `<span class="k-note" style="left:${kXpos(pct(x(lo), W))};top:${pct(yv(F.v[lo]) - 10, B)}%;color:${fc.tx}">${years[lo]}: ${fmtInt(F.v[lo])}</span>`
    // Punktur við enda hverrar línu (HTML, því SVG-ið er teygt og hringir yrðu sporöskjur)
    + S.filter(l => l.v[n - 1]).map(l => `<span class="k-dot" data-sv="${l.sv}" style="left:${kXpos(pct(W, W))};top:${pct(yv(l.v[n - 1]), B)}%;background:${K_COL[l.sv].c}"></span>`).join('');

  // Fyrirsögn: hve mikið verð fyllta svæðisins hefur margfaldast frá lægsta punkti
  const f = Math.floor(fLast / F.v[lo]);
  const ord = { 2: 'tvöfaldast', 3: 'þrefaldast', 4: 'fjórfaldast', 5: 'fimmfaldast' }[f];
  document.getElementById('k-hero-h').textContent = ord
    ? `Fermetraverð ${KY.fam === 'sumarhus' ? `sumarhúsa ${SUMAR[F.sv].stadur} ` : ''}hefur meira en ${ord} síðan ${years[lo]}`
    : 'Fasteignaverð í tölum';
  if (KY.lastDate) {
    const d = new Date(KY.lastDate);
    document.getElementById('k-fjall-cap').textContent = `Þ.kr á fermetra, meðaltal ársins. ${y1} til og með ${d.getDate()}. ${MAN_LANGT[d.getMonth()]}.`;
  }
}

// Svæðataflan er líka skýring grafsins: raðað eftir nýjasta fermetraverði, eins og línurnar enda
function kSvTafla() {
  const svs = K_FAM[KY.fam].svs.filter(sv => KY.by[sv]);
  const rows = svs.map(sv => {
    const by = KY.by[sv], y = kLastYear(by), v = kAvg(by, y), p = kAvg(by, y - 1);
    return { sv, y, v, ch: v && p ? Math.round((v - p) / p * 100) : null };
  }).sort((a, b) => (b.v || 0) - (a.v || 0));
  const y = rows[0]?.y;
  if (y) {
    document.getElementById('k-svt-fm').textContent = `Þ.kr/m² ${y}`;
    document.getElementById('k-svt-chg').textContent = `Frá ${y - 1}`;
  }
  document.getElementById('k-svt').innerHTML = rows.map(({ sv, v, ch }) => {
    const c = K_COL[sv], slod = VIEW_HASH[sv];
    return `<tr data-sv="${sv}">
      <th scope="row" class="c-sv"><i style="background:${c.c}"></i><a href="#${slod}" data-goto="${sv}">${kNafn(sv)}</a><span class="k-sub">${kUndir(sv)}</span></th>
      <td class="c-v r" style="color:${c.tx}">${v ? fmtInt(v) : '—'}</td>
      <td class="c-chg r">${ch == null ? '—' : (ch > 0 ? '+' : ch < 0 ? '−' : '±') + Math.abs(ch) + '%'}</td>
      <td class="c-ls r">${KY.ls[sv] != null ? fmtInt(KY.ls[sv]) : '—'}</td>
    </tr>`;
  }).join('');
}

// Auðkenning í verðfjallinu: mús yfir (eða fókus á) línu í svæðatöflunni; null = öll jafnt
function kFjallAudkenna(sv) {
  document.querySelectorAll('#k-fjall [data-sv], #k-svt tr[data-sv]').forEach(e => e.classList.toggle('k-dim', !!sv && e.dataset.sv !== sv));
}
const kSvt = document.getElementById('k-svt');
kSvt.addEventListener('mouseover', e => { const r = e.target.closest('tr[data-sv]'); if (r) kFjallAudkenna(r.dataset.sv); });
kSvt.addEventListener('mouseleave', () => kFjallAudkenna(null));
kSvt.addEventListener('focusin', e => { const r = e.target.closest('tr[data-sv]'); if (r) kFjallAudkenna(r.dataset.sv); });
kSvt.addEventListener('focusout', () => kFjallAudkenna(null));
// Öll línan opnar svæðið (tengillinn í nafninu er fyrir lyklaborð og skjálesara)
kSvt.addEventListener('click', e => {
  const r = e.target.closest('tr[data-sv]'); if (!r) return;
  e.preventDefault();
  showView(r.dataset.sv);
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

function kSaleRow(r, reg, { postnrOnly = false } = {}) {
  const l = r.listing, c = K_COL[reg];
  const propUrl = r.fastnum && r.heinum ? `https://fastinn.is/fasteignir/${r.heinum}/${r.fastnum}` : l?.linkur;
  const askThkr = l?.verd ? l.verd / 1000 : 0;
  const diff = askThkr ? Math.round((r.kaupverd - askThkr) / askThkr * 100) : null;
  // Ásett verð vísar á auglýsinguna sjálfa (heimilisfangið á eignasíðuna)
  const askTxt = askThkr && l.linkur ? `<a href="${l.linkur}" target="_blank" rel="noopener" title="Opna auglýsingu">${fmtMkr(askThkr)}</a>` : fmtMkr(askThkr);
  const ask = askThkr ? `${askTxt} <span class="${diff < 0 ? 'k-down' : diff > 0 ? 'k-up' : ''}" style="font-weight:600">${diff > 0 ? '+' : diff < 0 ? '−' : '±'}${Math.abs(diff)}%</span>` : '';
  const svaedi = SUMAR[reg] ? SUMAR[reg].i_txt : postnrOnly ? r.postnr : reg === 'akureyri' ? r.postnr + ' Akureyri' : vmPostTxt(r.postnr);
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

// Nýjustu sölur valinnar tegundar, nýjast fyrst; fimm sjást, hnappurinn sýnir hinar
function kSalesTable() {
  const tb = document.getElementById('k-solur'), btn = document.getElementById('k-solur-more');
  const sales = K_FAM[KY.fam].svs.flatMap(sv => (KY.solur[sv] || []).map(r => [sv, r]))
    .sort((a, b) => new Date(b[1].thinglystdags) - new Date(a[1].thinglystdags));
  tb.innerHTML = sales.length
    ? sales.map(([sv, r], i) => kSaleRow(r, sv).replace('<tr>', i < 5 ? '<tr>' : '<tr class="k-x">')).join('')
    : '<tr><td colspan="6">Engar sölur fundust.</td></tr>';
  const fl = tb.querySelectorAll('.k-x').length;
  const draw = () => {
    tb.querySelectorAll('.k-x').forEach(tr => { tr.hidden = !KY.solurOpin; });
    btn.hidden = !fl;
    btn.textContent = KY.solurOpin ? 'Sýna færri sölur' : `Sýna ${fl} sölur í viðbót`;
    btn.setAttribute('aria-expanded', String(KY.solurOpin));
  };
  btn.onclick = () => { KY.solurOpin = !KY.solurOpin; draw(); };
  draw();
}

function kTeikna() {
  kFjall();
  kSvTafla();
  kSalesTable();
}

document.querySelectorAll('.k-fam [data-fam]').forEach(b => b.addEventListener('click', () => {
  if (KY.fam === b.dataset.fam) return;
  KY.fam = b.dataset.fam;
  KY.solurOpin = false;
  kFjallAudkenna(null);
  document.querySelectorAll('.k-fam [data-fam]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  if (Object.keys(KY.by).length) kTeikna();
}));

async function initYfirlit() {
  if (yfirlitReady) return;
  yfirlitReady = true;
  const fail = id => { const e = document.getElementById(id); if (e) e.innerHTML = '<p class="k-sub">Ekki tókst að sækja gögn. Reyndu aftur síðar.</p>'; };
  // Tafla og sölur teiknast aftur þegar meira berst; fjallið bíður eftir fyllta svæðinu
  const teikna = () => { if (KY.by[K_FAM[KY.fam].svs[0]]) kTeikna(); };

  const ibudSales = (sv, limit) => API.query('kaupskra', {
    select: 'heimilisfang,postnr,tegund,kaupverd,einflm,thinglystdags,fastnum,heinum',
    kaupverd: 'gt.5000', einflm: 'gt.20', onothaefur_samningur: 'neq.1', or: IBUD_OR,
    postnr: `in.(${SVAEDI[sv].allt})`, order: 'thinglystdags.desc', limit
  }, { paginate: false }).then(r => r.data || []);

  const verk = [];
  // Þéttbýlissvæðin: mánaðarsamantekt, fjöldi á sölu, nýjustu sölur
  for (const sv of K_FAM.ibudir.svs) {
    verk.push(API.getManadarsolur(SVAEDI[sv].allt, null).then(r => { if (r.data) { KY.by[sv] = hofudByYear(r.data); teikna(); } }).catch(() => {}));
    fetchSvaediAuglysingar(sv, 0, 'all', 1).then(ls => { KY.ls[sv] = ls.total ?? ls.length; teikna(); });
    verk.push(ibudSales(sv, sv === 'hofud' ? 5 : 3).then(rows => {
      KY.solur[sv] = rows;
      if (sv === 'hofud' && rows[0]) KY.lastDate = rows[0].thinglystdags;
      teikna();
      return matchSalesToListings(rows).then(m => { KY.solur[sv] = m; teikna(); });
    }).catch(() => {}));
  }
  // Sumarhúsasvæðin: einstakar sölur (sömu og sumarhúsaflipinn notar, svo tölurnar stemmi)
  for (const sv of K_FAM.sumarhus.svs) {
    verk.push(loadSumarData(sv).then(([k, ls]) => {
      if (k.error) return;   // strikin (—) standa frekar en röng tala
      const rows = k.data || [];
      KY.by[sv] = yearStatsFromRows(rows, 10, 2000);
      KY.ls[sv] = ls.total ?? ls.length;
      KY.solur[sv] = rows.filter(r => r.einflm > 10).slice(-3).reverse().map(r => ({ ...r, postnr: SUMAR[sv].postnr, tegund: 'Sumarhús' }));
      teikna();
      return matchSalesToListings(KY.solur[sv]).then(m => { KY.solur[sv] = m; teikna(); });
    }).catch(() => {}));
  }
  await Promise.all(verk);
  if (!KY.by[K_FAM[KY.fam].svs[0]]) fail('k-fjall');
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

// Sumarhúsasvæðin í Markaðshita (eftir hálfum árum); lyklarnir eru þeir sem n8n vistar í markadshiti.svaedi
const MH_SUMAR = { skorr: SUMAR.sumar, grimsnes: SUMAR.grimsnes, blaskogar: SUMAR.blaskogar };

// Hitastig eftir söluverði sem hlutfalli af ásettu verði
function mhLevel(hlut) {
  if (hlut == null) return 2;
  return hlut >= 100.5 ? 4 : hlut >= 99.3 ? 3 : hlut >= 98.6 ? 2 : hlut >= 96 ? 1 : 0;
}

// Reiknar núverandi tímabil og sama tímabil ári fyrr fyrir valið svæði
function mhCompute(svaedi) {
  const rows = MH.data.filter(r => r.svaedi === svaedi);
  const today = new Date(), curYm = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  if (!MH_SUMAR[svaedi]) {                          // þéttbýlissvæðin: eftir mánuðum
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
  // Sumarhúsasvæðin: síðasta heila hálfa ár borið saman við sama hálfa ár árið áður
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
  if (MH_SUMAR[svaedi]) {
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
  const sv = MH.svaedi, c = mhCompute(sv), isH = !MH_SUMAR[sv];
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
  const k = MH.metric, m = MH_METRICS[k], isH = !MH_SUMAR[MH.svaedi];
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
    // Sumarhúsasvæðin: hálf ár (of fáar sölur á mánuði)
    const S = MH_SUMAR[MH.svaedi];
    const pts = c.series.map(r => ({ v: r[k] == null ? null : Number(r[k]), n: r.n, p: (c.halfName(r) + (c.isFull(r) ? '' : ' (til þessa)')).replace(/^./, ch => ch.toUpperCase()),
      x: (mhYm(r.timabil).slice(5) === '01' ? 'fyrri' : 'seinni') + ' ’' + r.timabil.slice(2, 4) }));
    const all = pts.map(p => p.v).filter(v => v != null), span = Math.max(...all) - Math.min(...all) || 1;
    const lo = Math.max(0, Math.min(...all) - span * .25), hi = Math.max(...all) + span * .25, n = pts.length;
    const x = i => +((i + .5) / n * W).toFixed(1), yv = v => +(H - (v - lo) / (hi - lo) * H).toFixed(1);
    const grid = [lo + (hi - lo) * .25, (lo + hi) / 2, lo + (hi - lo) * .75];
    svg = `${grid.map(g => `<line x1="0" x2="${W}" y1="${yv(g)}" y2="${yv(g)}" stroke="#D5DCDC" vector-effect="non-scaling-stroke"/>`).join('')}
      <path d="${pts.map((p, i) => p.v == null ? null : [x(i), yv(p.v)]).filter(Boolean).map((p, i) => (i ? 'L' : 'M') + p[0] + ' ' + p[1]).join(' ')}" fill="none" stroke="${S.col.c}" stroke-width="2.5" vector-effect="non-scaling-stroke"/>
      ${pts.map((p, i) => p.v == null ? '' : `<circle cx="${x(i)}" cy="${yv(p.v)}" r="4" fill="${S.col.c}" stroke="#F2F4F1" stroke-width="2" vector-effect="non-scaling-stroke"><title>${p.p}: ${mhFmt(p.v, k)} (${p.n} sölur)</title></circle>`).join('')}`;
    labels = grid.map(g => `<span class="k-yl" style="top:${pct(yv(g), H)}%;left:auto;right:0">${mhFmt(g, k)}</span>`).join('')
      + pts.map((p, i) => `<span class="k-xl${i && i < n - 1 ? ' mid' : ''}" style="left:${pct(x(i), W)}%">${p.x}</span>`).join('');
    legend = `<span><i style="height:3px;background:${S.col.c}"></i>Sumarhús ${S.stadur}, eftir hálfum árum</span>`;
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
  for (const sv of ['akureyri', 'reykjanesbaer', 'selfoss', 'akranes', 'grimsnes', 'blaskogar'])
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
const VM_TEG = { 'Fjölbýli': ['Íbúð', 'íbúðir í fjölbýli'], 'Sérbýli': ['Sérbýli', 'sérbýli'], 'Einbýli': ['Einbýli', 'einbýlishús'], 'Sumarhús': ['Sumarhús', 'sumarhús'] };
// Verðmat: íbúðarhúsnæði á svæðunum í VM_POSTNR, sumarhús alls staðar (sem bil – sjá vmCompute).
// Sölusagan nær yfir allt íbúðarhúsnæði á landinu og sumarhús.
// Þágufall fleirtölu: „meðalverð á íbúðum í fjölbýli í 101“
const VM_TEG_THGF = { 'Fjölbýli': 'íbúðum í fjölbýli', 'Sérbýli': 'sérbýlum', 'Einbýli': 'einbýlishúsum', 'Sumarhús': 'sumarhúsum' };
const vmKannVerdmat = (tegund, postnr) => tegund === 'Sumarhús' || (!!VM_TEG[tegund] && VM_POSTNR.some(a => a[0] === postnr));
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
  // Engin tala í leitinni → göturnar sjálfar efst (götusíða)
  const gotur = /\d/.test(q) ? [] : [...new Map(rows.map(r => [kGataAfHeimilisfangi(r.heimilisfang) + '|' + r.postnr, { g: kGataAfHeimilisfangi(r.heimilisfang), p: r.postnr }])).values()].slice(0, 3);
  box.innerHTML = '<ul class="vm-list">' + gotur.map(g =>
    `<li><a class="vm-opt vm-gata-opt" href="${kGataSlod(g.p, g.g)}">
      <span class="vm-opt-main">${vmEsc(g.g)}, ${vmEsc(vmPostTxt(g.p))}</span>
      <span class="vm-opt-side">Allar sölur í götunni</span>
    </a></li>`).join('') + rows.map(r =>
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

function vmPickUnit(i, saga = null) {
  VM.unit = i;
  vmRenderUnits();
  const u = VM.units[i];
  const title = `${VM.addr.h}, ${(VM_TEG[u.tegund]?.[0] || 'eign').toLowerCase()} ${vmM2(u.einflm)}`;
  if (vmKannVerdmat(u.tegund, VM.addr.p)) {
    vmCompute({ mat: u.fasteignamat, mat27: u.fasteignamat_2027, postnr: VM.addr.p, tegund: u.tegund,
      einflm: u.einflm, fastnum: u.fastnum, title });
  } else {
    ++VM.cseq;                                                    // hunsa eldri verðmatsútreikning
    document.getElementById('vm-res-sub').textContent = title;
    document.getElementById('vm-res-body').innerHTML = `<p class="vm-empty">Verðmat íbúðarhúsnæðis er aðeins reiknað á höfuðborgarsvæðinu, Akureyri, Reykjanesbæ, Selfossi og Akranesi. Sölusaga eignarinnar er hér fyrir neðan.</p>`
      + (u.fasteignamat ? `<dl class="k-vfacts"><div><dt>Fasteignamat 2026</dt><dd>${fmtMkr(u.fasteignamat)}</dd></div>${u.fasteignamat_2027 ? `<div><dt>Fasteignamat 2027</dt><dd>${fmtMkr(u.fasteignamat_2027)}</dd></div>` : ''}</dl>` : '');
    document.getElementById('vm-comps-box').hidden = true;
  }
  vmSaga(u.fastnum, saga);
  // Eigin slóð á eignina (deilanleg); titill vafraflipa fylgir
  if (location.hash !== '#eign/' + u.fastnum) history.replaceState(null, '', '#eign/' + u.fastnum);
  document.title = `${VM.addr.h} – Fasteignavaktin`;
}

// Opnar eign beint eftir fastanúmeri (slóðin #eign/2000522)
async function vmOpenFastnum(fastnum) {
  const box = document.getElementById('vm-results');
  box.innerHTML = '<p class="vm-help">Sæki eign…</p>';
  const { data } = await API.rpc('saga_eignar', { p_fastnum: fastnum });
  const e = data?.eign;
  if (!e) { box.innerHTML = '<p class="vm-help">Eignin fannst ekki. Leitaðu eftir heimilisfangi.</p>'; return; }
  vmSetMode('addr');
  document.getElementById('vm-q').value = e.heimilisfang;
  VM.addr = { h: e.heimilisfang, p: e.postnr };
  VM.units = [{ fastnum: e.fastnum, tegund: e.tegund, einflm: Number(e.einflm), byggar: e.byggar,
                fasteignamat: e.fasteignamat, fasteignamat_2027: e.fasteignamat_2027 }];
  vmPickUnit(0, data);
}

// Sögugraf (eignasíða og götusíða): meðalverð hverfisins eftir árum (brotin lína) og punktar ofan á
// (sölur eignar, eða ársmeðaltöl götunnar með stærð eftir fjölda). pts: [{ t (ms), v, r?, title }].
// Skilar false ef ekkert er til að teikna.
function kSoguGraf(graf, legend, pts, hverfi, o) {
  const nu = new Date().getFullYear(), ar = t => new Date(t).getFullYear();
  const y0 = Math.min(2006, ...pts.map(p => ar(p.t))), hv = hverfi.filter(h => h.ar >= y0 && Number(h.n) >= 3);
  if (!pts.length && hv.length < 2) return false;
  const W = 1000, H = 240, t0 = Date.UTC(y0, 0, 1), t1 = Date.UTC(nu + 1, 0, 1);
  const all = [...pts.map(p => p.v), ...hv.map(h => Number(h.fm))];
  const mx = Math.max(...all), step = mx > 1200 ? 500 : mx > 500 ? 200 : 100;
  const top = Math.ceil(mx * 1.08 / step) * step;
  const x = t => +((t - t0) / (t1 - t0) * W).toFixed(1), yv = v => +(H - v / top * H).toFixed(1);
  const mid = y => Date.UTC(y, 6, 1);
  const hvPath = hv.map((h, i) => (i ? 'L' : 'M') + x(mid(h.ar)) + ' ' + yv(Number(h.fm))).join(' ');
  const pPath = pts.map((p, i) => (i ? 'L' : 'M') + x(p.t) + ' ' + yv(p.v)).join(' ');
  const grid = []; for (let g = step; g < top; g += step) grid.push(g);
  const pct = (v, of) => +(v / of * 100).toFixed(1);
  const ticks = [y0, ...[2010, 2015, 2020].filter(y => y > y0 + 1 && y < nu - 1), nu];
  legend.innerHTML = `<span><i style="border-top:2px dashed #8B98A0"></i>${o.hvTxt}</span><span><i style="width:10px;height:10px;border-radius:50%;background:var(--k-ink)"></i>${o.ptsTxt}</span>`;
  graf.classList.add('k-gut');   // ás-tölur í eigin dálki vinstra megin
  graf.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="height:240px" role="img" aria-label="${vmEsc(o.aria)}">
      ${grid.map(g => `<line x1="0" x2="${W}" y1="${yv(g)}" y2="${yv(g)}" stroke="#D5DCDC" vector-effect="non-scaling-stroke"/>`).join('')}
      ${hvPath ? `<path d="${hvPath}" fill="none" stroke="#8B98A0" stroke-width="2" stroke-dasharray="6 5" vector-effect="non-scaling-stroke"/>` : ''}
      ${o.lina && pts.length > 1 ? `<path d="${pPath}" fill="none" stroke="#1C2B33" stroke-width="1.5" opacity=".5" vector-effect="non-scaling-stroke"/>` : ''}
      <line x1="0" x2="${W}" y1="${H}" y2="${H}" stroke="#1C2B33" vector-effect="non-scaling-stroke"/>
    </svg>`
    + grid.map(g => `<span class="k-yl" style="top:${pct(yv(g), H)}%">${fmtInt(g)}</span>`).join('')
    + ticks.map((y, i) => `<span class="k-xl${i && i < ticks.length - 1 ? ' mid' : i ? ' k-xl-end' : ' k-xl-start'}" style="left:${kXpos(pct(x(i === ticks.length - 1 ? t1 : Date.UTC(y, 0, 1)), W))}">${y}</span>`).join('')
    // Punktar sem HTML (SVG-ið er teygt og hringir yrðu sporöskjur)
    + pts.map(p => `<span class="k-dot k-dot-eign" style="left:${kXpos(pct(x(p.t), W))};top:${pct(yv(p.v), H)}%${p.r ? `;width:${p.r * 2}px;height:${p.r * 2}px` : ''}" title="${vmEsc(p.title)}"></span>`).join('');
  return true;
}

const kGataSlod = (postnr, gata) => `#gata/${postnr}/${encodeURIComponent(gata)}`;
const kGataAfHeimilisfangi = h => String(h || '').replace(/\s+\d.*$/, '').trim();

// Saga eignarinnar: sölur frá 2006, fermetraverð borið saman við hverfið, auglýsingar
const vmFold = r => r >= 1.95 ? `${String(Math.round(r * 10) / 10).replace('.', ',')}-faldaðist` : r >= 1 ? `hækkaði um ${Math.round((r - 1) * 100)}%` : `lækkaði um ${Math.round((1 - r) * 100)}%`;
async function vmSaga(fastnum, data = null) {
  const box = document.getElementById('vm-saga-box');
  const seq = VM.sseq = (VM.sseq || 0) + 1;
  if (!data) ({ data } = await API.rpc('saga_eignar', { p_fastnum: fastnum }));
  if (seq !== VM.sseq) return;                                  // önnur eign valin á meðan
  if (!data?.eign) { box.hidden = true; return; }
  box.hidden = false;
  const e = data.eign, S = data.solur || [], Hv = data.hverfi || [];
  const teg = VM_TEG_THGF[e.tegund] || 'eignum';
  const hvBy = Object.fromEntries(Hv.map(h => [h.ar, Number(h.fm)]));
  const ar = d => new Date(d).getFullYear();
  document.getElementById('vm-saga-sub').textContent =
    `${e.heimilisfang}, ${e.postnr}. ${e.byggar ? `Byggt ${e.byggar}, f` : 'F'}astanúmer F${e.fastnum}`;

  // Samantekt
  let txt;
  if (!S.length) txt = 'Engin sala á markaðsverði er skráð á þessa eign síðan 2006.';
  else if (S.length === 1) txt = `Eignin hefur selst einu sinni síðan 2006, á ${fmtMkr(S[0].kaupverd)} ${fmtDagLangt(S[0].dags)}.`;
  else {
    const a = S[0], b = S[S.length - 1], ya = ar(a.dags), yb = ar(b.dags);
    const r = a.fm && b.fm ? b.fm / a.fm : b.kaupverd / a.kaupverd;
    txt = `Eignin hefur selst ${S.length} sinnum síðan 2006: fyrst á ${fmtMkr(a.kaupverd)} árið ${ya}, síðast á ${fmtMkr(b.kaupverd)} árið ${yb}. Fermetraverðið ${vmFold(r)}`;
    if (VNV[ya] && VNV[yb]) {
      const raun = r * VNV[ya] / VNV[yb] - 1;
      txt += `, sem er ${Math.abs(Math.round(raun * 100))}% ${raun >= 0 ? 'raunhækkun' : 'raunlækkun'} að teknu tilliti til verðbólgu`;
    }
    if (hvBy[ya] && hvBy[yb]) {
      const rh = hvBy[yb] / hvBy[ya], munur = r / rh - 1;
      const hvar = `meðalfermetraverð á ${teg} í ${e.postnr}`;
      txt += rh >= 1.95 ? `. Á sama tíma ${vmFold(rh)} ${hvar}` : `. Á sama tíma ${rh >= 1 ? 'hækkaði' : 'lækkaði'} ${hvar} um ${Math.round(Math.abs(rh - 1) * 100)}%`;
      txt += Math.abs(munur) < 0.05 ? ', svo eignin fylgdi hverfinu' : munur > 0 ? ', svo eignin hækkaði meira en hverfið' : ', svo eignin hækkaði minna en hverfið';
    }
    txt += '.';
  }
  document.getElementById('vm-saga-txt').textContent = txt;

  // Graf: meðalverð hverfisins (lína) og sölur eignarinnar (punktar)
  const pts = S.filter(x => x.fm).map(x => ({ t: new Date(x.dags).getTime(), v: Number(x.fm),
    title: `${fmtDagAr(x.dags)}: ${fmtMkr(x.kaupverd)}, ${fmtInt(x.fm)} þ.kr/m²` }));
  document.getElementById('vm-saga-fig').hidden = !kSoguGraf(document.getElementById('vm-saga-graf'), document.getElementById('vm-saga-legend'),
    pts, Hv, { lina: true, hvTxt: `Meðalverð á ${teg} í ${e.postnr}`, ptsTxt: 'Þessi eign',
      aria: `Fermetraverð eignarinnar við hverja sölu borið saman við meðalverð á ${teg} í ${e.postnr}: ${pts.map(p => `${ar(p.t)} ${fmtInt(p.v)}`).join(', ')} þúsund krónur á fermetra.` });

  // Tafla: nýjasta sala efst
  document.getElementById('vm-saga').innerHTML = S.slice().reverse().map(x => `<tr>
      <th scope="row" style="text-align:left;font-weight:500">${fmtDagAr(x.dags)}</th>
      <td class="r" style="font-weight:700">${fmtMkr(x.kaupverd)}</td>
      <td class="r">${x.fm ? fmtInt(x.fm) : '–'}</td>
      <td class="r" style="color:var(--k-muted)">${x.mat ? Math.round(x.kaupverd / x.mat * 100) + '%' : '–'}</td>
    </tr>`).join('') || '<tr><td colspan="4" class="k-sub">Engar sölur á markaðsverði síðan 2006.</td></tr>';

  // Auglýsingar sem fundust fyrir eignina (eftir fastanúmeri)
  const A = data.augl || [];
  document.getElementById('vm-saga-augl').innerHTML = A.length ? `<ul class="k-vsaga-augl">${A.map(l => {
      const lk = l.haest && l.haest > l.verd ? ` (lækkað úr ${fmtMkr(l.haest / 1000)})` : '';
      return `<li>${l.virk ? '<b>Á sölu núna</b>' : `Auglýst ${fmtDagAr(l.fra)}–${fmtDagAr(l.til)}`} á ${l.verd > 0 ? fmtMkr(l.verd / 1000) : 'tilboð'}${lk}${l.linkur ? ` · <a href="${l.linkur}" target="_blank" rel="noopener">Opna auglýsingu</a>` : ''}</li>`;
    }).join('')}</ul>` : '';

  const gata = kGataAfHeimilisfangi(e.heimilisfang);
  document.getElementById('vm-saga-slod').innerHTML = `<a href="${kGataSlod(e.postnr, gata)}">Allar sölur í götunni: ${vmEsc(gata)}, ${e.postnr}</a><br>Slóð á þessa eign: <a href="#eign/${e.fastnum}">sumar.silfran.com/#eign/${e.fastnum}</a>`;
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
  const { data: d } = await API.rpc('get_verdmat', args);   // API reynir aftur við tímamörk
  if (seq !== VM.cseq) return;
  if (!d || !d.p50) { body.innerHTML = '<p class="vm-empty">Ekki tókst að reikna verðmat. Reyndu aftur síðar.</p>'; return; }

  const lo = e.mat * d.p25, mid = e.mat * d.p50, hi = e.mat * d.p75;
  const mark = 12 + (d.p50 - d.p25) / ((d.p75 - d.p25) || 1) * 76;
  const teg = VM_TEG[e.tegund][1];
  const man = d.manudir || 12;
  const hvar = d.svaedi === 'postnr' ? `í ${e.postnr}`
             : d.svaedi === 'sveitarfelag' ? `í sama sveitarfélagi (of fáar sölur í ${e.postnr} einu)`
             : d.svaedi === 'landid' ? `á landinu öllu (of fáar sölur í ${e.postnr} og sveitarfélaginu)`
             : `${{ akureyri: 'á Akureyri', reykjanesbaer: 'í Reykjanesbæ', selfoss: 'á Selfossi', akranes: 'á Akranesi' }[d.svaedi] || 'á höfuðborgarsvæðinu'} (of fáar sölur í ${e.postnr} einu)`;
  const breyt27 = e.mat27 ? (e.mat27 / e.mat - 1) * 100 : null;
  // Sumarhús víkja mun meira frá fasteignamati en íbúðir (bakprófun: miðgildisskekkja 14–18 % á móti 5–8 %),
  // svo bilið er aðaltalan og miðjan aðeins merki á kvarðanum
  const sumar = e.tegund === 'Sumarhús';
  const mkr = v => String(Math.round(v / 1000));

  document.getElementById('vm-res-sub').textContent = e.title;
  body.innerHTML = (sumar ? `
    <div class="k-vbig">${mkr(lo)}–${mkr(hi)} m.kr</div>
    <p class="k-vrange">Líklegt bil. Miðjan er um <strong>${fmtMkr(mid)}</strong></p>` : `
    <div class="k-vbig">${fmtMkr(mid)}</div>
    <p class="k-vrange">Líklegt bil: <strong>${fmtMkr(lo)} – ${fmtMkr(hi)}</strong></p>`) + `
    <div class="k-vbar" role="img" aria-label="Áætlað verð ${fmtMkr(mid)}, líklegt bil ${fmtMkr(lo)} til ${fmtMkr(hi)}.">
      <i class="k-vbar-axis"></i><i class="k-vbar-band"></i><i class="k-vbar-mark" style="left:${mark.toFixed(1)}%"></i>
    </div>
    <div class="k-vbar-ends"><span>${fmtMkr(lo)}</span><span>${fmtMkr(hi)}</span></div>
    <dl class="k-vfacts">
      <div><dt>Fasteignamat 2026</dt><dd>${fmtMkr(e.mat)}</dd></div>
      <div><dt>Sölur ${d.svaedi === 'postnr' ? 'í ' + e.postnr : 'á svæðinu'}, % af mati</dt><dd>${vmPct(d.p50)}</dd></div>
      ${e.mat27 ? `<div><dt>Fasteignamat 2027</dt><dd>${fmtMkr(e.mat27)} <small>${breyt27 >= 0 ? '+' : '−'}${Math.abs(breyt27).toFixed(1).replace('.', ',')}%</small></dd></div>` : ''}
    </dl>
    <p class="k-figp" style="margin-top:18px">${teg.replace(/^./, c => c.toUpperCase())} ${hvar} seldust að jafnaði á ${vmPct(d.p50)} af fasteignamati síðustu ${man} mánuði (${fmtInt(d.n)} sölur). Helmingur seldist á ${vmPct(d.p25)}–${vmPct(d.p75)} af mati, og það er bilið. ${sumar
      ? 'Sumarhús víkja mun meira frá fasteignamati en íbúðir: staðsetning við vatn, útsýni, lóð og ástand skipta miklu, og fyrri sölur lentu að jafnaði um 15% frá miðjunni. Sambærilegar sölur hér fyrir neðan segja oft meira en talan.'
      : 'Ástand, útsýni og innréttingar ráða hvar í bilinu eignin lendir.'}</p>`;

  // Sambærilegar sölur
  const cBox = document.getElementById('vm-comps-box');
  cBox.hidden = false;
  document.getElementById('vm-comps-sub').textContent =
    `${teg.replace(/^./, c => c.toUpperCase())} í ${e.postnr}${e.einflm ? `, ${Math.round(e.einflm * 0.8)}–${Math.round(e.einflm * 1.2)} m²` : ''}, nýjustu sölur síðustu ${man} mánuði.`;
  document.getElementById('vm-comps').innerHTML = d.samb.length ? `
    <table class="k-tbl k-tbl-vm">
      <thead><tr><th scope="col">Gata</th><th scope="col">Þinglýst</th><th scope="col" class="r">Stærð</th><th scope="col" class="r">Byggt</th><th scope="col" class="r">Söluverð</th><th scope="col" class="r">% af mati</th></tr></thead>
      <tbody>${d.samb.map(s => `<tr>
        <th scope="row" class="c-eign" style="text-align:left;font-weight:600"><a href="${kGataSlod(e.postnr, s.gata)}">${vmEsc(s.gata)}</a></th><td class="c-d" style="color:var(--k-muted)">${fmtDagAr(s.thinglystdags)}</td>
        <td class="c-staerd r">${vmM2(s.einflm)}</td><td class="c-b r">${s.byggar || '–'}</td>
        <td class="c-selt r" style="font-weight:700">${fmtMkr(s.kaupverd)}</td><td class="c-r r ${s.r >= 1 ? 'k-up' : 'k-down'}" style="font-weight:600">${vmPct(s.r)}</td></tr>`).join('')}
      </tbody></table>`
    : `<p class="k-sub">Engar sambærilegar sölur í þessu póstnúmeri síðustu ${man} mánuði.</p>`;

}

// ============================================================
// GATA – „Verð í götunni“: allar sölur í götu, borið saman við póstnúmerið (RPC gata_yfirlit)
// ============================================================
let kgSeq = 0;
async function kgOpen(postnr, gata) {
  const seq = ++kgSeq;
  const $ = id => document.getElementById(id);
  $('kg-h1').textContent = gata;
  $('kg-sub').textContent = vmPostTxt(postnr);
  ['kg-graf', 'kg-solur', 'kg-asolu'].forEach(id => { $(id).innerHTML = ''; });
  $('kg-graf').innerHTML = '<div class="ldw"><div class="ldr"></div>Sæki sölur…</div>';
  document.querySelectorAll('#kg-kpis .k-kv').forEach(el => { el.textContent = '—'; });
  const { data: d } = await API.rpc('gata_yfirlit', { p_postnr: postnr, p_gata: gata });
  if (seq !== kgSeq) return;
  if (!d || !d.n) { $('kg-graf').innerHTML = `<p class="k-sub">Engar sölur fundust í ${vmEsc(gata)}, ${postnr}.</p>`; return; }
  document.title = `${d.gata}, ${postnr} – Fasteignavaktin`;
  $('kg-h1').textContent = d.gata;
  const teg = d.flokkur === 'sumar' ? 'sumarhúsum' : 'íbúðarhúsnæði';
  const eintala = n => n % 10 === 1 && n % 100 !== 11;   // 1, 21, 41 … sala/eign; 11 sölur
  const pnTxt = vmPostTxt(postnr) === String(postnr) ? `Póstnúmer ${postnr}` : vmPostTxt(postnr);
  $('kg-sub').textContent = `${pnTxt}. ${fmtInt(d.n)} ${eintala(d.n) ? 'sala' : 'sölur'} á ${fmtInt(d.eignir)} ${eintala(d.eignir) ? 'eign' : 'eignum'} síðan 2006${d.flokkur === 'sumar' ? ' (sumarhús)' : ''}.`;

  const ny = d.nylegt || {}, set = (k, v, s) => { const el = document.querySelector(`#kg-kpis [data-k="${k}"]`); el.textContent = v; if (s != null) el.nextElementSibling.textContent = s; };
  set('fm', ny.fm_gata ? fmtInt(ny.fm_gata) : '—', ny.n_gata ? `þ.kr/m², miðgildi ${ny.n_gata} ${ny.n_gata === 1 ? 'sölu' : 'sölna'} síðustu 2 ár` : 'engar sölur síðustu 2 ár');
  set('pn', ny.fm_pn ? fmtInt(ny.fm_pn) : '—', `þ.kr/m², ${d.flokkur === 'sumar' ? 'sumarhús' : 'íbúðarhúsnæði'} í ${postnr}`);
  if (ny.fm_gata && ny.fm_pn && ny.n_gata >= 3) {
    const m = Math.round((ny.fm_gata / ny.fm_pn - 1) * 100);
    set('mun', (m > 0 ? '+' : m < 0 ? '−' : '±') + Math.abs(m) + '%', m > 0 ? `dýrari á fermetra en ${postnr}` : m < 0 ? `ódýrari á fermetra en ${postnr}` : `sama og ${postnr}`);
  } else set('mun', '—', 'of fáar nýlegar sölur til samanburðar');
  set('ls', fmtInt((d.a_solu || []).length), 'eignir í götunni');

  // Graf: ársmeðaltal götunnar (punktar, stærri með fleiri sölum) ofan á póstnúmerið
  const pts = (d.ar_gata || []).map(a => ({ t: Date.UTC(a.ar, 6, 1), v: Number(a.fm), r: Math.min(9, 3.5 + Math.sqrt(a.n) * 1.3),
    title: `${a.ar}: ${fmtInt(a.fm)} þ.kr/m², ${a.n} ${a.n === 1 ? 'sala' : 'sölur'}` }));
  $('kg-fig').hidden = !kSoguGraf($('kg-graf'), $('kg-legend'), pts, d.ar_pn || [],
    { lina: false, hvTxt: `Meðalverð á ${teg} í ${postnr}`, ptsTxt: `${d.gata}, meðaltal ársins (stærri punktur = fleiri sölur)`,
      aria: `Meðalfermetraverð í ${d.gata} eftir árum borið saman við ${postnr}: ${pts.map(p => p.title).join('; ')}.` });

  // Á sölu núna
  const A = d.a_solu || [];
  $('kg-asolu-box').hidden = !A.length;
  $('kg-asolu').innerHTML = A.map(l => {
    const lk = l.haest && l.haest > l.verd ? ` <span class="kg-muted">(lækkað úr ${fmtMkr(l.haest / 1000)})</span>` : '';
    return `<li><b>${vmEsc(String(l.heimilisfang).replace(/\s*\(\d{3}\)$/, ''))}</b>${l.staerd ? `, ${vmM2(l.staerd)}` : ''}: ${l.verd > 0 ? fmtMkr(l.verd / 1000) : 'tilboð'}${lk}${l.linkur ? ` · <a href="${l.linkur}" target="_blank" rel="noopener">Opna auglýsingu</a>` : ''}</li>`;
  }).join('');

  // Allar sölur (nýjast fyrst); heimilisfang → eignasíða
  const S = d.solur || [];
  $('kg-solur').innerHTML = S.map(x => `<tr>
      <th scope="row" style="text-align:left;font-weight:600"><a href="#eign/${x.fastnum}">${vmEsc(x.heimilisfang)}</a><span class="k-sub" style="display:block;font-weight:400">${vmEsc(VM_TEG[x.tegund]?.[0] || x.tegund)}, ${vmM2(x.einflm)}</span></th>
      <td style="color:var(--k-muted)">${fmtDagAr(x.dags)}</td>
      <td class="r" style="font-weight:700">${fmtMkr(x.kaupverd)}</td>
      <td class="r">${fmtInt(x.fm)}</td></tr>`).join('');
  kMore($('kg-solur-more'), [...$('kg-solur').querySelectorAll('tr')], 15, 'sölur');
  $('kg-solur-sub').textContent = d.n > S.length ? `${fmtInt(S.length)} nýjustu af ${fmtInt(d.n)}` : '';
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
const VIEW_HASH = { yfirlit: 'yfirlit', hofud: 'hofud', akureyri: 'akureyri', reykjanesbaer: 'reykjanesbaer', selfoss: 'selfoss', akranes: 'akranes', sumar: 'skorradalur', grimsnes: 'grimsnes', blaskogar: 'blaskogabyggd', hiti: 'markadshiti', verdmat: 'verdmat', gata: 'gata' };
// Titill vafraflipa (og sögu) eftir flipa; forsíðan heldur aðaltitlinum
const VIEW_TITLE = { hofud: 'Höfuðborgarsvæðið', akureyri: 'Akureyri', reykjanesbaer: 'Reykjanesbær', selfoss: 'Selfoss', akranes: 'Akranes', sumar: 'Skorradalur', grimsnes: 'Grímsnes', blaskogar: 'Bláskógabyggð', hiti: 'Markaðshiti', verdmat: 'Verðmat', gata: 'Verð í götunni' };
// Önnur þéttbýlissvæði nota sama skjáhluta og höfuðborgarsvæðið (view-hofud), sumarhúsasvæðin skjáhluta Skorradals (view-sumar)
const VIEW_DOM = { akureyri: 'hofud', reykjanesbaer: 'hofud', selfoss: 'hofud', akranes: 'hofud', grimsnes: 'sumar', blaskogar: 'sumar' };

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
    const on = b.dataset.view === (dom === 'hofud' ? 'svaedi' : dom === 'gata' ? 'verdmat' : dom);   // þéttbýlissvæðin undir „Svæði“, sumarhúsasvæðin undir „Sumarhús“
    b.classList.toggle('active', on);
    if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + dom));

  document.title = VIEW_TITLE[view] ? `${VIEW_TITLE[view]} – Fasteignavaktin` : 'Fasteignavaktin – fasteignaverð í tölum';

  const subEl = document.getElementById('header-sub');
  if (subEl) subEl.textContent = SUB_TEXTS[view] || '';
  if (push && view !== 'gata' && location.hash !== '#' + VIEW_HASH[view]) history.pushState(null, '', '#' + VIEW_HASH[view]);

  if (view === 'yfirlit') initYfirlit();
  else if (view === 'hiti') initHiti();
  else if (view === 'gata') {
    const m = location.hash.match(/^#gata\/(\d{3})\/(.+)$/);
    if (m) kgOpen(parseInt(m[1], 10), decodeURIComponent(m[2]));
    window.scrollTo({ top: 0 });
  }
  else if (view === 'verdmat') {
    initVerdmat();
    const m = location.hash.match(/^#eign\/F?(\d{7})$/);
    if (m && m[1] !== VM.units[VM.unit]?.fastnum) vmOpenFastnum(m[1]);
  }
  else if (dom === 'sumar') initSumar(view);
  else if (dom === 'hofud') { khSetSvaedi(view); khInitFromForm(); }
}

function viewFromHash() {
  const h = location.hash.replace('#', '');
  if (/^eign\/F?\d{7}$/.test(h)) return 'verdmat';
  if (/^gata\/\d{3}\/.+/.test(h)) return 'gata';
  return Object.keys(VIEW_HASH).find(k => VIEW_HASH[k] === h) || 'yfirlit';
}

// „Svæði“ og „Sumarhús“ opna síðasta valda svæðið; hvert svæði hefur áfram eigin slóð (#selfoss, #grimsnes o.s.frv.)
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => showView(btn.dataset.view === 'svaedi' ? hofudSvaedi : btn.dataset.view === 'sumar' ? KS.sv : btn.dataset.view));
});
document.querySelectorAll('.ks-seg [data-ssv]').forEach(btn => {
  btn.addEventListener('click', () => { if (btn.dataset.ssv !== KS.sv) showView(btn.dataset.ssv); });
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

// ---- Götuleit í sumarhúsaflipanum ----
let _streetFilterTimer = null;
document.addEventListener('input', e => {
  if (e.target.id !== 'avs-filter') return;
  clearTimeout(_streetFilterTimer);
  _streetFilterTimer = setTimeout(() => ksFilter(e.target.value), 200);
});

// ---- Startup: forsíða nema slóðin vísi á svæði (#hofud, #skorradalur, #grimsnes …) ----
showView(viewFromHash(), { push: false });
