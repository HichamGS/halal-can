"""Canonicalization pipeline: normalized adapter output -> Place.

Never blindly inserts external records: normalizes first, dedups second,
records provenance (SourceReference) third.
"""
from django.contrib.gis.geos import Point
from django.utils import timezone

from apps.categories.models import Category
from apps.communities.models import Community
from apps.places.deduplication import deduplicate
from apps.places.models import Place, SourceReference
from apps.places.normalization import (normalize_address, normalize_phone,
                                       normalize_postal_code, normalize_url)


def ingest_normalized(np_place, source, sync_log=None):
    """Returns (place, created|updated|flagged)."""
    data = {
        "name": np_place.name.strip(),
        "phone": normalize_phone(np_place.phone),
        "website": normalize_url(np_place.website),
        "address": normalize_address(np_place.address),
        "city": np_place.city.strip().title() if np_place.city else "",
        "province": np_place.province.strip(),
        "postal_code": normalize_postal_code(np_place.postal_code),
        "latitude": np_place.latitude,
        "longitude": np_place.longitude,
        "description": np_place.description,
    }
    if not data["name"]:
        if sync_log:
            sync_log.rejected += 1
        return None, "rejected"

    action, result = deduplicate(data, source=source, external_id=np_place.external_id)

    if action == "match":
        place = result
        for field in ("phone", "website", "address", "postal_code"):
            if getattr(place, field) in ("", None) and data[field]:
                setattr(place, field, data[field])
        place.last_checked_at = timezone.now()
        place.save(update_fields=[
            "phone", "website", "address", "postal_code", "last_checked_at", "updated_at",
        ])
        outcome = "updated"
    else:
        status = Place.STATUS_PENDING if action == "flag" else Place.STATUS_ACTIVE
        place = Place(
            name=data["name"], phone=data["phone"], website=_abs_url(data["website"]),
            address=data["address"], city=data["city"], province=data["province"],
            postal_code=data["postal_code"], description=data["description"],
            status=status, created_by_source=source,
            verification_status=Place.VERIFY_UNVERIFIED,
        )
        if data["latitude"] is not None and data["longitude"] is not None:
            place.location = Point(float(data["longitude"]), float(data["latitude"]), srid=4326)
        place.save()
        if action == "flag":
            from apps.places.models import PlaceFlag
            PlaceFlag.objects.filter(place__isnull=True).update(place=place)
            outcome = "flagged"
        else:
            outcome = "created"

    # provenance: always record the external identity
    if np_place.external_id and source is not None:
        ref, _ = SourceReference.objects.get_or_create(
            provider=source, external_id=str(np_place.external_id),
            defaults={"place": place, "source_url": np_place.source_url or ""},
        )
        ref.last_checked_at = timezone.now()
        # raw provider payload persisted ONLY when policy allows it
        if source.storage_policy != SourceReference._meta.get_field("source").model.STORAGE_REFERENCE and np_place.raw:
            ref.raw_data = np_place.raw
        ref.save()

    _link_taxonomy(place, np_place)

    if sync_log:
        if outcome == "created":
            sync_log.created += 1
        elif outcome == "updated":
            sync_log.updated += 1
        elif outcome == "flagged":
            sync_log.flagged += 1
    return place, outcome


def _abs_url(url):
    if url and "://" not in url:
        return "https://" + url
    return url


def _link_taxonomy(place, np_place):
    for slug in np_place.categories:
        cat = Category.objects.filter(slug=slug).first()
        if cat:
            place.categories.add(cat)
    for slug in np_place.communities:
        com = Community.objects.filter(slug=slug).first()
        if com:
            place.communities.add(com)
