FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends libjpeg62-turbo libwebp7 \
    && rm -rf /var/lib/apt/lists/*

# INSTALL_DEV=true adds pytest/ruff so `docker compose run --rm backend pytest` works.
ARG INSTALL_DEV=false
COPY requirements.txt requirements-dev.txt ./
RUN pip install -r requirements.txt \
    && if [ "$INSTALL_DEV" = "true" ]; then pip install -r requirements-dev.txt; fi

COPY . .
RUN chmod +x docker-entrypoint.sh \
    && useradd --create-home appuser && mkdir -p /app/uploads && chown -R appuser /app
USER appuser

EXPOSE 8000
# Waits for the DB, runs migrations and the idempotent seed, then starts uvicorn (see docker-entrypoint.sh).
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["serve"]
