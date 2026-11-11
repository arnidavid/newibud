// Kóði hnútsins „Lesa eignasíður“ í n8n-flæðinu visir_eignasidur.
// Flæðið: á 30 mín. fresti → rpc/visir_vantar_eignasidu (40 síður) → Lesa eignasíður → rpc/vista_eignasidur.
// Sjá ~/Projects/newibud/migrations/2026-11-11_visir_eignasidur_nybyggingar.sql
//
// Eignasíða visir sýnir „Byggt 2024“ (description__head-text) og PropertyId: "F2530344" (= fastanúmer 2530344).
// Horfin auglýsing vísar á 404.html → ekkert finnst, en línan fær samt fastnum_sott og er reynd aftur eftir 14 daga.
const items = $input.all().map(i => i.json).filter(r => r.id && r.linkur);
const wait = ms => new Promise(res => setTimeout(res, ms));
const arNu = new Date().getFullYear();
const rows = [];
let fundid = 0, villur = 0;

for (const r of items) {
  let byggar = null, fastnum = null;
  try {
    const html = String(await helpers.httpRequest({
      method: 'GET', url: r.linkur, json: false, timeout: 20000,
      headers: { 'User-Agent': 'Mozilla/5.0 (Fasteignavaktin; sumar.silfran.com)' }
    }));
    const b = html.match(/description__head-text">\s*Byggt\s+(\d{4})\s*</);
    if (b && +b[1] >= 1700 && +b[1] <= arNu + 3) byggar = +b[1];
    const f = html.match(/PropertyId:\s*"F?(\d{7})"/);
    if (f) fastnum = f[1];
    if (byggar) fundid++;
  } catch (e) { villur++; }           // síða horfin eða villa – reynt aftur eftir 14 daga
  rows.push({ id: r.id, byggar, fastnum });
  await wait(1500);
}

// Ef ALLAR síður klikka er eitthvað að (t.d. lokað á okkur): stoppa svo villuvaktin láti vita
if (rows.length >= 10 && villur === rows.length) {
  throw new Error(`visir_eignasidur: allar ${rows.length} síður skiluðu villu – hefur visir lokað á okkur?`);
}
return rows.length ? [{ json: { p_rows: rows, fundid, villur, alls: rows.length } }] : [];
