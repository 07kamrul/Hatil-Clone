# Production catalogue import (hatil.anshintech.dpdns.org)

> **Status (2026-11-04):** written from dry runs against a local SQLite DB. Nothing here has been run
> against production yet: whoever has Dokploy access runs it. Section 6 lists what is still unverified.

Production = two Dokploy Applications (`hatil-backend`, `hatil-frontend`), an **external** Postgres (db `hatil`)
and a volume `hatil-uploads` mounted at `/app/uploads` in the backend (see `deploy/dokploy/README.md`).
There is no Postgres container, so database commands go to the external server, not through `docker exec`.

## 1. What the scraper does now (changes made for this run)
- 404/410 → `scrape_log.status = "gone"`, skipped, never retried, never touches an existing product.
  429/5xx retry with backoff (honours `Retry-After`). The report lists gone URLs.
- **Set pages parse** (sofa sets, bedroom/divan sets). They use a different page schema and were failing with
  "No product data found" (about 11% of products). Price = sum of components (checked on 3 live pages).
- **Single-segment model pages are discovered** (`/adept-165`). They were skipped as "other":
  the sitemap yields **948 product URLs, not 821**.
- Rate is capped at **1 request/second per host** whatever `SCRAPER_RPS` says. `SCRAPER_MAX_IMAGES` (default 30).
- Upsert key is unchanged: SKU, falling back to slug. Re-runs do not duplicate rows or images (images are only
  attached when a product has none, so admin-added images are never replaced).
- Not scraped yet: banners, showrooms, blog posts, static pages, category images (see `docs/HANDOFF.md`).
- No Playwright needed: every failing page seen was server-rendered; the cause was parser schema, not JavaScript.

## 2. Before the run
```bash
cd backend && .venv/bin/python -m pytest -q          # all green
curl -s https://hatilapi.anshintech.dpdns.org/api/v1/health   # {"status":"ok"}
```

## 3. Back up (do not skip)
Run the DB dump from a machine with `postgresql-client` of the **same major version as the server** and network
access to it. `DATABASE_URL` in `backend.env` uses the SQLAlchemy prefix; strip `+psycopg` for the CLI tools.
```bash
STAMP=$(date +%Y%m%d-%H%M)
pg_dump -Fc "${DATABASE_URL/+psycopg/}" -f "hatil-pre-import-$STAMP.dump"
# on the Dokploy server: snapshot the uploads volume
docker run --rm -v hatil-uploads:/data -v "$PWD":/backup alpine \
  tar czf "/backup/uploads-pre-import-$STAMP.tgz" -C /data .
```
**Restore** (also reverts anything admins changed since the dump, so use only to undo a bad import):
```bash
pg_restore --clean --if-exists --no-owner -d "${DATABASE_URL/+psycopg/}" "hatil-pre-import-$STAMP.dump"
docker run --rm -v hatil-uploads:/data -v "$PWD":/backup alpine \
  sh -c "rm -rf /data/* && tar xzf /backup/uploads-pre-import-$STAMP.tgz -C /data"
```

## 4. Run inside the backend container (preferred)
Dokploy → `hatil-backend` → Terminal (workdir `/app`; `DATABASE_URL` and `UPLOAD_DIR=/app/uploads` are the real ones).
Output goes to `/tmp` because the container user is not root.
```bash
export SCRAPER_RPS=1 SCRAPER_OUTPUT_DIR=/tmp/scraper_output
python -m scripts.scraper run --category sofa --limit 10     # smoke test first, then check the site
nohup python -m scripts.scraper run --all > /tmp/import.log 2>&1 &
tail -f /tmp/import.log
```
Roughly 950 product pages plus about 3 images each at 1 req/s is on the order of 1 to 2 hours. If the container
restarts or the run dies, continue where it stopped (state lives in `scrape_log`, in the database):
```bash
python -m scripts.scraper run --resume
```
Copy the outputs off the container before redeploying (run on the server):
```bash
docker cp "$(docker ps -q -f name=hatil-backend | head -1)":/tmp/scraper_output ./scraper_output
```
The report (`report-*.md`), `products-*.json` and `products-*.csv` are in that folder.

### Alternative: run locally against production
Only if the container cannot reach the source. Images then land on **your disk**, so they must be synced:
```bash
cd backend
export DATABASE_URL='postgresql+psycopg://...'   # production, URL-encode special characters
export UPLOAD_DIR=$PWD/uploads SCRAPER_RPS=1
.venv/bin/python -m scripts.scraper run --all
REMOTE=user@server ../scripts/sync_uploads.sh            # dry run
REMOTE=user@server ../scripts/sync_uploads.sh --apply    # copy
```
Product rows point at `/uploads/...` paths, so images 404 until the sync finishes.

## 5. Verify
```bash
API=https://hatilapi.anshintech.dpdns.org/api/v1
curl -s "$API/products?page=1" | head -c 600
curl -s "$API/categories/tree" | head -c 600
curl -s "$API/banners"; curl -s "$API/showrooms"
curl -s "$API/seo/sitemap.xml" | grep -c "<loc>"      # built from the DB per request: new products appear by themselves
```
- Product total from the API must equal `created + updated` in the report (plus products that already existed).
- Open about 10 random product pages on https://hatil.anshintech.dpdns.org: images load, full description shows.
- Spot-check 5 products against hatil.com: price, description, images. Set pages: compare the price shown on the
  source site with the stored one (it is derived as the sum of the components, and matched on 3 pages).

## 6. Not yet verified or built
- The production run, the API/frontend checks and the live spot-checks above.
- Sets: discounts are ignored (none seen in samples), and the price is not cross-checked with the rendered page.
- Banners, showrooms, blog, static pages, category images: no importer yet.
- Product `short_desc` is empty on the source for every sampled product.
