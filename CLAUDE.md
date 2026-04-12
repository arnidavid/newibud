# ibud v2 — Sumarhúsavaktin

Icelandic real estate dashboard for the Skorradalssvæðið area (postal code 311). Shows price trends, market listings, and sales data for summer houses.

## Stack

- **Frontend:** Vanilla HTML/CSS/JS — no build step, loaded directly in browser
- **Gögn:** Supabase Cloud (`nzuwplawwnlnjnbdpmei`, eu-central-1)
- **CDN/Proxy:** Cloudflare (`sumar.silfran.com`)
- **Hosting:** Hetzner VPS — `/home/arnisk/web/newibud/`

## Development Workflow

- Vinnur á Mac í `~/newibud/`
- Claude Code keyrir á Mac
- Git: `git push` → GitHub (`github.com/arnidavid/newibud`) → `git pull` á VPS
- Deploy á VPS: `bash deploy.sh`

## Architecture

- `index.html` — layout and Chart.js canvases, script tags með `?v=N` cache-busters
- `api.js` — Supabase/PostgREST API module (IIFE pattern, exposed as `API`), Algolia, VNV
- `app.js` — all chart rendering, data processing, UI logic
- `style.css` — styles

## Data Sources

- **Supabase** (kaupskrá) — registered property sales, materialized views for price trends
- **fastinn.is** (Algolia) — current market listings
- **Google Sheets** (gviz API) — scraped fastinn.is listing data (via n8n automation)

## Supabase Auth

```javascript
const SUPABASE_URL = 'https://nzuwplawwnlnjnbdpmei.supabase.co/rest/v1';
// Auth: Authorization: Bearer ANON_KEY + apikey: ANON_KEY headers
// EKKI ?apikey= query param — það er legacy self-hosted pattern
```

## Deploy

```bash
# Á VPS:
git pull origin master
bash deploy.sh
```

Deploys via `scp` to Docker host at `192.168.100.204`, into `/root/docker_volumes/ibud/html`. Live at `https://ibud.silfran.com`.

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

## API Module (`API.*`)

- `API.query(endpoint, params, options)` — single paginated GET
- `API.fetchAll(endpoint, params, options)` — auto-fetches all pages (max 50 pages safety limit)
- `API.rpc(functionName, body)` — POST to Supabase RPC functions
- Convenience methods: `getVerdthounPostnr`, `getArssamanburdur`, `getHreyfanlegtMedaltal`, `getSumarhusStats`, `getNyjustuSolur`, `getSheetListings`
