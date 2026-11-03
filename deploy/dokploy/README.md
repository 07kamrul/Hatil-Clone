# Dokploy deployment

Two Dokploy **Applications** (no compose, no nginx; Traefik routes). Postgres is external (db `hatil`).

## Backend
1. Create Application `hatil-backend` -> Provider: this Git repo, Build Path `/`.
   Build type **Dockerfile**: Docker File `backend/Dockerfile`, **Docker Context Path `backend`**.
   (Context Path is relative to the repo root, not to Build Path; leaving it `.` fails with
   `"/requirements.txt": not found`.)
2. Environment: paste `backend.env` (copy `backend.env.example`, fill `__placeholders__`;
   JWT: `openssl rand -hex 64`). `CATALOG_IMPORT=auto` makes the first deploy back the DB up, import the
   catalogue, verify and write `/app/data/import.done`; once `/api/v1/admin/import/status` reports `done`,
   set `CATALOG_IMPORT=off` (later deploys skip anyway via the done marker, but off is explicit).
3. Advanced -> Volumes (two mounts, both required for the automatic import):
   - Volume mount, name `hatil-uploads`, mount path `/app/uploads` (product images, survives redeploys).
   - Volume mount, name `hatil-data`, mount path `/app/data` (import state: `import.done`, `import.lock`,
     `import.failed`, `import-report.md`, `backups/` — the 3 newest pg_dump gzip dumps, `logs/`,
     `scraper_output/`).
4. Domains: `hatilapi.anshintech.dpdns.org`, container port **4000** (= `PORT` in backend.env; defaults to 8000 if unset), HTTPS on, cert **Let's Encrypt**.
5. Health check (Advanced -> Swarm settings): test
   `["CMD","python","-c","import os,urllib.request;urllib.request.urlopen('http://127.0.0.1:'+os.environ.get('PORT','8000')+'/api/v1/health',timeout=3)"]`.
6. Deploy. The entrypoint waits for the DB, runs `alembic upgrade head`, then the idempotent seed
   (creates the super admin only if missing), then uvicorn.

## Frontend
1. Create Application `hatil-frontend` -> Build Path `/`, Docker File `frontend/Dockerfile`,
   **Docker Context Path `frontend`**.
2. Environment: paste `frontend.env`. The API URL is runtime-only; nothing is baked at build time.
   `NG_ALLOWED_HOSTS` must list the public domain, otherwise SSR answers
   `Header "host" with value "..." is not allowed`.
3. Domains: `hatil.anshintech.dpdns.org`, container port **4001** (= `PORT` in frontend.env), HTTPS, Let's Encrypt.
4. Deploy the backend first, then the frontend.

## Check
`curl https://hatilapi.anshintech.dpdns.org/api/v1/health` -> `{"status":"ok"}`;
open the site, then `/admin/login`.

## Troubleshooting: Cloudflare "502 Bad gateway"
Traefik reached the server but no healthy container answered. Bypass Cloudflare to confirm:
`curl -sk --resolve hatil.anshintech.dpdns.org:443:<server-ip> https://hatil.anshintech.dpdns.org/`
(a 502 here means the app container is down, not Cloudflare). Then, per app, in Dokploy:
1. **Deployments**: did the last build succeed? A failed build leaves no running container.
2. **Logs** (backend): `[entrypoint] DATABASE_URL still contains the template value __X__` means fill the env var.
   `database not reachable: ...` after 60s means check the password (URL-encode `@ : / # %`),
   that Postgres listens on the public IP (`listen_addresses`, `pg_hba.conf`), the firewall on 5432, and that db `hatil` exists.
3. **Logs** (frontend): should print `listening on port 4001 (API base: ...)`. `ignoring invalid API_BASE_URL`
   means fix `frontend.env`; the site still serves, using same-origin API calls.
4. **Domains**: container port must equal the app's `PORT` env: 4000 (backend) / 4001 (frontend). After changing env or domains, **Redeploy**.
