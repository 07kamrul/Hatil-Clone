# Furniture Catalog (hatil.com-inspired) — project guide for Claude

Furniture catalog site. Public visitors have **no accounts**; orders go out as a prefilled
**WhatsApp** message from a localStorage cart. Only `/admin` has auth (JWT access + refresh).
The full original brief and phase plan are in `docs/HANDOFF.md`, and the UI source of truth is `docs/site-map.md`.

**When the user says "resume", read `docs/HANDOFF.md` and continue from "Remaining work".**

## Stack / layout
- `backend/`: FastAPI, SQLAlchemy 2, Alembic, Pydantic v2, routers → services → repositories → models,
  hand-written mappers in `app/mappers`. Scraper is a separate package in `backend/scripts/scraper`.
- `frontend/`: Angular 22 (standalone, signals, zoneless, SSR via @angular/ssr), Tailwind v4.
  `src/app/core` (api, stores, seo, whatsapp builder), `shared` (layout, ui), `features/*` (lazy). Admin is in `features/admin`.
- `docker-compose.yml` (postgres, backend, frontend SSR, nginx) and `nginx/nginx.conf`.

## Commands
```bash
# backend (from backend/)
python -m venv .venv && .venv/Scripts/pip install -r requirements-dev.txt   # Windows path; use .venv/bin on mac/linux
export DATABASE_URL=sqlite:///dev.db UPLOAD_DIR=uploads                   # or a postgres URL
.venv/Scripts/alembic upgrade head && .venv/Scripts/python -m scripts.seed --demo
.venv/Scripts/python -m uvicorn app.main:app --port 8000                  # docs at /api/docs
.venv/Scripts/python -m pytest -q          # 126 tests, SQLite in-memory
.venv/Scripts/ruff check app scripts tests
.venv/Scripts/python -m scripts.scrape_all [--limit N] [--backup]        # one command: migrate + products + content + verify
.venv/Scripts/python -m scripts.scraper run --all | --category sofa | --resume [--limit N]
.venv/Scripts/python -m scripts.scraper content --all | --showrooms | --banners | --pages | --blog [--limit N]

# frontend (from frontend/)
npm ci
npx ng serve             # http://localhost:4200, proxies /api and /uploads to :8000 (proxy.conf.json)
npx ng build             # SSR build -> dist/frontend
npx ng test --watch=false   # vitest, 17 tests
```
Default admin: `admin@example.com` / `ChangeMe123!` (set by SUPER_ADMIN_* env vars).

## Conventions / gotchas
- Tailwind v4: custom classes are defined with `@utility` in `src/styles.css`, not `.class { @apply }`.
- NgOptimizedImage: never use px values in `sizes`; use width/height for small fixed images (a px value throws NG02952 and breaks rendering).
- `rxResource` params that can be `undefined` need `T | undefined` in the generic.
- Browser-only code (localStorage, Leaflet) goes through `BrowserStorage` / `afterNextRender`.
- Commit messages: conventional commits, ending with a `Co-Authored-By` trailer.
