"""Background tasks: synchronization, validation, dedup scans, submission
processing. All runs are recorded in SyncLog."""
import logging

from celery import shared_task
from django.utils import timezone

logger = logging.getLogger(__name__)


@shared_task(name="synchronization.sync_source")
def sync_source(source_id: int, query: str = ""):
    """Run one adapter for one source and feed the canonicalization pipeline."""
    from apps.sources.models import Source
    from apps.sources.adapters import get_adapter
    from apps.sources.pipeline import ingest_normalized
    from apps.synchronization.models import SyncLog

    log = SyncLog.objects.create(source_id=source_id, query=query)
    try:
        source = Source.objects.get(pk=source_id, is_active=True)
        adapter = get_adapter(source)
        results = adapter.run(query) if query else []
        for np_place in results:
            log.processed += 1
            ingest_normalized(np_place, source=source, sync_log=log)
        log.status = SyncLog.STATUS_SUCCESS if not log.errors else SyncLog.STATUS_PARTIAL
    except Exception as exc:
        logger.exception("sync_source failed")
        log.status = SyncLog.STATUS_FAILED
        log.errors = str(exc)[:2000]
    log.finished_at = timezone.now()
    log.save()
    return {"log_id": log.id, "status": log.status, "processed": log.processed}


@shared_task(name="synchronization.scan_duplicates")
def scan_duplicates(batch_size: int = 500):
    """Periodic dedup scan: flag likely duplicates for MANUAL review.
    Nothing is auto-merged here."""
    from apps.places.deduplication import similarity
    from apps.places.models import Place, PlaceFlag
    from apps.places.normalization import normalize_phone

    flagged = 0
    places = list(Place.objects.filter(
        status__in=[Place.STATUS_ACTIVE, Place.STATUS_PENDING]
    ).order_by("normalized_name", "id").values_list("id", "normalized_name", "phone", "city")[:batch_size])

    by_name_city = {}
    by_phone = {}
    for pid, nname, phone, city in places:
        key = (nname, (city or "").lower())
        other = by_name_city.get(key)
        if other:
            PlaceFlag.objects.get_or_create(
                place_id=pid, other_place_id=other,
                reason=PlaceFlag.REASON_DUPLICATE,
                defaults={"confidence": 0.9,
                          "details": {"match": "same normalized name + city"}},
            )
            flagged += 1
        else:
            by_name_city[key] = pid

        pkey = normalize_phone(phone or "")
        if pkey:
            other = by_phone.get(pkey)
            if other and other != pid:
                PlaceFlag.objects.get_or_create(
                    place_id=pid, other_place_id=other,
                    reason=PlaceFlag.REASON_DUPLICATE,
                    defaults={"confidence": 0.95, "details": {"match": "same phone"}},
                )
                flagged += 1
            else:
                by_phone.setdefault(pkey, pid)
    return {"flagged": flagged}


@shared_task(name="synchronization.process_stale_checks")
def process_stale_checks(max_age_days: int = 180):
    """Queue re-validation for places not checked recently (validation job)."""
    from datetime import timedelta

    from apps.places.models import Place

    cutoff = timezone.now() - timedelta(days=max_age_days)
    stale = Place.objects.filter(status=Place.STATUS_ACTIVE).filter(
        models_q_last_checked_lt(cutoff)
    )
    count = 0
    for p in stale.only("id")[:1000]:
        p.last_checked_at = timezone.now()
        p.save(update_fields=["last_checked_at", "updated_at"])
        count += 1
    return {"stale_touched": count}


def models_q_last_checked_lt(cutoff):
    from django.db.models import Q
    return Q(last_checked_at__lt=cutoff) | Q(last_checked_at__isnull=True)


@shared_task(name="synchronization.approve_submission")
def approve_submission(submission_id: int, reviewer_id: int | None = None):
    """Admin-approved submission -> canonical Place via the same pipeline."""
    from django.contrib.auth import get_user_model

    from apps.places.models import Place
    from apps.sources.pipeline import ingest_normalized
    from apps.sources.adapters import NormalizedPlace
    from apps.submissions.models import UserSubmission

    sub = UserSubmission.objects.get(pk=submission_id)
    if sub.status != UserSubmission.STATUS_PENDING:
        return {"skipped": True}
    source, _ = _submission_source()
    np_place = NormalizedPlace(
        name=sub.suggested_name or (sub.place.name if sub.place else ""),
        phone=sub.suggested_phone, website=sub.suggested_website,
        address=sub.suggested_address, city=sub.suggested_city,
        province=sub.suggested_province,
        latitude=float(sub.suggested_latitude) if sub.suggested_latitude is not None else None,
        longitude=float(sub.suggested_longitude) if sub.suggested_longitude is not None else None,
        categories=[c.slug for c in sub.categories.all()],
        communities=[c.slug for c in sub.communities.all()],
    )
    place, outcome = ingest_normalized(np_place, source=source)
    sub.status = UserSubmission.STATUS_APPROVED
    sub.reviewed_at = timezone.now()
    if reviewer_id:
        sub.reviewed_by_id = reviewer_id
    if place and sub.submission_type == UserSubmission.TYPE_SUGGEST_PLACE:
        sub.created_place = place
    sub.save()
    if place and sub.place and sub.submission_type != UserSubmission.TYPE_SUGGEST_PLACE:
        # corrections flip verification to pending until a human confirms field-level changes
        place.verification_status = Place.VERIFY_PENDING
        place.save(update_fields=["verification_status", "updated_at"])
    return {"place_id": place.id if place else None, "outcome": outcome}


def _submission_source():
    from apps.sources.models import Source
    return Source.objects.get_or_create(
        slug="business_submission",
        defaults={"name": "Business submission", "adapter": "business_submission",
                  "storage_policy": Source.STORAGE_CANONICAL},
    )


@shared_task(name="synchronization.dispatch_due_syncs")
def dispatch_due_syncs():
    """Queue sync_source only for sources whose configured interval elapsed."""
    from datetime import timedelta

    from django.db.models import Max

    from apps.sources.models import Source
    from apps.synchronization.models import SyncLog

    dispatched = []
    now = timezone.now()
    for source in Source.objects.filter(is_active=True).exclude(sync_interval_hours=None):
        last = SyncLog.objects.filter(source=source).aggregate(m=Max("started_at"))["m"]
        due_at = last + timedelta(hours=source.sync_interval_hours) if last else None
        if due_at is None or now >= due_at:
            sync_source.delay(source.id)
            dispatched.append(source.slug)
    return {"dispatched": dispatched}
