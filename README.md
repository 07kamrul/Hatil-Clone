# Casa Furnish — furniture catalog

A furniture catalog site with an admin panel. Visitors browse products, build a cart in their browser and
send the order as a prefilled **WhatsApp** message. There are no customer accounts, payments or server-side
orders. Only `/admin` requires a login.

| Part | Stack |
|---|---|
| `frontend/` | Angular 22 (standalone, signals, zoneless), SSR via `@angular/ssr`, Tailwind v4 |
| `backend/` | FastAPI, SQLAlchemy 2, Alembic, Pydantic v2, PostgreSQL |
| `backend/scripts/scraper` | Polite, resumable catalog importer |
| `nginx/` | Reverse proxy: `/api` → backend, `/uploads` → static files, everything else → SSR |

## Run with Docker

```bash
cp .env.example .env          # then edit secrets (see "Deploy")
docker compose up --build -d                  # add SEED_DEMO=true in front for the demo catalog
```

Nothing has to be run by hand after a deploy. The backend container's
[`docker-entrypoint.sh`](backend/docker-entrypoint.sh) runs on every start: it waits for PostgreSQL, runs
`alembic upgrade head`, runs the seed (idempotent: it creates the super admin, settings and taxonomy only if
missing), and then starts uvicorn. All four services have healthchecks, and each waits for the one it depends on.

| Variable | Default | Effect |
|---|---|---|
| `SEED_DEMO` | `false` | `true` also seeds demo products (skipped if they already exist) |
| `INSTALL_DEV` | `false` | Build arg: `true` installs pytest/ruff into the backend image |
| `DB_WAIT_SECONDS` | `60` | How long the entrypoint waits for the database |

Tests inside the stack: `INSTALL_DEV=true docker compose build backend && docker compose run --rm backend pytest`.

**Dokploy.** Create a *Compose* application pointing at this repo and `docker-compose.yml`, set the variables
from `.env.example` in its Environment tab, and deploy. Migrations and seeding happen automatically on each
deploy. The nginx config is built into its image (`nginx/Dockerfile`), so it doesn't depend on files on the
host. Put Dokploy's domain/TLS on the `nginx` service (port 80).

Open http://localhost for the site, http://localhost/admin for the admin panel and
http://localhost/api/docs for the API docs. The super admin is created from `SUPER_ADMIN_EMAIL` /
`SUPER_ADMIN_PASSWORD`. The defaults are `admin@example.com` / `ChangeMe123!` in development only.

## Run locally (without Docker)

Backend (from `backend/`):

```bash
python -m venv .venv && .venv/bin/pip install -r requirements-dev.txt   # Windows: .venv\Scripts\
export DATABASE_URL=sqlite:///dev.db UPLOAD_DIR=uploads                  # or a PostgreSQL URL
.venv/bin/alembic upgrade head
.venv/bin/python -m scripts.seed --demo
.venv/bin/python -m uvicorn app.main:app --port 8000
```

Frontend (from `frontend/`):

```bash
npm ci
npx ng serve                                           # http://localhost:4200, proxies /api and /uploads to :8000
npx ng build && node dist/frontend/server/server.mjs   # production SSR on :4000
```

## Tests

```bash
cd backend  && .venv/bin/python -m pytest -q --cov=app --cov=scripts   # SQLite in-memory
cd backend  && .venv/bin/ruff check app scripts tests
cd frontend && npx ng test --watch=false                               # vitest
```

## Deploy

1. **TLS.** nginx listens on plain HTTP port 80. Put a TLS terminator in front of it (a load balancer,
   Caddy, or certbot with an extra nginx `server` block on 443), and set `PUBLIC_BASE_URL` and `CORS_ORIGINS`
   to the `https://` origin.
2. **Secrets.** Set `ENVIRONMENT=production`, generate a fresh `JWT_SECRET`
   (`python -c "import secrets;print(secrets.token_urlsafe(48))"`), and set `SUPER_ADMIN_EMAIL`,
   `SUPER_ADMIN_PASSWORD` and `POSTGRES_PASSWORD`. In production the backend refuses to start with the
   placeholder JWT secret or admin password. Rotate `JWT_SECRET` if it is ever exposed: this logs out every
   admin session.
3. **Media storage.** The default is local disk (the `uploads` volume, served by nginx). To use S3, set
   `STORAGE_BACKEND=s3`, `S3_BUCKET`, `S3_REGION` and `S3_PUBLIC_URL`, and give the container AWS credentials
   in the usual way (env vars or an instance role).
4. **Email (optional).** Set `SMTP_*` and `ADMIN_NOTIFY_EMAIL` to receive an email for each contact message.
5. Run `alembic upgrade head` on every release.

The SSR server sends security headers (CSP, `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`)
and `Cache-Control: no-store` on `/admin`. nginx sends the same headers for the API and uploads.

## Scraper / catalog import

```bash
cd backend
.venv/bin/python -m scripts.scraper run --all              # every product in the sitemap
.venv/bin/python -m scripts.scraper run --category sofa    # one category
.venv/bin/python -m scripts.scraper run --resume           # retry pending/failed URLs (attempts < 3)
.venv/bin/python -m scripts.scraper run --all --limit 20   # quick trial
```

- It respects `robots.txt`, throttles to `SCRAPER_RPS` (default 1.5 requests/second per host), retries with
  exponential backoff, and identifies itself with `SCRAPER_USER_AGENT`. Set a real contact address there.
- Re-running is safe: products are upserted, and progress is kept in the `scrape_log` table. Each run writes
  a report to `SCRAPER_OUTPUT_DIR` (default `scraper_output/`).
- A product URL that returns **404 or 410** is marked `gone` in `scrape_log` and listed under "Gone" in the
  report. It is never retried, and an existing product imported from it stays published. Use the admin panel
  to unpublish it. 429 and 5xx responses are still retried with backoff.

**Legal note.** Product text, photos and prices belong to their owners. Get written permission from the
source site before importing its content into a public deployment, and follow its terms of use. Use the
importer only for data you have the right to republish. The demo seed (`scripts.seed --demo`) needs no
external data.

## Rebranding (`BRAND_MODE`)

With `BRAND_MODE=neutral` (the default), every brand term in `BRAND_SOURCE_TERMS` found in imported text is
replaced with `DEFAULT_SITE_NAME` ("Casa Furnish"). Set `BRAND_MODE` to any other value to keep imported text
unchanged. The site name shown on the site can be changed in **Admin → Settings**.

## Assumptions

- Currency is BDT and the site is English only.
- Contact notifications are an SMTP email (optional) plus the unread badge on the admin dashboard.
- The "Popular" sort orders by product view count.
- Maps use Leaflet + OpenStreetMap. Showroom coordinates are entered by hand in the admin.
- Branding is neutral by default ("Casa Furnish"), and brand terms in scraped text are replaced.
- Admin tokens are stored in localStorage: a short-lived access token plus a rotating refresh token with
  reuse detection.
- SQLite is used only for tests and local development. Production uses PostgreSQL.
