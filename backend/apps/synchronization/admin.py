from django.contrib import admin

from apps.synchronization.models import SyncLog


@admin.register(SyncLog)
class SyncLogAdmin(admin.ModelAdmin):
    """Synchronization status inspection (read-only)."""

    list_display = ("source", "started_at", "finished_at", "status",
                    "processed", "created", "updated", "flagged", "rejected")
    list_filter = ("source", "status")
    readonly_fields = [f.name for f in SyncLog._meta.fields]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
