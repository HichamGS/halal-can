# ---------------------------------------------------------------------------
# Maghreb Connect – Django backend image
#
# Base: python slim + GDAL/GeoDjango stack (required by PostGIS backend).
# Production entrypoint is Gunicorn; docker-compose may override the CMD
# (e.g. runserver for hot-reload in dev, celery worker/beat commands).
# ---------------------------------------------------------------------------
FROM python:3.12-slim AS base

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    DJANGO_SETTINGS_MODULE=config.settings

# GeoDjango requires the GEOS / GDAL / PROJ native libraries.
RUN apt-get update && apt-get install --no-install-recommends -y \
        gdal-bin \
        libgdal-dev \
        postgresql-client \
        build-essential \
        curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies first to leverage Docker layer caching.
COPY requirements/ requirements/
RUN pip install -r requirements/prod.txt

# Application code.
COPY . .

RUN chmod +x /app/docker-entrypoint.sh

# Collect static files at build time as a baseline; the entrypoint also runs
# collectstatic at startup so newly-added static assets are picked up.
RUN DJANGO_SECRET_KEY=build-only python manage.py collectstatic --noinput || true

EXPOSE 8000

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["gunicorn", "config.wsgi:application", \
     "--bind", "0.0.0.0:8000", \
     "--workers", "3", \
     "--threads", "2", \
     "--timeout", "60", \
     "--access-logfile", "-", \
     "--error-logfile", "-"]
