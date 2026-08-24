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

- **Backend:** Node + Express + SQLite (`better-sqlite3`), CommonJS via `tsc`.
- **Frontend:** **React 18 + Tailwind CSS v4 + shadcn/ui** (Radix primitives) with **Lucide** icons; Chart.js for the price chart. Bundled by esbuild; Tailwind compiled by its own CLI.

## Requirements

- Node.js **≥ 20.6** (uses global `fetch` and `node --import tsx --test`).

## Quick start

```bash
npm install
cp .env.example .env      # optional; sensible defaults are built in
npm run seed              # optional: load ~6 months of FAKE data to explore the UI
npm run dev               # backend (tsx watch) + esbuild watch + tailwind watch
```

Then open http://localhost:3000.

For a production-like run:

```bash
npm run build             # tsc -> dist/, esbuild -> public/app.js, tailwind -> public/styles.css
npm start                 # node dist/server.js
```

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Watch-mode backend + React bundle + Tailwind CSS (3 processes via concurrently). |
| `npm run build` | Compile backend to `dist/`, bundle the React app to `public/app.js`, and build `public/styles.css`. |
| `npm start` | Run the compiled server. |
| `npm run typecheck` | Type-check backend and frontend (esbuild does not type-check). |
| `npm test` | Run the unit/route tests (`node --test` via tsx). |
| `npm run seed` | Insert synthetic 6-month history for manual testing. |

> shadcn/ui components live in `web/components/ui/` and are configured via `components.json`
> (aliases map `@/*` → `web/*`). Add more with `npx shadcn@latest add <component>`.

## Configuration (env)

| Variable | Default | Meaning |
| --- | --- | --- |
| `PORT` | `3000` | HTTP port. |
| `DB_PATH` | `./data/gold.db` | SQLite file (point at a persistent volume when deployed). |
| `API_URL` | Chow Tai Fook HK endpoint | Source API. |
| `START_POLL_INTERVAL_MIN` | `15` | Starting poll interval. |
| `MIN_POLL_INTERVAL_MIN` | `5` | Lower clamp on the adaptive interval. |
| `MAX_POLL_INTERVAL_MIN` | `120` | Upper clamp on the adaptive interval. |

## How adaptive polling works

- Start at 15 min. After **3** consecutive polls with no change to the update
  time, add **15 min** to the interval (15 → 30 → 45 → …).
- When the update time **does** change, set the next interval to the observed gap
  between this update and the previous one, then resume the same backoff if
  changes stop again.
- The interval is always clamped to `[MIN, MAX]` so an overnight/weekend lull
  doesn't push the next poll hours out, and a tiny gap doesn't hammer the API.

## Architecture

Layered and modular — dependencies point downward only:

```
src/
  config / shared-types          leaf modules (shared with the frontend)
  api/ (client, pure parser)
  data/ (db, repository)         all SQL confined here
  domain/ (scheduler, changes)   PURE, unit-tested
  services/ -> routes/ -> app    express, dependency-injected (testable)
  poller                         orchestrates I/O + the pure scheduler
web/                             React frontend (esbuild bundle)
  components/ui/                 shadcn/ui primitives (Button, Select, Card, ToggleGroup)
  components/                    app components (Header, Controls, PriceChart, ChangeCards, ...)
  i18n / theme / format / api    pure helpers reused from the backend types
  chart.ts                       Chart.js setup (driven imperatively from PriceChart)
  index.css                      Tailwind v4 entry + shadcn theme tokens
```

The pure core (`parseGoldPrice`, `scheduler`, `changes`) has no I/O, so it is
deterministic and directly unit-tested. The **series registry** in
`src/config.ts` drives the parser, storage, API shape, chart, and cards — adding
a new series later is a one-line edit.

## Deploying (later)

Structured for an always-on host (Fly.io / Railway / Render / a VPS):

- Set `DB_PATH` to a **persistent volume** so history survives restarts.
- Run a **single instance** — the in-process poller must not be duplicated.
- `npm run build && npm start`.

## Known limitations

- **Local-first:** history is only captured while the process is running (your
  Mac awake). Full 24/7 capture needs the cloud deploy above.
- Adaptive backoff trades API traffic for latency: after a quiet stretch the
  interval grows, so the first update after a long pause can be noticed up to one
  (clamped) interval late; the observed-gap reset then re-tightens polling.
- Seeded data is synthetic. Delete `data/gold.db` to clear it.
