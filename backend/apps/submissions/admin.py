from django.contrib import admin

from apps.submissions.models import UserSubmission


@admin.register(UserSubmission)
class UserSubmissionAdmin(admin.ModelAdmin):
    """Moderation queue."""

    list_display = ("submission_type", "suggested_name", "place", "status",
                    "submitter_name", "created_at")
    list_filter = ("status", "submission_type")
    search_fields = ("suggested_name", "message", "submitter_email")
    readonly_fields = ("created_at", "reviewed_at", "reviewed_by", "created_place")
    actions = ["approve_selected", "reject_selected"]

    def approve(self, request, queryset):
        from apps.synchronization.tasks import approve_submission
        for sub in queryset.filter(status=UserSubmission.STATUS_PENDING):
            approve_submission(sub.id, reviewer_id=request.user.id)

    @admin.action(description="Approve selected submissions")
    def approve_selected(self, request, queryset):
        self.approve(request, queryset)
        self.message_user(request, "Selected submissions approved and ingested.")

    @admin.action(description="Reject selected submissions")
    def reject_selected(self, request, queryset):
        from django.utils import timezone
        queryset.update(status=UserSubmission.STATUS_REJECTED,
                        reviewed_by=request.user, reviewed_at=timezone.now())
