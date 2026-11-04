FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 \
    PIP_ROOT_USER_ACTION=ignore PIP_DISABLE_PIP_VERSION_CHECK=1
WORKDIR /app

# postgresql-client-$PG_MAJOR: pg_dump for the automatic pre-import DB backup (scripts/deploy_import.sh).
# pg_dump refuses servers newer than itself, and Debian trixie only ships 17, so install from PGDG.
# Keep PG_MAJOR >= the server's major (override with --build-arg PG_MAJOR=<n>); the script re-checks
# `SHOW server_version` at runtime and logs the mismatch.
ARG PG_MAJOR=18
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl gnupg \
    && install -d /usr/share/keyrings \
    && curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /usr/share/keyrings/pgdg.gpg \
    && . /etc/os-release \
    && echo "deb [signed-by=/usr/share/keyrings/pgdg.gpg] https://apt.postgresql.org/pub/repos/apt ${VERSION_CODENAME}-pgdg main" > /etc/apt/sources.list.d/pgdg.list \
    && apt-get update && apt-get install -y --no-install-recommends \
      libjpeg62-turbo libwebp7 "postgresql-client-${PG_MAJOR}" util-linux \
    && rm -rf /var/lib/apt/lists/*

# INSTALL_DEV=true adds pytest/ruff so `docker compose run --rm backend pytest` works.
ARG INSTALL_DEV=false
COPY requirements.txt requirements-dev.txt ./
RUN pip install -r requirements.txt \
    && if [ "$INSTALL_DEV" = "true" ]; then pip install -r requirements-dev.txt; fi

COPY . .
RUN chmod +x docker-entrypoint.sh \
    && useradd --create-home appuser \
    && mkdir -p /app/uploads /app/data \
    && chown -R appuser /app
USER appuser

EXPOSE 8000
# Waits for the DB, runs migrations and the idempotent seed, then starts uvicorn (see docker-entrypoint.sh).
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["serve"]
