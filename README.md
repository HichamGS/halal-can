# Maghreb Connect

Community discovery platform for Canada: find community businesses, services,
and organizations (restaurants, grocers, mosques, associations, professionals…)
near you. Communities and categories are **database-driven** — adding a new
community or category never requires a code change.

- **Backend:** Django + DRF + PostgreSQL/PostGIS + Redis + Celery (`/api/v1/`)
- **Web:** React + TypeScript + Vite + MapLibre GL (consumes the API only)
- **Mobile:** React Native (same API; planned)
- **Canonical data store:** PostgreSQL/PostGIS. JSON files are seed input only.

Full Docker guide: **[DOCKER.md](DOCKER.md)**.

---

## Quick start (Docker)

```bash
cp .env.example .env      # or: make env
# EDIT .env: DJANGO_SECRET_KEY, POSTGRES_PASSWORD (+ DJANGO_SUPERUSER_PASSWORD
# to auto-create an admin on first boot)
make up                   # build + start the production-like stack
make migrate              # apply database migrations  (see Migrations below)
make seed                 # import backend/seed_data/places.json into PostGIS
make verify               # end-to-end smoke checks
```

| URL | What |
|-----|------|
| http://localhost/ | React SPA (map, search, filters) |
| http://localhost/api/v1/places/ | REST API |
| http://localhost/admin/ | Django admin |

Development mode with hot reload (Vite :5173 + Django runserver :8000):

```bash
make up-dev
```

---

## Migrations

The compose stack includes a one-shot `migrate` service that applies all
migrations **before** gunicorn/Celery start (this prevents concurrent-DDL
crashes such as `pg_class_relname_nsp_index already exists`). Long-lived
containers run with `RUN_MIGRATIONS=0`, so you normally only touch migrations
manually after model changes:

```bash
# Apply pending migrations (backend container must be running)
docker compose --env-file .env exec backend python manage.py migrate
make migrate                                   # same thing via Makefile

# Or run them through the dedicated one-shot service (no stack needed):
docker compose --env-file .env run --rm migrate

# After changing models — generate migration files, then apply:
docker compose --env-file .env exec backend python manage.py makemigrations places communities categories sources submissions synchronization
make makemigrations NAME=my_change             # Makefile shortcut
make migrate

# Sanity checks / inspect state
docker compose --env-file .env exec backend python manage.py check
docker compose --env-file .env exec backend python manage.py showmigrations
```

### Local development without Docker

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements/base.txt
export DATABASE_URL=postgis://user:pass@localhost:5432/maghreb_connect
python manage.py migrate
python manage.py seed_places                   # taxonomy + sample places
python manage.py runserver                     # http://localhost:8000
```

---

## Seeding the database

`seed_places` is **idempotent** (upsert by name+city). It always seeds the
taxonomy (communities, categories, the `seed_json` source); it then imports
places from the seed JSON file. The seed file lives at
`backend/seed_data/places.json` and is copied into the image at
`/app/seed_data/places.json`.

```bash
# Standard import (recommended) — backend container must be running:
docker compose --env-file .env exec backend python manage.py seed_places
make seed                                      # Makefile shortcut

# Re-seed from scratch (deletes all places, re-imports the JSON):
docker compose --env-file .env exec backend python manage.py seed_places --wipe

# Import a different JSON file (path relative to /app inside the container,
# or absolute):
docker compose --env-file .env exec backend python manage.py seed_places --file seed_data/places.json

# Auto-seed once on a brand-new database (first boot only):
echo "SEED_ON_FIRST_BOOT=1" >> .env && docker compose --env-file .env up -d backend
```

Verify the seed worked:

```bash
curl -fsS "http://localhost/api/v1/places/?page_size=3" | head -c 400
curl -fsS "http://localhost/api/v1/communities/" | head -c 300
docker compose --env-file .env exec db psql -U maghreb -d maghreb_connect \
  -tAc "SELECT count(*) FROM places_place;"
```

If you see `No seed file at ...; taxonomy seeded only.` the places JSON was not
found — confirm `backend/seed_data/places.json` exists in the repo and rebuild
the backend image (`docker compose --env-file .env build backend`).

---

## Useful commands (Makefile)

Run `make help` for the full list.

| Command | Description |
|---------|-------------|
| `make env` | Create `.env` from `.env.example` |
| `make up` / `make up-dev` / `make down` | Start prod-like / dev / stop stack |
| `make logs` / `make logs-backend` | Tail logs |
| `make migrate` | Apply Django migrations |
| `make makemigrations NAME=msg` | Generate migrations |
| `make seed` | Import seed data into PostGIS |
| `make shell` / `make dbshell` | Django shell / psql |
| `make superuser` | Create an admin user |
| `make test` | Backend tests + frontend build/typecheck |
| `make django-check` | `manage.py check` |
| `make verify` | End-to-end smoke checks (nginx → API → PostGIS → Celery) |
| `make clean` | Destructive: `down -v`, then `make up && make seed` |

## Troubleshooting (migration & seed related)

| Symptom | Cause / fix |
|---------|-------------|
| `relation "communities_community" does not exist` | Migrations were never applied → `make migrate` (or `docker compose run --rm migrate`). |
| `duplicate key ... pg_class_relname_nsp_index` | Concurrent migration race — ensure only the one-shot `migrate` service runs DDL; do not set `RUN_MIGRATIONS=1` on long-lived services. |
| `No seed file at ...; taxonomy seeded only.` | Seed JSON missing from image → check `backend/seed_data/places.json`, rebuild backend. |
| Seed ran but API returns 0 places | Verify with the SQL count above; try `seed_places --wipe`; check `make logs-backend`. |
| Stale/corrupted schema after experiments | `make clean` (destructive), then `make up && make migrate && make seed`. |

More: [DOCKER.md](DOCKER.md).

## Security notes

- Never put provider secrets (e.g. `GOOGLE_PLACES_API_KEY`) in any `VITE_*`
  variable — they end up in the browser bundle. Server-side only.
- Do not scrape Google Maps; use the official Places API and respect its
  storage/attribution terms. Redis caching must never bypass provider rules.