// Markaðshiti: reiknar mælikvarða úr söluferlum seldra eigna og eignum á sölu.
// Höfuðborgarsvæðið, Akureyri, Reykjanesbær og Selfoss eftir mánuðum (frá jan. 2025), Skorradalur eftir hálfum árum (frá júlí 2024)
// og „staðan núna“ fyrir Skorradal (eignir á sölu). Niðurstaðan er vistuð í public.markadshiti.
const URL = 'https://chmqzsxu3l-dsn.algolia.net/1/indexes/listing_index/query';
const QS = { 'x-algolia-application-id': 'CHMQZSXU3L', 'x-algolia-api-key': '9bfe0ddf26fdff0dd90dcdfc0e955eb7' };

async function hitsFor(filters) {
  const out = [];
  for (let page = 0; page < 10; page++) {
    const r = await helpers.httpRequest({ method: 'POST', url: URL, qs: QS, json: true,
      body: { query: '', filters, hitsPerPage: 1000, page } });
    out.push(...(r.hits || []));
    if (page + 1 >= (r.nbPages || 1)) break;
  }
  return out;
}
const median = a => { const s = [...a].sort((x, y) => x - y), n = s.length;
  return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : null; };
const r1 = v => v == null ? null : Math.round(v * 10) / 10;
const ms = (y, m) => Date.UTC(y, m - 1, 1);
const iso = (y, m) => `${y}-${String(m).padStart(2, '0')}-01`;

// Einn söluferill (journey) á eign, þótt hún hafi verið auglýst oft
function soldStats(hits) {
  const J = {};
  for (const h of hits) if (h.journeyId) J[h.journeyId] = h;
  const rows = Object.values(J).filter(h => h.journeySoldPrice && h.journeyMinPrice && h.journeyMaxPrice);
  if (!rows.length) return null;
  const ratio = rows.map(h => h.journeySoldPrice / h.journeyMinPrice).filter(r => r > 0.5 && r < 1.5);
  const days  = rows.map(h => h.journeyDaysToSale).filter(d => d != null && d >= 0 && d < 2000);
  return {
    n: rows.length,
    yfir_asettu:  ratio.length ? Math.round(100 * ratio.filter(r => r >= 1).length / ratio.length) : null,
    soluhlutfall: r1(median(ratio) * 100),
    dagar:        days.length ? Math.round(median(days)) : null,
    laekkad:      Math.round(100 * rows.filter(h => h.journeyMinPrice < h.journeyMaxPrice).length / rows.length)
  };
}

const rows = [];
const now = new Date();
const curY = now.getUTCFullYear(), curM = now.getUTCMonth() + 1;

// 1) Þéttbýlissvæði eftir mánuðum – skipt í póstnúmerahópa svo hver fyrirspurn sé undir 1000 færslum.
//    Höfuðborgarsvæðið: 101–116, 161–170 (Seltjarnarnes), 200–225 og 270 Mosfellsbær
//    (ekki 190 Vogar né 230 Reykjanesbær) – sama skilgreining og á síðunni (SVAEDI í app.js).
const MAN_SVAEDI = {
  hofud:    ['100 TO 108', '109 TO 113', '114 TO 170', '200 TO 205', '206 TO 225', '270 TO 270'],
  akureyri: ['600 TO 600', '603 TO 603'],
  reykjanesbaer: ['230 TO 233', '260 TO 262'],  // 230 Keflavík, 233 Hafnir, 260 Njarðvík, 262 Ásbrú
  selfoss:  ['800 TO 801']                      // ekki Eyrarbakki (820) né Stokkseyri (825)
};
for (const [svaedi, zips] of Object.entries(MAN_SVAEDI)) {
  for (let y = 2025, m = 1; y < curY || (y === curY && m <= curM); m === 12 ? (y++, m = 1) : m++) {
    const a = ms(y, m), b = m === 12 ? ms(y + 1, 1) : ms(y, m + 1);
    let hits = [];
    for (const z of zips) hits = hits.concat(await hitsFor(`journeyStatus:SOLD AND zip:${z} AND journeySoldAt_timestamp:${a} TO ${b - 1}`));
    const s = soldStats(hits);
    if (s) rows.push({ svaedi, gerd: 'manudur', timabil: iso(y, m), ...s });
  }
}

// 2) Skorradalur eftir hálfum árum (of fáar sölur á mánuði)
for (let y = 2024, h = 2; y < curY || (y === curY && (h === 1 || curM >= 7)); h === 2 ? (y++, h = 1) : h++) {
  const sm = h === 1 ? 1 : 7;
  const a = ms(y, sm), b = h === 1 ? ms(y, 7) : ms(y + 1, 1);
  const s = soldStats(await hitsFor(`journeyStatus:SOLD AND zip:311 AND journeySoldAt_timestamp:${a} TO ${b - 1}`));
  if (s) rows.push({ svaedi: 'skorr', gerd: 'halfar', timabil: iso(y, sm), ...s });
}

// 3) Skorradalur: eignir á sölu núna – tími á sölu og hlutfall sem hefur lækkað
{
  const J = {};
  for (const h of await hitsFor('removed:false AND zip:311')) J[h.journeyId || h.objectID] = h;
  const act = Object.values(J).filter(h => h.price && h.journeyMaxPrice);
  const age = act.map(h => h.journeyFirstListedAt_timestamp).filter(Boolean).map(t => (Date.now() - t) / 864e5);
  rows.push({ svaedi: 'skorr', gerd: 'nuna', timabil: now.toISOString().slice(0, 10), n: act.length,
    yfir_asettu: null, soluhlutfall: null,
    dagar: age.length ? Math.round(median(age)) : null,
    laekkad: act.length ? Math.round(100 * act.filter(h => h.price < h.journeyMaxPrice).length / act.length) : null });
}

const uppfaert = now.toISOString();
return [{ json: { rows: rows.map(r => ({ ...r, uppfaert })), alls: rows.length } }];
