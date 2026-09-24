"""Celery application.

Beat schedule is derived from Source.sync_interval_hours so cadence is
configurable per source (never "query everyone every day"). Google Places is
on-demand only unless explicitly configured with an interval AND respecting
API policies; we never scrape and never cache provider content against terms.
"""
import os

from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

app = Celery("maghreb_connect")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks(["apps.synchronization"])
