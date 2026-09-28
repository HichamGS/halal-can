from django.contrib import admin

from apps.categories.models import Category


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "icon", "parent", "is_active", "order", "place_count")
    list_editable = ("is_active", "order")
    search_fields = ("name", "slug")
    prepopulated_fields = {"slug": ("name",)}

    @admin.display(description="Places")
    def place_count(self, obj):
        return obj.places.count()
