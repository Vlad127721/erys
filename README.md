# YouScan Dashboard

A dashboard of widgets (line, bar, stacked bar, pie, text) in a three-column grid. The
initial charts are built from the provided `.xlsx` and `.csv` files by a reusable import
pipeline. Nothing is hardcoded.

- **Frontend:** React 19, TypeScript, Vite, TanStack Query, Recharts, Tailwind CSS 4
- **Backend:** Node 24, Express 5, Prisma 7, PostgreSQL
- **Shared:** `@youscan/shared`, the zod schemas behind every API contract, used by both sides

```
data/                 provided files + seed manifest (what the initial dashboard is built from)
packages/shared/      zod schemas: widget payloads, chart data, import mapping
apps/api/             Express API: routes (src/http), services, repository, import pipeline
apps/web/             React app
```

## Running locally

Requires Node 20.19+ (24 recommended) and PostgreSQL (`docker compose up -d` starts one).

```bash
npm install
cp apps/api/.env.example apps/api/.env      # adjust DATABASE_URL if needed
npm run build -w @youscan/shared
npm run db:migrate
npm run build -w @youscan/api && npm run db:seed   # import the initial dashboard
npm run dev:api        # http://localhost:3000/api
npm run dev:web        # http://localhost:5173 (proxies /api to the API)
```

Checks from the repo root:

```bash
npm run typecheck
npm test               # API integration tests need TEST_DATABASE_URL (a disposable DB); they are skipped without it
```

## Data import

### Pipeline

```
file ─► ParserRegistry ─► FileParser ─► RawTable[] ─► normalizeTable ─► mapTableToWidget ─► zod ─► one transaction
        (by extension)    (.xlsx/.csv)  (cells as-is)  (header, empty      (explicit mapping)   (shared
                                                        rows/columns)                          schema)
```

- **Parsers** (`apps/api/src/ingestion/parsers`) only turn bytes into cell grids: ExcelJS for
  `.xlsx`, `csv-parse` for `.csv`. A new format is one class implementing `FileParser`,
  registered in `ParserRegistry`.
- **XLSX cells:** formulas are not evaluated; the result Excel saved with the file is
  imported, so `0` and `FALSE` stay as they are. A formula with no saved result is an empty
  cell, the same as one returning `""`; ExcelJS cannot tell the two apart. Rich text and
  hyperlinks import as their display text. Excel errors (`#N/A`, `#DIV/0!`, …) and
  unsupported values fail the import, naming the sheet and cell.
- **Normalization:** the first non-empty row is the header. Fully empty rows are dropped
  (the provided workbook has ~790 formatted but empty rows). Header-less columns are dropped
  if empty and rejected if they hold data. Duplicate column names are rejected.
- **Mapping** is always explicit; columns are never guessed. Two shapes cover both files:

  | shape  | meaning | provided example |
  |--------|---------|------------------|
  | `wide` | one row per category, one column per series | `stacked-bar.csv`: `Brand` × `Positive/Neutral/Negative` |
  | `long` | one row per (x, series) pair, pivoted | `line chart data`: `Date` × `Campaign` → `Result` |

  Dates (Excel date cells or `YYYY-MM-DD` strings) become ISO dates and are sorted
  chronologically. Other categories keep file order. Empty cells become `null` gaps, never `0`.
  Duplicate points, non-numeric values and unknown columns/sheets fail with a 400 that names
  the column and row.
- **Atomicity:** every target of an import is parsed and validated before the first write,
  and all resulting widgets are saved in one transaction.

### Importing a new file

Additional files are imported over HTTP (`multipart/form-data`); the same `IngestionService`
backs the seed:

```bash
curl -X POST http://localhost:3000/api/import \
  -F file=@sales.xlsx \
  -F 'targets=[{"widgetType":"LINE","title":"Sales","sheet":"2025",
               "mapping":{"shape":"long","x":"Date","series":"Region","value":"Amount"}}]'
```

### Seed

`data/seed-manifest.json` lists the initial widgets, each with a stable `sourceKey`
(`initial-dashboard#line`, …), the file, sheet and mapping. `npm run db:seed` is idempotent:
widgets whose `sourceKey` already exists are skipped, so re-running never duplicates widgets
or overwrites changes. `--replace` explicitly re-imports the files into the existing widgets
in place. Seeding is a one-off command, not part of startup. If it ran on every deploy, it
would bring back initial widgets that a user had deleted.

## API

| Method | Path | Notes |
|--------|------|-------|
| `GET` | `/api/widgets` | Metadata only (`id`, `type`, `title`, `updatedAt`), in creation order |
| `GET` | `/api/widgets/:id/data` | `{ id, type, data }`; data validated against the type's schema on read |
| `POST` | `/api/widgets` | `{ type, title? }`. Chart widgets get random data, generated once and stored |
| `PUT` | `/api/widgets/:id/text` | `{ text }`; 422 for non-text widgets |
| `DELETE` | `/api/widgets/:id` | 204 |
| `POST` | `/api/import` | See above; 415 for unsupported file types, 413 over `MAX_UPLOAD_SIZE_BYTES` (default 5 MiB) |
| `GET` | `/api/health` | Checks the database |

Request bodies are validated with the shared zod schemas (400 with `issues`). Ids must be
UUIDs (400). Missing widgets return 404. Stored data that fails validation returns 500 for
that widget only.

## Frontend: loading and errors per widget

The list request returns layout only. Each widget then fetches its own data with its own
query key, so it loads, fails and retries independently (one slow or broken widget does not
block the others). Each card also has an error boundary for render-time crashes, and
mutations (delete, save text) report errors inside their own card. If the list itself
fails, there is no grid to show, so the page shows a single error with Retry.

Chart colours follow the entity, not its position: brand A is the same blue in the line
chart, the pie and new charts. Sentiment uses a diverging blue / gray / red scale. Both
palettes have light and dark variants.

## Deployment

One Vercel project with two **services** (`vercel.json` at the repository root), on one domain:

| Service | Source | Public path | Build |
|---|---|---|---|
| `web` | `apps/web` (Vite) | `/` | shared contracts, then the web app → `apps/web/dist` |
| `api` | `apps/api` (Express) | `/api/*` | `scripts/vercel-build-api.sh`: shared contracts, the API, then migrations on production |

- The API service's entrypoint is the built `apps/api/dist/vercel.js`, which exports the Express
  app; it keeps the `/api` prefix, so paths are the same as locally. The web app calls the API on
  the same origin (`/api`), so there is no CORS setup, no `VITE_API_URL` and no service bindings.
- **Database:** Neon PostgreSQL through Vercel's Neon integration, which sets `DATABASE_URL`
  (pooled, used by the app) and `DATABASE_URL_UNPOOLED` (used by migrations). Preview builds never
  migrate. Also set `MAX_UPLOAD_SIZE_BYTES=4194304`: function request bodies are capped at 4.5 MB.
  Functions run in Frankfurt (`regions: ["fra1"]`), next to Neon `eu-central-1`.
- **Seed** once after the first deploy, from a local checkout:
  `npm run build -w @youscan/api && DATABASE_URL=<neon unpooled url> npm run db:seed`.

## Decisions and trade-offs

- **One `widgets` table with a JSON `data` column** instead of normalized chart tables. The
  payload shape depends on the widget type and is enforced by the shared discriminated union
  on write and on read.
- **One data request per widget:** 3–10 small requests per dashboard (cheap over HTTP/2) in
  exchange for real per-widget loading and error states.
- **Random data is persisted** when a chart is created, so a widget shows the same chart
  after a reload.
- **Order** is creation order (`createdAt`). Reordering was not required, so there is no
  position column.