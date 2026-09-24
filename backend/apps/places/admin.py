from django.contrib import admin
from django.contrib.gis.admin import OSMGeoModelAdmin

from apps.places.models import (OpeningHours, Place, PlaceFlag,
                                SourceReference)


class OpeningHoursInline(admin.TabularInline):
    model = OpeningHours
    extra = 0


class SourceReferenceInline(admin.TabularInline):
    model = SourceReference
    extra = 0
    readonly_fields = ("first_seen_at", "last_checked_at")


@admin.register(Place)
class PlaceAdmin(OSMGeoModelAdmin):
    """Map widget uses a configurable tile provider (OSM here for admin only;
    production traffic should point clients at a commercial/self-hosted tile
    service – see frontend/src/map/config.ts)."""

    list_display = ("name", "city", "province", "status", "verification_status",
                    "created_at", "last_verified_at")
    list_filter = ("status", "verification_status", "province", "city",
                   "communities", "categories")
    search_fields = ("name", "normalized_name", "address", "city", "phone", "postal_code")

    def get_search_results(self, request, queryset, search_term):
        qs, use_distinct = super().get_search_results(request, queryset, search_term)
        if search_term:
            # accent/case-insensitive match on the normalized name too
            from django.db.models import Q
            from apps.places.normalization import normalize_name
            qs |= Place.objects.filter(normalized_name__icontains=normalize_name(search_term))
        return qs, True
    filter_horizontal = ("communities", "categories")
    inlines = [OpeningHoursInline, SourceReferenceInline]
    readonly_fields = ("normalized_name", "created_at", "updated_at")
    actions = ["mark_verified", "deactivate"]

    @admin.action(description="Mark selected places as verified")
    def mark_verified(self, request, queryset):
        from django.utils import timezone
        n = 0
        for p in queryset:
            p.verification_status = Place.VERIFY_VERIFIED
            p.verified_at = timezone.now()
            p.last_verified_at = timezone.now()
            p.verified_by = request.user
            p.verification_method = "admin"
            p.save()
            n += 1
        self.message_user(request, f"{n} places verified.")

    @admin.action(description="Deactivate selected places")
    def deactivate(self, request, queryset):
        queryset.update(status=Place.STATUS_INACTIVE)


@admin.register(PlaceFlag)
class PlaceFlagAdmin(admin.ModelAdmin):
    """Duplicate review queue – merges are manual."""

    list_display = ("place", "other_place", "reason", "confidence", "resolved", "created_at")
    list_filter = ("reason", "resolved")
    autocomplete_fields = ("place", "other_place")
    actions = ["merge_into_other", "mark_resolved"]

    @admin.action(description="Merge duplicate INTO the other place (survivor)")
    def merge_into_other(self, request, queryset):
        merged = 0
        for flag in queryset.select_related("place", "other_place"):
            if not flag.other_place:
                continue
            src, dst = flag.place, flag.other_place
            for cat in src.categories.all():
                dst.categories.add(cat)
            for com in src.communities.all():
                dst.communities.add(com)
            for ref in src.source_references.all():
                ref.place = dst
                ref.save()
            src.merged_into = dst
            src.status = Place.STATUS_INACTIVE
            src.save()
            flag.resolved = True
            flag.save()
            merged += 1
        self.message_user(request, f"{merged} duplicates merged.")

    @admin.action(description="Mark flags resolved (not duplicates)")
    def mark_resolved(self, request, queryset):
        queryset.update(resolved=True)
