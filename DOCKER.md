# Maghreb Connect – Docker Guide

Everything runs through **Docker Compose**. The default stack is
production-like (Nginx edge proxy on `:80`); a dev overlay adds hot-reloading.

## Prerequisites

| Tool | Minimum version | Check |
|------|-----------------|-------|
| Docker Engine / Desktop | 24.x (Compose v2 plugin) | `docker --version && docker compose version` |
| GNU Make | 3.81 | `make --version` |
| ~6 GB free RAM, ~10 GB disk for images | | |

> All commands below assume you run them from the repository root.

## 1. First-time setup

```bash
make env          # copies .env.example -> .env
# EDIT .env: set DJANGO_SECRET_KEY (long random string), POSTGRES_PASSWORD,
# and optionally DJANGO_SUPERUSER_PASSWORD to auto-create an admin on boot.
make up           # build + start the full production-like stack
make seed         # load seed_data/places.json into PostGIS (idempotent)
```

Generate a secret key quickly:
`python -c "import secrets; print(secrets.token_urlsafe(64))"`

## 2. Where things are served

| URL | What |
|-----|------|
| http://localhost/ | React SPA (MapLibre map, search, filters) |
| http://localhost/api/v1/places/ | REST API (paginated, filterable) |
| http://localhost/admin/ | Django admin |
| http://localhost/healthz | Nginx liveness probe |
| localhost:8000 | Direct gunicorn (prod stack: internal only) |
| localhost:5432 | PostgreSQL/PostGIS (host mapping, remove in hardened prod) |
| localhost:6379 | Redis (host mapping, remove in hardened prod) |

## 3. Development mode (hot reload)

```bash
make up-dev
```

Layers `docker-compose.dev.yml` over the base file:

* **Frontend** → Vite dev server with HMR at http://localhost:5173
  (`./frontend` bind-mounted; `/api` proxied to `http://backend:8000`).
* **Backend** → `manage.py runserver` at http://localhost:8000
  (`./backend` bind-mounted, autoreload on save).
* **Celery worker** → started with `--reload`.
* Nginx and the built SPA image are not used in this mode.

Stop with `make down`. Data lives in named volumes and survives restarts.

## 4. Common operations (Makefile)

```bash
make help             # list all targets
make ps               # container status
make logs             # tail all logs        (make logs-backend = Django only)
make migrate          # django migrate
make makemigrations   # NAME=my_change make makemigrations
make seed             # import seed JSON
make shell            # python manage.py shell
make dbshell          # psql via Django settings
make superuser        # createsuperuser
make test             # backend tests + frontend build/typecheck
make nginx-test       # validate nginx config
make verify           # end-to-end smoke checks (see §6)
make clean            # down -v  ⚠️ DESTROYS DATABASE VOLUMES (asks first)
```

## 5. Production vs development

| Aspect | dev (`make up-dev`) | prod-like (`make up`) |
|--------|--------------------|-----------------------|
| Web entry | :5173 (Vite) | :80 (Nginx) |
| API entry | :8000 direct | :80 → `/api/`, `/admin/` proxied |
| Static files | per-app defaults | `collectstatic` volume served by Nginx |
| Debug | `DJANGO_DEBUG=True` | `False`; add your domain to `DJANGO_ALLOWED_HOSTS` |
| DB/Redis ports | exposed for tooling | drop host mappings when hardening |
| TLS | none | terminate at a cloud LB, or mount certs + 443 block in `infra/nginx/nginx.conf` |

Production checklist before deploying:

- [ ] Strong `DJANGO_SECRET_KEY`, unique `POSTGRES_PASSWORD`
- [ ] Real `DJANGO_ALLOWED_HOSTS` + matching `CORS_ALLOWED_ORIGINS`/`CSRF_TRUSTED_ORIGINS`
- [ ] `DJANGO_SUPERUSER_PASSWORD` set once at first boot, then cleared
- [ ] Licensed/self-hosted tile source in `VITE_MAP_STYLE_URL` (never the public OSM tile server)
- [ ] `GOOGLE_PLACES_API_KEY` only in the backend env — never in any `VITE_*` var
- [ ] Backups for the `postgres_data` volume

## 6. Verification / troubleshooting

### Service health

```bash
docker compose ps                       # all services Up/healthy
curl -i http://localhost/healthz        # 204 No Content
curl -fsS http://localhost/api/v1/places/?page_size=1 | head -c 300
docker compose exec redis redis-cli ping                 # PONG
docker compose exec celery_worker celery -A config inspect ping --timeout 5
docker compose logs --tail=50 celery_worker | grep -i ready
```

Or just run `make verify`, which chains the above.

### PostGIS is working

```bash
docker compose exec db psql -U maghreb -d maghreb_connect \
  -tAc "SELECT postgis_version();"
# distance query against canonical data:
docker compose exec db psql -U maghreb -d maghreb_connect -c \
  "SELECT name, ST_DWithin(location::geography,
     ST_SetSRID(ST_MakePoint(-75.6972,45.4215),4326)::geography, 10000) AS within_10km
   FROM places_place ORDER BY id LIMIT 5;"
```

### Common issues

| Symptom | Likely cause / fix |
|---------|--------------------|
| `POSTGRES_PASSWORD is required` on `up` | No `.env` — run `make env` and fill it in |
| backend restart loop: `PostgreSQL not reachable` | `db` still initializing; check `make logs`; entrypoint retries 120 s then aborts |
| Admin CSS missing (unstyled `/admin/`) | `collectstatic` volume empty → `make collectstatic`, ensure gunicorn keeps `--umask 022` so nginx can read files |
| Map tiles fail to load | `VITE_MAP_STYLE_URL` unreachable/CORS-blocked; check `curl $(docker compose exec -T frontend-static cat /usr/share/nginx/html/config.json ...)` or set a valid style URL |
| 502 from `/api/` | backend not up yet, or `DJANGO_ALLOWED_HOSTS` missing the request Host → add hostname |
| Celery tasks queue but never run | worker not connected: `make logs` for `celery_worker`, confirm `CELERY_BROKER_URL=redis://redis:6379/1` |
| Port already allocated | override in `.env`: `NGINX_HTTP_PORT=8080`, `BACKEND_HOST_PORT=8001`, `FRONTEND_HOST_PORT=5174` |
| Stale DB after schema experiments | `make clean` (destructive) then `make up && make seed` |

### Reset everything

```bash
make down
docker compose down -v     # deletes volumes — confirm you want to lose data
make up && make seed
```
