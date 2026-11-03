# Dokploy deployment

Two Dokploy **Applications** (no compose, no nginx; Traefik routes). Postgres is external (db `hatil`).

## Backend
1. Create Application `hatil-backend` -> Provider: this Git repo, Build Path `/`.
   Build type **Dockerfile**: Docker File `backend/Dockerfile`, **Docker Context Path `backend`**.
   (Context Path is relative to the repo root, not to Build Path; leaving it `.` fails with
   `"/requirements.txt": not found`.)
2. Environment: paste `backend.env` (copy `backend.env.example`, fill `__placeholders__`;
   JWT: `openssl rand -hex 64`).
3. Advanced -> Volumes: Volume mount, name `hatil-uploads`, mount path `/app/uploads`.
4. Domains: `hatilapi.anshintech.dpdns.org`, container port **8000**, HTTPS on, cert **Let's Encrypt**.
5. Health check (Advanced -> Swarm settings): test
   `["CMD","python","-c","import urllib.request;urllib.request.urlopen('http://127.0.0.1:8000/api/v1/health',timeout=3)"]`.
6. Deploy. The entrypoint waits for the DB, runs `alembic upgrade head`, then the idempotent seed
   (creates the super admin only if missing), then uvicorn.

## Frontend
1. Create Application `hatil-frontend` -> Build Path `/`, Docker File `frontend/Dockerfile`,
   **Docker Context Path `frontend`**.
2. Environment: paste `frontend.env`. The API URL is runtime-only; nothing is baked at build time.
3. Domains: `hatil.anshintech.dpdns.org`, container port **4000**, HTTPS, Let's Encrypt.
4. Deploy the backend first, then the frontend.

## Check
`curl https://hatilapi.anshintech.dpdns.org/api/v1/health` -> `{"status":"ok"}`;
open the site, then `/admin/login`.
