# Google Sheet ↔ site sync (Apps Script)

Bridges the manually-maintained **Gold Price** sheet with the live site.

- **One-time import** (`importFromSheet`): reads the sell block (`B/C/D`) and buy
  block (`L/M`), normalises dates (`D/M/YYYY` → ISO) and prices (comma text →
  number, blanks skipped), and `POST`s them to `/api/import`. Idempotent.
- **Recurring write-back** (`syncDailyHighToSheet`): pulls `/api/daily-high` and
  upserts each day's **highest** sell/buy into the two blocks (overwriting the
  current day as its high rises; appending new dates with weekday for the sell
  block).

## Setup

1. On the site: set the Worker secret once —
   ```bash
   npx wrangler secret put SYNC_SECRET   # choose a long random value
   ```
2. In the Sheet: **Extensions → Apps Script**, paste `Code.gs`.
3. **Project Settings → Script Properties**:
   - `SITE_URL` = `https://ctf-gold.<subdomain>.workers.dev`
   - `SYNC_SECRET` = the same value you set on the Worker
4. Run `importFromSheet()` once (authorise when prompted). Check the dashboard now
   shows history back to June.
5. **Triggers** (clock icon) → add a time-driven trigger on
   `syncDailyHighToSheet()` (e.g. hourly).

## Notes

- Only `/api/import` (write) needs the secret; `/api/daily-high` is a public read.
- Adjust `TAB`, `SELL`, `BUY` at the top of `Code.gs` if columns change.
- Re-running the import is safe — rows dedupe on `(code, date)`.
