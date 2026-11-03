# Handoff: where the build stands (2026-11-03)

## Delivery phases
| # | Phase | Status |
|---|---|---|
| 1 | Site analysis, scaffolding, Docker | ✅ committed |
| 2 | DB models, migrations, seed | ✅ committed |
| 3 | Auth + admin CRUD APIs | ✅ committed |
| 4 | Scraper + import | ✅ committed (see open issue A) |
| 5 | Public APIs | ✅ committed |
| 6 | Angular public site | ✅ committed |
| 7 | Angular admin panel | ✅ committed (in commit `4f0ec0b` + `9923a88`) |
| 8 | SEO/SSR, optimisation, tests, README | ✅ done (docker e2e verified) |

Verified so far: 66 backend pytest tests and 17 frontend vitest tests pass, and the SSR build passes.
SSR returns correct titles, OG tags, JSON-LD and 404 statuses. In the browser, these flows were checked:
listing filters, product variants, add to cart, WhatsApp URL (product and cart, with customer fields),
inquiry logging, admin login, product edit/save, and the banner form.

## Phase 8 results (2026-11-03)
- **Lighthouse (mobile, production SSR build behind an nginx-equivalent proxy):** `/` 100/100/100/100;
  `/products` and `/product/<slug>` were 98-99 a11y (footer `h3` heading order, now fixed to `h2`), all else 100;
  `/admin/login` a11y fixed (`<main>` landmark, shell `<title>`), SEO 58 there is intentional (`noindex`).
- **Performance trace** on `/` (4x CPU, Slow 4G): LCP 1.38 s, CLS 0.00 (the 0.365 footer shift is gone).
- **SSR headers** in `frontend/src/server.ts`: CSP (OSM tiles, Google Fonts, wa.me), nosniff, Referrer-Policy,
  X-Frame-Options SAMEORIGIN, `Cache-Control: no-store` on `/admin`; nginx hides the duplicate upstream copies.
- **docker-compose** passes `PUBLIC_BASE_URL` to `frontend`.
- **robots.txt**: the scraper now uses its own RFC 9309 matcher (`scripts/scraper/robots.py`, longest match wins).
  The stdlib parser is first-match, so `Allow: /` unblocked everything; this broke 2 pipeline tests.
- **Coverage:** 87% (`pytest --cov=app --cov=scripts`), 78 backend tests.
- README.md written (run, deploy, scraper + legal note, BRAND_MODE, assumptions).

## Remaining work
1. **Run the production import** following `docs/PRODUCTION_IMPORT.md` (needs Dokploy access; backup first).
   Then fill in its section 6 and do the live spot-checks.
2. **Scrape the non-product content** (not built yet). Structures found on 2026-11-04, one request per type:
   - *Showrooms*: 71 URLs `/showrooms/<slug>` (use the URL slug, not `SeName`). Flight data has `showroomInfo`
     `{Name, Latitude, Longitude, Address, Division, Mobile, OffDays, VisitingHours, Description:"$ref"}`; the
     flight JSON-LD adds `addressLocality`, `telephone`. Maps to `Showroom` (city = locality, else Division).
   - *Static pages*: body is in flight `dangerouslySetInnerHTML.__html` (may be a `$xx` text-row ref). Take an
     allowlist from the sitemap's 74 "other" URLs: `about-hatil, company-profile, contact-us, faq, help-center,
     hatil-policies, privacy-policy, return-policy, billing-terms-and-conditions, our-team, license-certificates,
     become-franchise-partner`. Skip `careers`, `catalogues` and the listing pages. `faq` could feed `Faq`.
   - *Banners*: homepage flight has `homePageCard` objects: `Type:"MenuSlider"` = hero slides
     (`HomePageCardImages[{Title, Description, ImageUrl, UrlLink, DisplayOrder}]`), `ImageGallery*` = promo tiles.
     `Banner` has no slug, so create-if-missing by (placement, title) and never update or delete existing rows.
   - *Blog*: 788 URLs `/blog/<slug>`. This is a separate WordPress site (`/banglablog/wp-content`, mostly Bengali):
     no flight data, a Yoast JSON-LD `@graph` (headline, datePublished, author, image) and the body in the DOM.
   - *Category images*: not found in any page checked. The category tree currently comes only from product
     breadcrumbs (names and slugs).
   Put pure parsers in a new `scripts/scraper/content.py`, upserts by slug in a `content_import.py`, a `content`
   CLI subcommand, and fixture tests like `tests/test_scraper_sets.py` (synthetic flight payloads).
3. **Known quirk**: `--category` only matches a product path slug (`sofa`), not a listing slug (`2-seater-sofa`):
   `ScrapeRun.targets()` filters on `ScrapeLog.category_slug`, which `discover()` does not apply to listing links.
   `--all` is unaffected. Fix by dropping that filter when `urls` is given.

**2026-11-04 scraper changes** (tests 126 passed): set pages parse (`tests/test_scraper_sets.py`); single-segment
model pages are discovered, so 948 product URLs instead of 821; rate capped at 1 req/s (`MAX_REQUESTS_PER_SECOND`);
`SCRAPER_MAX_IMAGES` env (default 30); extra retry tests (429 `Retry-After`, 5xx recovery). Dry runs: sofa 9/10
created (1 discontinued), bedroom 10/10, a re-run created 0 and changed no rows or files.

## Docker verified (2026-11-03, Colima)
All 4 services are healthy, the entrypoint migrates and seeds, the API, SSR and admin login (JWT) work, each
security header appears once on every route, `nginx -t` passes, and `docker compose run --rm backend pytest`
gives 85 passed. Fixed along the way: a Python 3.12 import crash in `crud_service.py` (a `list` method
shadowed `list[...]` annotations; 3.14 hid it), the nginx config is now built into its image (bind mounts from
`/Volumes` fail under Colima and are fragile on Dokploy), and duplicate headers on `/api`, `/sitemap.xml` and `/robots.txt`.

## Open issues
- **A. Scraper failure classification.** The full run found 821 product URLs: 548 done, 537 unique products
  (some URLs share a SKU), 1,705 images, 951 variants. Of the rest, 245 are still marked `failed` and 28 `skipped`.
  Sampled failures were *source 404 pages* (discontinued items still listed in the sitemap), but
  `SkipProduct` detection in `scripts/scraper/parsers.py::parse_product` only caught 28 of them.
  Fetch one failed URL from `scrape_log`, look at how its not-found page is marked, adjust `NOT_FOUND_MARKERS`,
  add a fixture test, then run `python -m scripts.scraper run --resume`. (Only URLs with attempts < 3 are retried;
  reset `attempts` if needed.)
- **B. Imported data is not in git.** `backend/import.db`, `backend/uploads_import/` and `backend/scraper_output/` are gitignored.
  At home, either re-run the scraper (about 30 min at 1.5 req/s) or use `python -m scripts.seed --demo`.
- **C. GateGuard hook.** On the first machine the project was exempted via `.claude/settings.local.json`
  (`GATEGUARD_EXEMPT_GLOBS`), and that file is not committed. Re-create it at home if the hook blocks every new file.

## Original brief (summary)
Angular SSR + Tailwind front end; FastAPI + SQLAlchemy 2 + Alembic + PostgreSQL back end; JWT admin only;
local uploads with WebP and thumbnails behind StorageService (S3-swappable); Docker Compose (frontend, backend,
postgres, nginx). Public site covers home sections, mega-menu, search autocomplete, listing filters/sort/pagination,
product detail (gallery and zoom, variants, specs, related, recently viewed), WhatsApp cart checkout,
wishlist and compare, showroom locator, CMS pages, blog, contact form, SEO (SSR, meta, OG, JSON-LD,
sitemap.xml, robots.txt) and Lighthouse above 90. Admin covers dashboard, full CRUD, bulk import/export/price/publish,
inboxes, settings and roles. Scraper must be polite, resumable, idempotent and report its runs.
No customer accounts, payments or server-side orders.
