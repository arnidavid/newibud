// Kóði hnútsins „Lesa eignir“ í n8n-flæðinu visir_listings_scraper (zV9eHiAHTJJMfDF2).
// Flæðið: Daglega 01:30 → Fyrsta síða (getresults?stype=sale&sort=created) → Síðulisti (searchid, síður 2..N)
//   → Sækja síður (HTTP, 1,5 sek. á milli) → Lesa eignir → Vista í Supabase (rpc/vista_visir, 500 í einu)
//   → Merkja fjarlægðar (rpc/merkja_fjarlaegdar_visir).

// Les eignir úr leitarniðurstöðum fasteignir.visir.is og skiptir í 500 raða pakka fyrir vista_visir.
// Sjá ~/Projects/newibud/migrations/2026-11-03_visir_safnari.sql
// Tegundir eru færðar í kóða fastinn.is svo síðan (TEGUND_MAP, mv_a_solu) virki óbreytt;
// fastinn skráði hæðir sem fjölbýli.
const TEG = {
  'Fjölbýli': 'fjolb', 'Hæð': 'fjolb', 'Einbýli': 'einb',
  'Raðhús': 'raðpar', 'Parhús': 'raðpar', 'Raðhús/Parhús': 'raðpar',
  'Sumarhús': 'sumarhus', 'Atvinnuhúsnæði': 'atv.', 'Jörð/lóð': 'lóð/jarðir', 'Hesthús': 'hesthus'
};
const ENT = { '&amp;': '&', '&quot;': '"', '&#039;': "'", '&#39;': "'", '&lt;': '<', '&gt;': '>', '&nbsp;': ' ' };
const txt = s => s.replace(/&[a-z#0-9]+;/gi, m => ENT[m] || m).replace(/\s+/g, ' ').trim();

const fyrsta = $('Fyrsta síða').first().json.data || '';
const heild = Number(((fyrsta.match(/#tracker-total'\)\.html\('([\d.]+)'/) || [])[1] || '0').replace(/\./g, ''));
const sidur = [fyrsta, ...$input.all().map(i => i.json.data || '')];

const eignir = new Map();
for (const html of sidur) {
  for (const c of html.split(/<div class="estate__item[ "]/).slice(1)) {
    const pid = (c.match(/href="\/property\/(\d+)"/) || [])[1];
    if (!pid) continue;
    const a = c.match(/estate__item-title">\s*<span>\s*([^<]*?)\s*<\/span>\s*<br>\s*(\d{3})/)
           || c.match(/estate__item-top">\s*<span>\s*([^<]*?)\s*<\/span>\s*,\s*(\d{3})/);
    if (!a) continue;
    const teg = (c.match(/<div class="estate__class[^"]*">\s*([^<]+?)\s*<\/div>/) || [])[1];
    const flm = (c.match(/estate__parameters--1">\s*([\d.,]+)\s*m²/) || [])[1];
    const verd = (c.match(/([\d.]+)\s*kr\./) || [])[1];
    const mynd = (c.match(/src="(https:\/\/api-beta\.fasteignir\.is\/pictures\/[^"]+\.jpg)"/) || [])[1];
    const r = {
      id: 'visir:' + pid,
      heimilisfang: txt(a[1]),
      tegund: TEG[teg ? txt(teg) : ''] || 'annad',
      postnr: Number(a[2]),
      verd: verd ? Number(verd.replace(/\./g, '')) : 0,
      staerd: flm ? Number(flm.replace(/\./g, '').replace(',', '.')) : null,
      myndir: null,
      linkur: 'https://fasteignir.visir.is/property/' + pid,
      mynd_url: mynd || null
    };
    // Auglýstar eignir efst á síðu sýna bara götuheiti: taka þá útgáfu sem hefur húsnúmer
    const fyrri = eignir.get(r.id);
    if (!fyrri || (!/\d/.test(fyrri.heimilisfang) && /\d/.test(r.heimilisfang))) eignir.set(r.id, r);
  }
}

// Öryggi: ef leitin skilaði óeðlilega fáum er ekkert vistað og ekkert merkt fjarlægt
const n = eignir.size;
if (n < 5000 || n < heild * 0.9) {
  throw new Error(`visir: aðeins ${n} eignir lesnar af ${heild} (${sidur.length} síður) – hefur leitarsíðan breyst? Engu breytt.`);
}

const rows = [...eignir.values()];
const out = [];
for (let i = 0; i < rows.length; i += 500) out.push({ json: { rows: rows.slice(i, i + 500), virkar: n, heild } });
return out;
