"""Seed data importer – JSON is ONLY prototype/seed input.

The canonical store after this command runs is PostgreSQL/PostGIS (or
SpatiaLite locally). Re-running is idempotent (upsert by name+city).
"""
import json
from pathlib import Path

from django.contrib.gis.geos import Point
from django.core.management.base import BaseCommand

from apps.categories.models import Category
from apps.communities.models import Community
from apps.places.models import Place
from apps.sources.models import Source

DEFAULT_COMMUNITIES = [
    ("moroccan", "Moroccan"), ("algerian", "Algerian"), ("tunisian", "Tunisian"),
    ("libyan", "Libyan"), ("mauritanian", "Mauritanian"),
    ("maghreb", "Maghreb"), ("north-african", "North African"),
]
# Extensibility: new communities/categories are rows, not code.
DEFAULT_CATEGORIES = [
    ("restaurant", "Restaurant"), ("grocery", "Grocery"), ("butcher", "Butcher"),
    ("bakery", "Bakery"), ("cafe", "Cafe"), ("barber", "Barber"),
    ("beauty", "Beauty"), ("healthcare", "Healthcare"), ("lawyer", "Lawyer"),
    ("accountant", "Accountant"), ("real-estate", "Real Estate"), ("auto", "Auto"),
    ("professional-services", "Professional Services"), ("mosque", "Mosque"),
    ("community-center", "Community Center"), ("association", "Association"),
    ("school", "School"), ("cultural-organization", "Cultural Organization"),
    ("event", "Event"), ("other", "Other"),
]


class Command(BaseCommand):
    help = "Seed taxonomy and import places from a JSON seed file."

    def add_arguments(self, parser):
        parser.add_argument("--file", default="seed_data/places.json")
        parser.add_argument("--wipe", action="store_true")

    def handle(self, *args, **opts):
        path = Path(opts["file"])
        if not path.is_absolute():
            path = Path(__file__).resolve().parents[3] / path
        if opts["wipe"]:
            Place.objects.all().delete()

        for slug, name in DEFAULT_COMMUNITIES:
            Community.objects.get_or_create(slug=slug, defaults={"name": name})
        for slug, name in DEFAULT_CATEGORIES:
            Category.objects.get_or_create(slug=slug, defaults={"name": name})

        seed_source, _ = Source.objects.get_or_create(
            slug="seed_json",
            defaults={"name": "Seed JSON (prototype)", "adapter": "",
                      "storage_policy": Source.STORAGE_CANONICAL},
        )

        if not path.exists():
            self.stdout.write(self.style.WARNING(
                f"No seed file at {path}; taxonomy seeded only."))
            return

        data = json.loads(path.read_text())
        created = updated = 0
        for item in data:
            lat, lng = item.get("latitude"), item.get("longitude")
            location = (Point(float(lng), float(lat), srid=4326)
                        if lat is not None and lng is not None else None)
            defaults = {
                "description": item.get("description", ""),
                "address": item.get("address", ""),
                "province": item.get("province", ""),
                "postal_code": item.get("postal_code", ""),
                "phone": item.get("phone", ""),
                "website": item.get("website", ""),
                "location": location,
                "created_by_source": seed_source,
                "verification_status": item.get(
                    "verification_status", Place.VERIFY_UNVERIFIED),
            }
            place, was_created = Place.objects.get_or_create(
                name=item["name"], city=item.get("city", ""), defaults=defaults,
            )
            if not was_created:
                for k, v in defaults.items():
                    if v not in ("", None):
                        setattr(place, k, v)
                place.save()
                updated += 1
            else:
                created += 1
            for slug in item.get("communities", []):
                c = Community.objects.filter(slug=slug).first()
                if c:
                    place.communities.add(c)
            for slug in item.get("categories", []):
                c = Category.objects.filter(slug=slug).first()
                if c:
                    place.categories.add(c)
        self.stdout.write(self.style.SUCCESS(
            f"Seeded taxonomy; places created={created} updated={updated}"))
