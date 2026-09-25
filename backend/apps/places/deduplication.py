"""Deduplication strategy.

Priority:
1. Provider id match (SourceReference source+source_id) -> same place.
2. High-confidence field matches (phone / domain / exact normalized name +
   address) -> auto-match candidate.
3. Fuzzy similarity + geographic proximity -> flag for MANUAL review.
   Low-confidence duplicates are NEVER automatically merged.
"""
from difflib import SequenceMatcher

from django.contrib.gis.geos import Point
from django.db.models import Q

from apps.places.models import Place, PlaceFlag, SourceReference
from apps.places.normalization import domain_of, normalize_address, normalize_name, normalize_phone

AUTO_MERGE_THRESHOLD = 0.95
FLAG_THRESHOLD = 0.75


def find_source_duplicate(source_id_value: int | str, source) -> Place | None:
    ref = SourceReference.objects.filter(provider=source, external_id=str(source_id_value)).first()
    return ref.place if ref else None


def similarity(a: str, b: str) -> float:
    if not a or not b:
        return 0.0
    return SequenceMatcher(None, a, b).ratio()


def distance_m(p1: Point, p2: Point) -> float:
    try:
        return p1.distance(p2)  # meters on geodetic fields
    except Exception:
        return float("inf")


def find_candidates(place_data: dict) -> list[tuple[Place, float, str]]:
    """Return (place, score, reason) candidates for a new/updated record."""
    name = normalize_name(place_data.get("name", ""))
    phone = normalize_phone(place_data.get("phone", ""))
    domain = domain_of(place_data.get("website", ""))
    address = normalize_address(place_data.get("address", ""))
    results: list[tuple[Place, float, str]] = []

    qs = Place.objects.exclude(status=Place.STATUS_PERMANENTLY_CLOSED)
    if phone:
        for p in qs.filter(phone=phone):
            results.append((p, 0.98, "phone"))
    if domain:
        for p in qs.filter(website__icontains=domain):
            results.append((p, 0.97, "website_domain"))
    if name:
        base = Q(normalized_name=name)
        if address:
            base |= Q(address__icontains=address.split(" ")[0])
        for p in qs.filter(base):
            score = similarity(name, p.normalized_name)
            if address and normalize_address(p.address) == address:
                score = max(score, 0.96)
            results.append((p, score, "name" + ("+address" if address else "")))
    return results


def deduplicate(place_data: dict, source=None, external_id: str | None = None):
    """Decide what to do with an incoming record.

    Returns one of:
      ("match", place)        – confident duplicate, update canonical place
      ("flag", [flags])       – ambiguous, create as pending + flag for review
      ("new", None)           – no duplicate found
    """
    if source is not None and external_id:
        existing = find_source_duplicate(external_id, source)
        if existing:
            return "match", existing

    candidates = find_candidates(place_data)
    if not candidates:
        return "new", None

    best_place, best_score, reason = max(candidates, key=lambda c: c[1])

    # proximity boost / penalty
    lat, lng = place_data.get("latitude"), place_data.get("longitude")
    if lat is not None and lng is not None and best_place.location:
        dist = distance_m(Point(float(lng), float(lat), srid=4326), best_place.location)
        if dist < 150:
            best_score = min(1.0, best_score + 0.05)
        elif dist > 2000:
            best_score -= 0.15

    if best_score >= AUTO_MERGE_THRESHOLD:
        return "match", best_place

    if best_score >= FLAG_THRESHOLD:
        flags = [
            PlaceFlag.objects.create(
                place_id=None,  # caller fills in after saving the new place
                other_place=p,
                reason=PlaceFlag.REASON_DUPLICATE,
                confidence=round(s, 3),
                details={"reason_field": r},
            )
            for p, s, r in candidates if s >= FLAG_THRESHOLD
        ]
        return "flag", flags

    return "new", None
