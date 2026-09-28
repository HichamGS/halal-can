from django.contrib import admin

from apps.communities.models import Community


@admin.register(Community)
class CommunityAdmin(admin.ModelAdmin):
    """Adding a new community (Somali, Turkish, South Asian, ...) is a row
    insert here – no code change anywhere else."""

    list_display = ("name", "slug", "parent", "is_active", "order", "place_count")
    list_editable = ("is_active", "order")
    search_fields = ("name", "slug")
    prepopulated_fields = {"slug": ("name",)}

    @admin.display(description="Places")
    def place_count(self, obj):
        return obj.places.count()
