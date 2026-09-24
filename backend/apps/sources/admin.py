from django.contrib import admin

from apps.sources.models import Source


@admin.register(Source)
class SourceAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "adapter", "storage_policy",
                    "sync_interval_hours", "is_active")
    list_filter = ("storage_policy", "adapter", "is_active")
    prepopulated_fields = {"slug": ("name",)}
    help_texts = {
        "storage_policy": "Reference-only sources (e.g. Google) must NEVER have "
                          "their content persisted as canonical data.",
    }
