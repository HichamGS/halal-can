from django.db import models

from apps.sources.models import Source


class SyncLog(models.Model):
    """Every synchronization run is recorded: last success/failure, counts,
    errors. Scheduled frequency is configurable per source (Source.sync_interval_hours)."""

    STATUS_SUCCESS = "success"
    STATUS_PARTIAL = "partial"
    STATUS_FAILED = "failed"
    STATUS_CHOICES = [
        (STATUS_SUCCESS, "Success"),
        (STATUS_PARTIAL, "Partial"),
        (STATUS_FAILED, "Failed"),
    ]

    source = models.ForeignKey(Source, on_delete=models.CASCADE, related_name="sync_logs")
    started_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default=STATUS_SUCCESS)
    query = models.CharField(max_length=255, blank=True)
    processed = models.PositiveIntegerField(default=0)
    created = models.PositiveIntegerField(default=0)
    updated = models.PositiveIntegerField(default=0)
    flagged = models.PositiveIntegerField(default=0, help_text="Possible duplicates sent to manual review.")
    rejected = models.PositiveIntegerField(default=0)
    errors = models.TextField(blank=True)

    class Meta:
        ordering = ["-started_at"]
        indexes = [models.Index(fields=["source", "-started_at"])]

    def __str__(self):
        return f"{self.source.slug} @ {self.started_at:%Y-%m-%d %H:%M} ({self.status})"
