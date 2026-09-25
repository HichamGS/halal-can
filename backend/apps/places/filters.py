import django_filters as filters

from apps.categories.models import Category
from apps.communities.models import Community
from apps.places.models import Place


class PlaceFilter(filters.FilterSet):
    """Filters required by the spec: community, category, province, city,
    radius (with lat/lng), search, verified, status.

    Geographic filtering is done in PostGIS (see viewset annotate/filter).
    """

    community = filters.ModelChoiceFilter(
        field_name="communities", queryset=Community.objects.filter(is_active=True),
        to_field_name="slug",
    )
    category = filters.ModelChoiceFilter(
        field_name="categories", queryset=Category.objects.filter(is_active=True),
        to_field_name="slug",
    )
    verified = filters.BooleanFilter(field_name="verification_status",
                                     lookup_expr="exact", method="filter_verified")

    class Meta:
        model = Place
        fields = ["province", "city", "status", "postal_code"]

    def filter_verified(self, queryset, name, value):
        if value:
            return queryset.filter(verification_status=Place.VERIFY_VERIFIED)
        return queryset.exclude(verification_status=Place.VERIFY_VERIFIED)
