# ibud v2 — Sumarhúsavaktin

Icelandic real estate dashboard for the Skorradalssvæðið area (postal code 311). Shows price trends, market listings, and sales data for summer houses.

## Stack

- **Frontend:** Vanilla HTML/CSS/JS — no build step, loaded directly in browser
- **Gögn:** Supabase Cloud (`nzuwplawwnlnjnbdpmei`, eu-central-2)
- **CDN/Proxy:** Cloudflare (`sumar.silfran.com`)
- **Hosting:** Hetzner VPS — `/home/arnisk/web/newibud/`

## Development Workflow

- Unnið staðbundið á Mac í `~/Projects/newibud/`
- Prófa staðbundið: `python3 verkfaeri/thjonn.py` → http://localhost:8000 (talar við **sömu** Supabase Cloud gögn og raunsíðan). Ekki `python3 -m http.server` – hann skilar 404 á síðuslóðum eins og /gata/…
- Git: `git push` frá Mac → GitHub (`github.com/arnidavid/newibud`, SSH) → `git pull` á VPS → strax live
- **Enginn Docker/scp** — síðan keyrir beint á VPS úr git repo

## Architecture

- `index.html` — layout and Chart.js canvases, script tags með `?v=N` cache-busters. Slóðir á skrár byrja á `/` (síðan er líka þjónuð á /gata/101/…)
- **Slóðir:** `/`, `/hofud`, `/skorradalur` … (`VIEW_HASH`), `/eign/<fastanúmer>`, `/gata/<postnr>/<gata>`. nginx skilar index.html fyrir þær (`verkfaeri/nginx_slodir.conf`); gamlar `#`-slóðir eru fluttar í app.js. Nýr flipi = bæta í `VIEW_HASH`, `verkfaeri/nginx_slodir.conf` (+ á VPS), `verkfaeri/thjonn.py` og `verkfaeri/sitemap.py`
- `sitemap.xml`, `robots.txt` — búið til með `python3 verkfaeri/sitemap.py` (götur með ≥3 sölur); keyra aftur öðru hvoru
- `api.js` — Supabase/PostgREST API module (IIFE pattern, exposed as `API`)
- `app.js` — all chart rendering, data processing, UI logic
- `style.css` — styles

## Data Sources

- **Supabase** (kaupskrá) — registered property sales, materialized views for price trends
- **fastinn.is** (Algolia) — current market listings

## Supabase breytingar

- `migrations/` — SQL fyrir views/RPC föll sem búin eru til í Supabase. Vista nýjar breytingar hér svo saga sé í git.
- Supabase Cloud er raunkerfi — sýna SQL og fá samþykki áður en DDL/gögnum er breytt.

## Supabase Auth

```javascript
const SUPABASE_URL = 'https://nzuwplawwnlnjnbdpmei.supabase.co/rest/v1';
// Auth: Authorization: Bearer ANON_KEY + apikey: ANON_KEY headers
// EKKI ?apikey= query param — það er legacy self-hosted pattern
```

## Deploy

```bash
# Á Mac:
git push origin master

# Á VPS:
cd /home/arnisk/web/newibud
git pull --ff-only
```

Skrárnar eru þjónaðar beint af VPS úr `/home/arnisk/web/newibud/`. Live at `https://sumar.silfran.com`.

Eftir breytingar á JS/CSS: bæta `?v=N` við script/link tags í `index.html` til cache-busting.

## Key Concepts

- `POSTNR = 311` — Skorradalssvæðið postal code
- `HVERFI` — list of neighbourhoods within the area (Fitjahlíð, Dagverðarnes, Vatnsendahlíð, etc.)
- `VNV` — Icelandic CPI values by year, used for real price calculations
- Fermetraverð (fm.verð) = price per square meter in thousands of ISK (þ.kr/m²)
- `onothaefur_samningur` — invalid/non-arm's-length contracts, filtered out
- `kaupverd` er í þúsundum ISK (þ.kr) — fastinn.is Algolia skilar fullu ISK → deila með 1000

## Þekktar gildrur

- `tegund=in.(...)` — virkar EKKI, nota `tegund=eq.Sumarhús`
- `Prefer: count=exact` — sleppa, veldur CORS preflight
- `onothaefur_samningur` — geymt sem string, nota `neq.1` ekki `is.null`
- Outlier filter alltaf: `einflm > 0 && kaupverd/einflm < 2000 && kaupverd/einflm > 10`
- **Nýjar töflur/samantektir í `public` (frá 30. okt. 2026):** Supabase gefur ekki lengur sjálfkrafa aðgang. Sama migration þarf `grant select on public.X to anon;` (ef síðan les hana) og `grant select, insert, update, delete on public.X to service_role;` (ef n8n skrifar). Annars „permission denied“. Föll: `grant execute` eins og áður. Á líka við ef tafla er felld og búin til aftur
- **Ekki sækja nýja skráarslóð (`?v=N`) fyrr en hún er komin í loftið** – Cloudflare geymir svarið í 30 daga (`immutable`)

## API Module (`API.*`)

- `API.query(endpoint, params, options)` — single paginated GET
- `API.fetchAll(endpoint, params, options)` — auto-fetches all pages (max 50 pages safety limit)
- `API.rpc(functionName, body)` — POST to Supabase RPC functions
- Convenience methods: `getManadarsolur` (RPC, mánaðarsamantekt), `getSolurGotur` (RPC, sölur á götum), `getKaupskra`, `getListingsDb`
