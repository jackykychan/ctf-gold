# Gold Price Tracker (Chow Tai Fook, HK)

A small dashboard that tracks Chow Tai Fook's **9999 gold** Buy/Sell prices
(飾金賣出價 / 飾金買入價) over time and shows every intraday change. A single Node
process polls the public API on an adaptive schedule, stores each new price in
SQLite, and serves a mobile-friendly, desktop-optimized dashboard to every
visitor — so the history is shared and persistent.

## Features

- **Chart** of Buy + Sell (`originGoldPrice`, HKD per 兩) with 5D / 2W / 1M / 3M / 6M ranges.
- **Buy / Sell / Both** toggle for both the chart and the change-cards.
- **Stacked change-cards**, newest on top: price, timestamp, and % change vs the previous point.
- **Adaptive polling** that catches intraday updates without hammering the API.
- **Light / dark theme** (defaults to system) and **English / Traditional Chinese** (defaults to browser language), with **Lucide** icons in the shadcn/ui pickers.
- Written in **TypeScript** end-to-end; modular and unit-tested.

## Stack

- **Production:** **Cloudflare Workers** (API + static site) + **D1** (SQLite-compatible DB) + **Cron Triggers** (poller). Free, always-on. Router is **Hono**; the Worker lives in `worker/`.
- **Local dev:** the same **Hono** router served by **@hono/node-server** with **better-sqlite3** and the adaptive in-process poller (`src/server.ts`).
- **Frontend:** **React 18 + Tailwind CSS v4 + shadcn/ui** (Radix primitives) with **Lucide** icons; Chart.js for the price chart. Bundled by esbuild; Tailwind compiled by its own CLI. Served as static assets by the Worker.
- The data layer is behind one interface (`src/data/repository.ts`) with two backends: better-sqlite3 (`priceRepository.ts`, local/tests) and D1 (`worker/d1Repository.ts`, prod).

## Requirements

- Node.js **≥ 20.6**. For deploying: a free **Cloudflare** account (`wrangler` is a dev dependency).

## Quick start (local)

```bash
npm install
npm run seed              # optional: load ~6 months of FAKE data to explore the UI
npm run dev               # Node (Hono) server + esbuild watch + tailwind watch  -> http://localhost:3000
```

To run the **actual production stack locally** (Workers + local D1, offline via Miniflare):

```bash
npm run cf:migrate:local  # create + migrate the local D1
npm run dev:worker        # builds the frontend, then `wrangler dev` -> http://localhost:8787
```

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Local Node (Hono) server + React bundle + Tailwind, watch mode. |
| `npm run dev:worker` | Build frontend, then run the Worker + local D1 via `wrangler dev`. |
| `npm run build` | Compile backend to `dist/` (local), bundle `public/app.js`, build `public/styles.css`. |
| `npm run typecheck` | Type-check backend, frontend, and Worker (three tsconfigs). |
| `npm test` | Run the unit/route tests (`node --test` via tsx). |
| `npm run seed` | Insert synthetic 6-month history into the local SQLite (dev only). |
| `npm run deploy` | Build the frontend and `wrangler deploy` the Worker. |
| `npm run cf:db:create` | `wrangler d1 create ctf-gold` (one-time). |
| `npm run cf:migrate` / `:local` | Apply D1 migrations to the remote / local database. |

> shadcn/ui components live in `web/components/ui/` and are configured via `components.json`
> (aliases map `@/*` → `web/*`). Add more with `npx shadcn@latest add <component>`.

## Deploy to Cloudflare (free)

One-time setup:

```bash
npx wrangler login                       # authorise wrangler with your Cloudflare account
npm run cf:db:create                     # creates the "ctf-gold" D1 database
# -> copy the printed database_id into wrangler.jsonc (replace REPLACE_WITH_D1_DATABASE_ID)
npm run cf:migrate                       # apply migrations to the remote D1
npm run deploy                           # first manual deploy -> https://ctf-gold.<subdomain>.workers.dev
```

Automatic deploys: push to GitHub, then add repo secrets **`CLOUDFLARE_API_TOKEN`** (Workers + D1 edit
permissions) and **`CLOUDFLARE_ACCOUNT_ID`**. Thereafter every merge to `main` runs
`.github/workflows/deploy.yml` (typecheck → test → build → migrate → deploy). CI
(`.github/workflows/ci.yml`) runs on every push/PR.

Production starts with an **empty** D1 (the local seed/DB is never deployed) and accrues only real data.

## Monitoring & runbook

- **Health:** `GET /api/health` is liveness-aware — `200 {status:"ok"}` normally, `503 {status:"degraded"}`
  when no poll has run within `HEALTH_STALE_AFTER_MIN` (default 30). Point **UptimeRobot** (free) at it.
- **Analytics:** enable **Cloudflare Web Analytics** and paste its beacon `<script>` into `public/index.html`
  (the CSP in `public/_headers` already allows `static.cloudflareinsights.com`). Infra metrics + cron
  run status are automatic in the Workers dashboard; `wrangler tail` streams logs.
- **Recover:** `npx wrangler rollback` reverts a bad deploy instantly; **D1 Time Travel** restores data.
- **Failure modes:** upstream API down/shape-change → the cron logs & skips, the site stays up on stored
  data (fix `src/api/parseGoldPrice.ts` / `goldPriceClient.ts` if the payload changed). Cron stopped →
  `/api/health` goes degraded; check `triggers.crons` in `wrangler.jsonc`.

## Configuration (env)

Local dev reads `process.env`; the Worker reads `vars` in `wrangler.jsonc`.

| Variable | Default | Meaning |
| --- | --- | --- |
| `PORT` | `3000` | Local dev HTTP port (Node only). |
| `DB_PATH` | `./data/gold.db` | Local SQLite file (Node only; prod uses D1). |
| `API_URL` | Chow Tai Fook HK endpoint | Source API. |
| `HEALTH_STALE_AFTER_MIN` | `30` | `/api/health` reports degraded past this poll age. |
| `START/MIN/MAX_POLL_INTERVAL_MIN` | `15/5/120` | Local adaptive poller bounds (Node only). |
| `SYNC_SECRET` | _(unset)_ | Bearer secret gating `POST /api/import`; empty disables it. Set via `wrangler secret put SYNC_SECRET`. |

## Google Sheet sync

A Google Apps Script bridges the manual **Gold Price** sheet with the site — a
one-time historical import and an hourly daily-high write-back. See
[`apps-script/README.md`](apps-script/README.md). Endpoints: `POST /api/import`
(secret-gated bulk insert) and `GET /api/daily-high` (public).

## Polling

- **Production (Worker):** a fixed **Cron Trigger** (every 10 min by default — see
  `triggers.crons` in `wrangler.jsonc`) fetches, parses, and inserts new points;
  `INSERT OR IGNORE` dedupes unchanged updates. ~144 lightweight calls/day.
- **Local (Node):** an adaptive self-scheduling poller — start at 15 min, back off
  +15 after 3 no-change polls, and reset to the observed gap on a change (clamped
  to `[MIN, MAX]`). Both share the `runPollOnce` core (`src/pollCore.ts`).

## Architecture

Layered and modular — dependencies point downward only:

```
src/
  config / shared-types          leaf modules (shared with the frontend)
  api/ (client, pure parser)
  data/ repository (interface)   both backends implement it:
        priceRepository (sqlite)   - local dev + tests
  domain/ (scheduler, changes)   PURE, unit-tested
  services/                      historyService, dependency-injected
  http/api                       Hono router (history / latest / health)
  pollCore                       runtime-agnostic fetch->parse->insert
  poller                         Node adaptive self-scheduling loop
  server.ts                      Node dev entry (@hono/node-server)
worker/
  index.ts                       Worker fetch (Hono) + scheduled (cron)
  d1Repository.ts                D1 backend (prod)
web/                             React frontend (esbuild bundle)
  components/ui/                 shadcn/ui primitives
  i18n / theme / format          pure helpers reused from the backend types
```

The pure core (`parseGoldPrice`, `scheduler`, `changes`) has no I/O, so it is
deterministic and directly unit-tested. The **series registry** in
`src/config.ts` drives the parser, storage, API shape, chart, and cards — adding
a new series later is a one-line edit. The **repository interface** keeps the DB
swappable (e.g. to Postgres) if a future feature needs it.

## Known limitations

- The upstream endpoint is unofficial; the poller sends a browser `User-Agent`
  (a CloudFront edge returns 403 otherwise) and skips gracefully on outages.
- Seeded data is synthetic and local-only. Delete `data/gold.db` to clear it;
  production D1 only ever holds real data.
