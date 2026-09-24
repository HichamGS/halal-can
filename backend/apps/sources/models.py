from django.db import models

from apps.common import TimeStampedModel


class Source(TimeStampedModel):
    """Where a piece of information came from.

    Each source declares its storage policy so the ingestion pipeline never
    violates provider terms:

    - CANONICAL : data we own (submissions, admin entry) – full persistence.
    - REFERENCE : only external identifiers may be stored (e.g. Google Place
                  ID + URL). Provider content must be fetched dynamically.
    - LICENSED  : OSM/official APIs whose license permits storing normalized
                  data with attribution.
    """

    STORAGE_CANONICAL = "canonical"
    STORAGE_REFERENCE = "reference"
    STORAGE_LICENSED = "licensed"
    STORAGE_CHOICES = [
        (STORAGE_CANONICAL, "Canonical – we own the data, full persistence"),
        (STORAGE_LICENSED, "Licensed – persistence allowed with attribution"),
        (STORAGE_REFERENCE, "Reference only – store IDs, fetch content live"),
    ]

    ADAPTER_CHOICES = [
        ("", "None (manual)"),
        ("google_places", "Google Places API adapter"),
        ("openstreetmap", "OpenStreetMap adapter"),
        ("official_website", "Official website adapter"),
        ("business_submission", "Business submission adapter"),
        ("seed_json", "Seed JSON importer"),
    ]

    slug = models.SlugField(max_length=64, unique=True)
    name = models.CharField(max_length=128)
    adapter = models.CharField(max_length=64, choices=ADAPTER_CHOICES, blank=True)
    storage_policy = models.CharField(
        max_length=16, choices=STORAGE_CHOICES, default=STORAGE_CANONICAL,
    )
    attribution_required = models.BooleanField(default=False)
    attribution_text = models.CharField(max_length=255, blank=True)
    # sync cadence – configurable per source, never assume "everyone daily"
    sync_interval_hours = models.PositiveIntegerField(
        null=True, blank=True,
        help_text="Hours between syncs. Null = event-driven / on-demand only.",
    )
    api_limit_note = models.CharField(
        max_length=255, blank=True,
        help_text="Reminder of provider rate/storage limits.",
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]
        indexes = [models.Index(fields=["slug"]), models.Index(fields=["adapter"])]

    def __str__(self):
        return self.name
