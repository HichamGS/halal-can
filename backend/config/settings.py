"""
Django settings for Maghreb Connect.

Database strategy
-----------------
* Production / docker-compose: PostgreSQL + PostGIS  (canonical data store)
* Local development fallback:   SpatiaLite           (same model code, no
  Postgres required, so the project stays runnable anywhere)

The switch is done with the DB_ENGINE environment variable:
    DB_ENGINE=postgis   ->  postgres backend (default when DATABASE_URL-ish
                            settings are provided via docker-compose)
    DB_ENGINE=sqlite    ->  spatialite fallback
"""
from pathlib import Path
import os

BASE_DIR = Path(__file__).resolve().parent.parent


def env(key, default=None):
    return os.environ.get(key, default)


def env_bool(key, default=False):
    val = os.environ.get(key)
    if val is None:
        return default
    return val.lower() in ("1", "true", "yes", "on")


SECRET_KEY = env("DJANGO_SECRET_KEY", "dev-insecure-key-change-me")
DEBUG = env_bool("DJANGO_DEBUG", True)
ALLOWED_HOSTS = [h.strip() for h in env("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1,0.0.0.0").split(",") if h.strip()]

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.gis",
    # third party
    "rest_framework",
    "django_filters",
    "corsheaders",
    "drf_spectacular",
    # local apps
    "apps.communities",
    "apps.categories",
    "apps.sources",
    "apps.places",
    "apps.submissions",
    "apps.synchronization",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------
DB_ENGINE = env("DB_ENGINE", "postgis")  # postgis | sqlite

if DB_ENGINE == "sqlite":
    SPATIALITE_PATH = env("SPATIALITE_PATH", "/usr/lib/x86_64-linux-gnu/mod_spatialite.so")
    DATABASES = {
        "default": {
            "ENGINE": "django.contrib.gis.db.backends.spatialite",
            "NAME": env("SQLITE_PATH", str(BASE_DIR / "db.sqlite3")),
        }
    }
    SPATIALITE_SQL = str(Path(SPATIALITE_PATH))
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.contrib.gis.db.backends.postgis",
            "NAME": env("POSTGRES_DB", "maghreb_connect"),
            "USER": env("POSTGRES_USER", "postgres"),
            "PASSWORD": env("POSTGRES_PASSWORD", "postgres"),
            "HOST": env("POSTGRES_HOST", "db"),
            "PORT": env("POSTGRES_PORT", "5432"),
        }
    }

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

# ---------------------------------------------------------------------------
# REST framework
# ---------------------------------------------------------------------------
REST_FRAMEWORK = {
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": int(env("API_PAGE_SIZE", 25)),
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": env("THROTTLE_ANON", "120/min"),
        "user": env("THROTTLE_USER", "600/min"),
        "submission": env("THROTTLE_SUBMISSION", "10/hour"),
    },
}

SPECTACULAR_SETTINGS = {
    "TITLE": "Maghreb Connect API",
    "DESCRIPTION": "Community / business / service discovery API for Canada.",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
}

# ---------------------------------------------------------------------------
# CORS (web app origins; tighten in production via env var)
# ---------------------------------------------------------------------------
CORS_ALLOWED_ORIGINS = [
    o.strip() for o in env(
        "CORS_ALLOWED_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    ).split(",") if o.strip()
]
CORS_ALLOW_ALL_ORIGINS = env_bool("CORS_ALLOW_ALL_ORIGINS", False)

# ---------------------------------------------------------------------------
# Redis / caching
# ---------------------------------------------------------------------------
REDIS_URL = env("REDIS_URL", "redis://redis:6379/0")

if env_bool("USE_REDIS_CACHE", not DEBUG and DB_ENGINE != "sqlite"):
    CACHES = {
        "default": {
            "BACKEND": "django_redis.cache.RedisCache",
            "LOCATION": REDIS_URL,
            "OPTIONS": {"CLIENT_CLASS": "django_redis.client.DefaultClient"},
        }
    }
else:
    CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}

# Cache TTLs (seconds) per endpoint family – keep between 5 and 30 minutes.
CACHE_TTL = {
    "places_list": int(env("CACHE_TTL_PLACES", 300)),       # 5 min
    "places_detail": int(env("CACHE_TTL_PLACE", 900)),      # 15 min
    "taxonomy": int(env("CACHE_TTL_TAXONOMY", 1800)),       # 30 min
}

# NOTE: provider content (e.g. Google Places responses) must NEVER be written
# to this cache unless the provider terms explicitly allow storage/caching.

# ---------------------------------------------------------------------------
# Celery
# ---------------------------------------------------------------------------
CELERY_BROKER_URL = env("CELERY_BROKER_URL", REDIS_URL)
CELERY_RESULT_BACKEND = env("CELERY_RESULT_BACKEND", REDIS_URL)
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_TIMEZONE = "UTC"

from apps.synchronization.schedule import CELERY_BEAT_SCHEDULE  # noqa: E402

# Per-source sync cadence (hours). Configurable, never assume daily-for-all.
SYNC_INTERVAL_HOURS = {
    "submission": 0,          # immediate / event driven
    "official_api": 24,
    "osm": 24 * 7,            # weekly – stable metadata
    "admin_entry": 24 * 30,   # monthly sanity check
}

# External providers – keys stay server side only.
GOOGLE_PLACES_API_KEY = env("GOOGLE_PLACES_API_KEY", "")

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "root": {"handlers": ["console"], "level": env("LOG_LEVEL", "INFO")},
}
