from rest_framework import serializers

from apps.categories.models import Category
from apps.communities.models import Community
from apps.places.models import OpeningHours, Place, SourceReference


class CommunitySerializer(serializers.ModelSerializer):
    class Meta:
        model = Community
        fields = ["id", "slug", "name", "description", "parent", "order"]


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ["id", "slug", "name", "description", "icon", "parent", "order"]


class OpeningHoursSerializer(serializers.ModelSerializer):
    day = serializers.CharField(source="get_day_of_week_display")

    class Meta:
        model = OpeningHours
        fields = ["day", "opens", "closes", "is_closed"]


class SourceReferenceSerializer(serializers.ModelSerializer):
    """External identity only. raw_data deliberately NOT exposed publicly."""

    class Meta:
        model = SourceReference
        fields = ["source_id", "source_url", "last_checked_at"]


class PlaceListSerializer(serializers.ModelSerializer):
    communities = CommunitySerializer(many=True, read_only=True)
    categories = CategorySerializer(many=True, read_only=True)
    distance_m = serializers.SerializerMethodField()

    class Meta:
        model = Place
        fields = [
            "id", "name", "city", "province", "latitude", "longitude",
            "status", "verification_status", "communities", "categories",
            "phone", "website", "address", "distance_m",
        ]

    def get_distance_m(self, obj):
        return round(obj.distance_m) if hasattr(obj, "distance_m") and obj.distance_m is not None else None


class PlaceDetailSerializer(serializers.ModelSerializer):
    communities = CommunitySerializer(many=True, read_only=True)
    categories = CategorySerializer(many=True, read_only=True)
    opening_hours = OpeningHoursSerializer(many=True, read_only=True)
    source_references = SourceReferenceSerializer(many=True, read_only=True)
    distance_m = serializers.SerializerMethodField()

    class Meta:
        model = Place
        fields = [
            "id", "name", "description", "address", "city", "province",
            "postal_code", "latitude", "longitude", "phone", "website", "email",
            "status", "verification_status", "communities", "categories",
            "opening_hours", "source_references", "created_at", "updated_at",
            "last_verified_at", "last_checked_at", "distance_m",
        ]

    def get_distance_m(self, obj):
        return round(obj.distance_m) if hasattr(obj, "distance_m") and obj.distance_m is not None else None
