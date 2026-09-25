# ---------------------------------------------------------------------------
# Maghreb Connect – Docker convenience targets
#
# Default stack (docker-compose.yml) is production-like:
#   nginx :80 -> SPA + /api/ + /admin/, gunicorn backend, PostGIS, Redis,
#   Celery worker + beat.
# Dev stack layers docker-compose.dev.yml on top (Vite HMR :5173, Django
# runserver :8000 with bind-mounted source).
#
# Run `make help` for the list of targets.
# ---------------------------------------------------------------------------

COMPOSE      ?= docker compose
COMPOSE_DEV  := $(COMPOSE) -f docker-compose.yml -f docker-compose.dev.yml
API_URL      ?= http://localhost/api/v1
ADMIN_URL    ?= http://localhost/admin/

.DEFAULT_GOAL := help
.PHONY: help env build up up-dev down restart ps logs logs-backend \
        migrate makemigrations seed shell dbshell redis-cli test test-backend \
        test-frontend typecheck lint django-check collectstatic nginx-test \
        verify clean psql-health

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
	  awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

# ------------------------------- Setup --------------------------------------

env: ## Create .env from .env.example (refuses to overwrite)
	@test -f .env || (cp .env.example .env && echo "Created .env — EDIT DJANGO_SECRET_KEY and POSTGRES_PASSWORD before 'make up'.")
	@echo ".env present."

# ------------------------------ Lifecycle -----------------------------------

build: ## Build all images
	$(COMPOSE) build

up: ## Start the production-like stack (nginx on :80)
	@test -f .env || (echo "ERROR: no .env found. Run 'make env' first." >&2; exit 1)
	$(COMPOSE) up -d --build

up-dev: ## Start the dev stack (Vite :5173 + Django runserver :8000, hot reload)
	@test -f .env || (echo "ERROR: no .env found. Run 'make env' first." >&2; exit 1)
	$(COMPOSE_DEV) up --build

down: ## Stop services (data volumes preserved)
	$(COMPOSE) down
	$(COMPOSE_DEV) down 2>/dev/null || true

restart: ## Restart all services
	$(COMPOSE) restart

ps: ## Show container status
	$(COMPOSE) ps

logs: ## Tail logs for all services
	$(COMPOSE) logs -f --tail=100

logs-backend: ## Tail Django/gunicorn logs only
	$(COMPOSE) logs -f --tail=100 backend

# ---------------------------- Django operations -----------------------------

migrate: ## Run database migrations inside the backend container
	$(COMPOSE) exec backend python manage.py migrate

makemigrations: ## Generate new migrations (NAME=msg to name them)
	$(COMPOSE) exec backend python manage.py makemigrations $(if $(NAME),--name $(NAME),)

seed: ## Import seed data (JSON -> PostGIS, idempotent via dedup)
	$(COMPOSE) exec backend python manage.py seed_places

shell: ## Open a Django shell
	$(COMPOSE) exec backend python manage.py shell

dbshell: ## Open psql against the PostGIS database
	$(COMPOSE) exec backend python manage.py dbshell

collectstatic: ## Re-collect static files into the shared volume
	$(COMPOSE) exec backend python manage.py collectstatic --noinput

django-check: ## Run `manage.py check`
	$(COMPOSE) exec backend python manage.py check

superuser: ## Create a superuser interactively
	$(COMPOSE) exec backend python manage.py createsuperuser

# ------------------------------ Testing -------------------------------------

test: test-backend test-frontend typecheck ## Run backend + frontend checks

test-backend: ## Run Django tests in the container
	$(COMPOSE) exec -e DJANGO_DEBUG=False backend python manage.py test

# NOTE: the web app has no unit-test runner yet; test-frontend performs a
# production build, which includes `tsc --noEmit` (see package.json). When a
# vitest setup is added, switch this to `npm test`.
test-frontend: ## Build the frontend (runs tsc --noEmit as part of it)
	docker run --rm -v $(PWD)/frontend:/app -w /app node:20-alpine \
	  sh -c "npm install --no-audit --no-fund && npm run build"

typecheck: ## TypeScript check for the frontend
	docker run --rm -v $(PWD)/frontend:/app -w /app node:20-alpine \
	  sh -c "npm install --no-audit --no-fund && npm run typecheck"

nginx-test: ## Validate the edge nginx configuration
	$(COMPOSE) exec nginx nginx -t

# --------------------------- Verification helpers ---------------------------

verify: ## Quick end-to-end smoke checks through nginx
	@echo "→ nginx health endpoint:";   curl -fsS -o /dev/null -w "  %{http_code}\n" http://localhost/healthz
	@echo "→ API places (via nginx):";  curl -fsS "$(API_URL)/places/?page_size=1" | head -c 200; echo
	@echo "→ communities:";             curl -fsS "$(API_URL)/communities/" | head -c 200; echo
	@echo "→ PostGIS extension:";       $(COMPOSE) exec -T db psql -U $${POSTGRES_USER:-maghreb} -d $${POSTGRES_DB:-maghreb_connect} -tAc "SELECT postgis_version();"
	@echo "→ Celery workers:";          $(COMPOSE) exec -T celery_worker celery -A config inspect ping -d celery@$$($(COMPOSE) exec -T celery_worker hostname) --timeout 5
	@echo "✓ verification complete"

redis-cli: ## Open redis-cli inside the redis container
	$(COMPOSE) exec redis redis-cli

clean: ## Stop everything and DELETE volumes (destroys DB data!)
	@read -p "This deletes postgres_data/redis_data volumes. Continue? [y/N] " ans && [ "$$ans" = y ] || exit 1
	$(COMPOSE) down -v
	$(COMPOSE_DEV) down -v 2>/dev/null || true
