#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Maghreb Connect – Django container entrypoint
#
# Responsibilities:
#   1. Wait for PostgreSQL to accept connections (compose healthcheck starts
#      Gunicorn, Celery and Beat in dependency order, but we stay defensive).
#   2. Apply database migrations.
#   3. Collect static files into STATIC_ROOT (/app/staticfiles volume).
#   4. Optionally create a DJANGO_SUPERUSER_* admin on first boot.
#   5. Exec the CMD (gunicorn by default; compose overrides it for
#      celery worker / celery beat / dev server).
#
# Behavior flags (env):
#   RUN_MIGRATIONS=0     skip migrate            (e.g. one-shot jobs)
#   COLLECT_STATIC=0     skip collectstatic
#   CREATE_SUPERUSER=1   force superuser creation even if password empty check fails
#   SEED_ON_FIRST_BOOT=1 run `seed_places` only when the places table is empty
# ---------------------------------------------------------------------------
set -euo pipefail

RUN_MIGRATIONS="${RUN_MIGRATIONS:-1}"
COLLECT_STATIC="${COLLECT_STATIC:-1}"
SEED_ON_FIRST_BOOT="${SEED_ON_FIRST_BOOT:-0}"

log() { echo "[entrypoint] $*"; }

# --- 1. Wait for PostgreSQL -------------------------------------------------
wait_for_db() {
    local host="${POSTGRES_HOST:-db}"
    local port="${POSTGRES_PORT:-5432}"
    local user="${POSTGRES_USER:-maghreb}"
    local db="${POSTGRES_DB:-maghreb_connect}"
    local tries=0 max_tries=60

    log "Waiting for PostgreSQL at ${host}:${port} ..."
    until pg_isready -h "${host}" -p "${port}" -U "${user}" -d "${db}" -q; do
        tries=$((tries + 1))
        if [ "${tries}" -ge "${max_tries}" ]; then
            log "ERROR: PostgreSQL not reachable after $((max_tries * 2))s. Aborting."
            exit 1
        fi
        sleep 2
    done
    log "PostgreSQL is ready."
}

wait_for_db

# --- 2. Migrations ----------------------------------------------------------
if [ "${RUN_MIGRATIONS}" = "1" ]; then
    log "Applying database migrations ..."
    python manage.py migrate --noinput
fi

# --- 3. Static files --------------------------------------------------------
if [ "${COLLECT_STATIC}" = "1" ]; then
    log "Collecting static files ..."
    python manage.py collectstatic --noinput --clear >/dev/null
fi

# --- 4. First-boot superuser -------------------------------------------------
if [ -n "${DJANGO_SUPERUSER_PASSWORD:-}" ]; then
    log "Ensuring superuser '${DJANGO_SUPERUSER_USERNAME:-admin}' exists ..."
    python manage.py shell -c "
import os
from django.contrib.auth import get_user_model
U = get_user_model()
u, created = U.objects.get_or_create(
    email=os.environ.get('DJANGO_SUPERUSER_EMAIL', 'admin@example.com'),
    defaults=dict(
        username=os.environ.get('DJANGO_SUPERUSER_USERNAME', 'admin'),
        is_staff=True, is_superuser=True,
    ),
)
if created:
    u.set_password(os.environ['DJANGO_SUPERUSER_PASSWORD'])
    u.save()
    print('[entrypoint] superuser created')
else:
    print('[entrypoint] superuser already exists (password untouched)')
"
fi

# --- 5. Optional seed on first boot -----------------------------------------
if [ "${SEED_ON_FIRST_BOOT}" = "1" ]; then
    EMPTY=$(python manage.py shell -c "
from apps.places.models import Place
print('yes' if not Place.objects.exists() else 'no')
" | tail -n 1)
    if [ "${EMPTY}" = "yes" ]; then
        log "Places table empty – importing seed data ..."
        python manage.py seed_places
    fi
fi

# --- 6. Hand over to CMD (gunicorn / celery / runserver) ---------------------
log "Starting: $*"
exec "$@"
