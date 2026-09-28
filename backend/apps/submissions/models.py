from django.conf import settings
from django.db import models

from apps.categories.models import Category
from apps.communities.models import Community
from apps.places.models import Place


class UserSubmission(models.Model):
    """Everything users can suggest/report goes through moderation."""

    TYPE_SUGGEST_PLACE = "suggest_place"
    TYPE_REPORT_CLOSED = "report_closed"
    TYPE_REPORT_INCORRECT = "report_incorrect"
    TYPE_ADDRESS_CORRECTION = "address_correction"
    TYPE_CATEGORY_SUGGESTION = "category_suggestion"
    TYPE_COMMUNITY_SUGGESTION = "community_suggestion"
    TYPE_CHOICES = [
        (TYPE_SUGGEST_PLACE, "Suggest a new place"),
        (TYPE_REPORT_CLOSED, "Report closed business"),
        (TYPE_REPORT_INCORRECT, "Report incorrect information"),
        (TYPE_ADDRESS_CORRECTION, "Suggest address correction"),
        (TYPE_CATEGORY_SUGGESTION, "Suggest category"),
        (TYPE_COMMUNITY_SUGGESTION, "Suggest community association"),
    ]

    STATUS_PENDING = "pending"
    STATUS_APPROVED = "approved"
    STATUS_REJECTED = "rejected"
    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending review"),
        (STATUS_APPROVED, "Approved"),
        (STATUS_REJECTED, "Rejected"),
    ]

    submission_type = models.CharField(max_length=32, choices=TYPE_CHOICES)
    place = models.ForeignKey(Place, null=True, blank=True, on_delete=models.CASCADE,
                              related_name="submissions")
    suggested_name = models.CharField(max_length=255, blank=True)
    suggested_phone = models.CharField(max_length=32, blank=True)
    suggested_website = models.URLField(blank=True)
    suggested_address = models.CharField(max_length=255, blank=True)
    suggested_city = models.CharField(max_length=128, blank=True)
    suggested_province = models.CharField(max_length=64, blank=True)
    suggested_latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    suggested_longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    categories = models.ManyToManyField(Category, blank=True, related_name="submissions")
    communities = models.ManyToManyField(Community, blank=True, related_name="submissions")
    message = models.TextField(blank=True)
    submitter_email = models.EmailField(blank=True)
    submitter_name = models.CharField(max_length=128, blank=True)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default=STATUS_PENDING,
                              db_index=True)
    reviewed_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                    on_delete=models.SET_NULL, related_name="reviewed_submissions")
    reviewed_at = models.DateTimeField(null=True, blank=True)
    review_notes = models.TextField(blank=True)
    created_place = models.ForeignKey(Place, null=True, blank=True, on_delete=models.SET_NULL,
                                      related_name="created_from_submission")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["status", "submission_type"])]

    def __str__(self):
        return f"{self.submission_type} – {self.suggested_name or self.place_id} ({self.status})"
