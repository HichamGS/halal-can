"""Celery Beat schedule.

Sync cadence is *configurable per source* (Source.sync_interval_hours).
Beat here only runs a lightweight dispatcher every 15 minutes; it checks
which sources are due based on their own interval and last successful sync,
then queues sync_source for those. This avoids hard-coding "daily for all".
"""
from celery.schedules import crontab

CELERY_BEAT_SCHEDULE = {
    "dispatch-due-source-syncs": {
        "task": "synchronization.dispatch_due_syncs",
        "schedule": 15 * 60,  # evaluate due-ness every 15 min
    },
    "weekly-duplicate-scan": {
        "task": "synchronization.scan_duplicates",
        "schedule": crontab(hour="3", day_of_week="1"),
    },
    "monthly-stale-check": {
        "task": "synchronization.process_stale_checks",
        "schedule": crontab(hour="4", day_of_month="1"),
    },
}
