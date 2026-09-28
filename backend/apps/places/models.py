from django.conf import settings
from django.contrib.gis.db import models as gis_models
from django.contrib.gis.geos import Point
from django.db import models
from django.utils import timezone

from apps.categories.models import Category
from apps.communities.models import Community
from apps.common import TimeStampedModel
from apps.sources.models import Source


class Place(TimeStampedModel):
    """Canonical business / service / location record.

    PostgreSQL/PostGIS is the source of truth. Provider data lives in
    SourceReference and is never merged blindly into canonical fields.
    """

    STATUS_ACTIVE = "active"
    STATUS_INACTIVE = "inactive"
    STATUS_TEMPORARILY_CLOSED = "temporarily_closed"
    STATUS_PERMANENTLY_CLOSED = "permanently_closed"
    STATUS_PENDING = "pending"
    STATUS_CHOICES = [
        (STATUS_ACTIVE, "Active"),
        (STATUS_PENDING, "Pending review"),
        (STATUS_TEMPORARILY_CLOSED, "Temporarily closed"),
        (STATUS_PERMANENTLY_CLOSED, "Permanently closed"),
        (STATUS_INACTIVE, "Inactive / deactivated"),
    ]

    VERIFY_UNVERIFIED = "unverified"
    VERIFY_PENDING = "pending"
    VERIFY_VERIFIED = "verified"
    VERIFY_REPORTED = "reported"
    VERIFY_REJECTED = "rejected"
    VERIFICATION_CHOICES = [
        (VERIFY_UNVERIFIED, "Unverified"),
        (VERIFY_PENDING, "Pending"),
        (VERIFY_VERIFIED, "Verified"),
        (VERIFY_REPORTED, "Reported"),
        (VERIFY_REJECTED, "Rejected"),
    ]

    # identity
    name = models.CharField(max_length=255)
    normalized_name = models.CharField(max_length=255, blank=True, db_index=True)
    description = models.TextField(blank=True)

    # location – PostGIS point is canonical; lat/lng are derived helpers
    location = gis_models.PointField(srid=4326, null=True, blank=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    address = models.CharField(max_length=255, blank=True)
    city = models.CharField(max_length=128, blank=True, db_index=True)
    province = models.CharField(max_length=64, blank=True, db_index=True)
    postal_code = models.CharField(max_length=16, blank=True, db_index=True)

    # contact
    phone = models.CharField(max_length=32, blank=True, db_index=True)
    website = models.URLField(max_length=512, blank=True)
    email = models.EmailField(blank=True)

    # taxonomy (data-driven, many-to-many)
    communities = models.ManyToManyField(Community, blank=True, related_name="places")
    categories = models.ManyToManyField(Category, blank=True, related_name="places")

    # lifecycle / trust
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default=STATUS_ACTIVE, db_index=True)
    verification_status = models.CharField(
        max_length=16, choices=VERIFICATION_CHOICES, default=VERIFY_UNVERIFIED, db_index=True,
    )
    verification_method = models.CharField(max_length=64, blank=True)
    verified_at = models.DateTimeField(null=True, blank=True)
    verified_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
        related_name="verified_places",
    )
    verification_notes = models.TextField(blank=True)
    last_verified_at = models.DateTimeField(null=True, blank=True)
    last_checked_at = models.DateTimeField(null=True, blank=True)

    # provenance of the canonical record itself
    created_by_source = models.ForeignKey(
        Source, null=True, blank=True, on_delete=models.SET_NULL, related_name="created_places",
    )
    merged_into = models.ForeignKey(
        "self", null=True, blank=True, on_delete=models.SET_NULL,
        related_name="merge_candidates",
        help_text="If this place was deduplicated, the surviving canonical place.",
    )

    class Meta:
        ordering = ["name"]
        indexes = [
            models.Index(fields=["city", "status"]),
            models.Index(fields=["province", "status"]),
            models.Index(fields=["normalized_name", "phone"]),
            models.Index(fields=["verification_status"]),
            # NOTE: the GiST spatial index on `location` is created by the
            # PostGIS migration in apps/places/migrations (production DB).
            # SpatiaLite gets its index via RecoverGeometryColumn/CREATE SPATIAL INDEX.
        ]
        constraints = [
            models.CheckConstraint(
                check=(
                    models.Q(location__isnull=False)
                    | (models.Q(latitude__isnull=False) & models.Q(longitude__isnull=False))
                ),
                name="place_needs_coordinates",
            )
        ]

    def save(self, *args, **kwargs):
        from apps.places.normalization import normalize_name

        self.normalized_name = normalize_name(self.name)
        # keep both representations in sync (lat/lng convenience for clients,
        # PostGIS point canonical for queries)
        if self.location is not None:
            self.longitude, self.latitude = Point(self.location.x, self.location.y).coords[:2]
        elif self.latitude is not None and self.longitude is not None and self.location is None:
            self.location = Point(float(self.longitude), float(self.latitude), srid=4326)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.name} ({self.city or 'no city'})"


class PlaceCommunity(models.Model):
    """Explicit through table (kept for future per-link metadata such as
    confidence / source of the association)."""

    place = models.ForeignKey(Place, on_delete=models.CASCADE)
    community = models.ForeignKey(Community, on_delete=models.CASCADE)

    class Meta:
        unique_together = ("place", "community")


class PlaceCategory(models.Model):
    place = models.ForeignKey(Place, on_delete=models.CASCADE)
    category = models.ForeignKey(Category, on_delete=models.CASCADE)

    class Meta:
        unique_together = ("place", "category")


class SourceReference(models.Model):
    """External identity of a place at a provider.

    Provider-specific payloads stay HERE, separated from canonical fields.
    For Google we store the Place ID (an external identifier) and only render
    content fetched live through the official API when terms require it.
    NEVER scrape Google Maps / Search.
    """

    place = models.ForeignKey(Place, on_delete=models.CASCADE, related_name="source_references")
    # NOTE: the FK is named `provider` (not `source`) because Django would
    # otherwise clash it with the auto-created `<field>_id` column of the
    # provider-native identifier below (models.E006).
    provider = models.ForeignKey(Source, on_delete=models.CASCADE, related_name="references")
    external_id = models.CharField(max_length=255, help_text="Provider-native id, e.g. Google Place ID.")
    source_url = models.URLField(max_length=512, blank=True)
    # Only populated when source.storage_policy allows persisting content.
    raw_data = models.JSONField(default=dict, blank=True)
    first_seen_at = models.DateTimeField(auto_now_add=True)
    last_checked_at = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = ("provider", "external_id")
        indexes = [
            models.Index(fields=["provider", "external_id"]),
            models.Index(fields=["place"]),
        ]

    def __str__(self):
        return f"{self.provider.slug}:{self.external_id}"


class OpeningHours(models.Model):
    """Stored per weekday so hours can be updated independently."""

    DAY_CHOICES = [(i, d) for i, d in enumerate(
        ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
    )]

    place = models.ForeignKey(Place, on_delete=models.CASCADE, related_name="opening_hours")
    day_of_week = models.PositiveSmallIntegerField(choices=DAY_CHOICES)
    opens = models.TimeField(null=True, blank=True)
    closes = models.TimeField(null=True, blank=True)
    is_closed = models.BooleanField(default=False)

    class Meta:
        unique_together = ("place", "day_of_week")
        ordering = ["day_of_week"]

    def __str__(self):
        return f"{self.place_id} {self.get_day_of_week_display()}"


class PlaceFlag(models.Model):
    """Duplicate candidates flagged for MANUAL review – low-confidence
    matches are never auto-merged."""

    REASON_DUPLICATE = "duplicate"
    REASON_DATA_QUALITY = "data_quality"
    REASON_CHOICES = [
        (REASON_DUPLICATE, "Possible duplicate"),
        (REASON_DATA_QUALITY, "Data quality issue"),
    ]

    place = models.ForeignKey(Place, on_delete=models.CASCADE, related_name="flags")
    other_place = models.ForeignKey(
        Place, null=True, blank=True, on_delete=models.SET_NULL, related_name="flagged_against",
    )
    reason = models.CharField(max_length=32, choices=REASON_CHOICES, default=REASON_DUPLICATE)
    confidence = models.FloatField(default=0.0)
    details = models.JSONField(default=dict, blank=True)
    resolved = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["resolved", "reason"])]

    def __str__(self):
        return f"flag {self.reason} on place {self.place_id}"
