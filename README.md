# Test Task Dashboard

A dashboard of widgets (line, bar, stacked bar, pie, text) in a three-column grid. The
initial charts are built from the provided `.xlsx` and `.csv` files by a reusable import
pipeline.

**Live:** https://erys-6t72.vercel.app

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
npm run setup          # once: creates apps/api/.env if missing, migrates, imports the initial dashboard
npm run dev            # API on http://localhost:3000/api + web on http://localhost:5173 (proxies /api)
```

`setup` is safe to re-run: it keeps an existing `.env`, applies only pending migrations and
skips widgets that are already seeded. If the database is not at the default URL, edit
`DATABASE_URL` in `apps/api/.env` and run `npm run setup` again. `npm run dev:api` and
`npm run dev:web` start the servers separately.

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
