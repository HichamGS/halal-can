from django.contrib.gis.db.models.functions import Distance
from django.contrib.gis.geos import Point
from django.contrib.gis.measure import D
from django.db.models import Q
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.categories.models import Category
from apps.communities.models import Community
from apps.places.cache_utils import cache_key, get_cached, set_cached
from apps.places.filters import PlaceFilter
from apps.places.models import Place
from apps.places.serializers import (CategorySerializer, CommunitySerializer,
                                     PlaceDetailSerializer, PlaceListSerializer)
from django.conf import settings


class TaxonomyMixin:
    """Simple cached read-only taxonomy endpoints."""

    ttl_key = "taxonomy"

    def list(self, request, *args, **kwargs):
        key = cache_key(self.cache_prefix, dict(request.query_params))
        cached = get_cached(key)
        if cached is not None:
            return Response(cached)
        response = super().list(request, *args, **kwargs)
        set_cached(key, response.data, settings.CACHE_TTL[self.ttl_key])
        return response


class CommunityViewSet(TaxonomyMixin, viewsets.ReadOnlyModelViewSet):
    cache_prefix = "communities"
    serializer_class = CommunitySerializer
    queryset = Community.objects.filter(is_active=True)
    lookup_field = "slug"


class CategoryViewSet(TaxonomyMixin, viewsets.ReadOnlyModelViewSet):
    cache_prefix = "categories"
    serializer_class = CategorySerializer
    queryset = Category.objects.filter(is_active=True)
    lookup_field = "slug"


class ProvinceListViewSet(viewsets.ViewSet):
    """Distinct provinces present in the canonical data (cached)."""

    cache_prefix = "provinces"

    def list(self, request):
        key = cache_key("provinces", {})
        cached = get_cached(key)
        if cached is not None:
            return Response(cached)
        values = (Place.objects.exclude(province="")
                  .values_list("province", flat=True).distinct().order_by("province"))
        data = [{"code": v, "name": v} for v in values]
        set_cached(key, data, settings.CACHE_TTL["taxonomy"])
        return Response(data)


class CityListViewSet(viewsets.ViewSet):
    """Distinct cities, optionally filtered by province (cached per params)."""

    cache_prefix = "cities"

    def list(self, request):
        params = dict(request.query_params)
        key = cache_key("cities", params)
        cached = get_cached(key)
        if cached is not None:
            return Response(cached)
        qs = Place.objects.exclude(city="")
        province = params.get("province")
        if province:
            qs = qs.filter(province__iexact=province)
        rows = (qs.values_list("city", "province")
                .distinct().order_by("city"))
        data = [{"name": c, "province": p} for c, p in rows]
        set_cached(key, data, settings.CACHE_TTL["taxonomy"])
        return Response(data)


class PlaceViewSet(viewsets.ReadOnlyModelViewSet):
    """GET /api/v1/places  and  GET /api/v1/places/{id}

    Supports:
      community, category, province, city, status, verified, search,
      lat & lng & radius (metres, PostGIS dwithin), bounding box via bbox.
    """

    cache_prefix = "places"
    filterset_class = PlaceFilter
    search_fields = ["name", "description", "address", "city", "postal_code"]
    ordering_fields = ["name", "created_at", "distance"]
    queryset = Place.objects.filter(
        status__in=[Place.STATUS_ACTIVE, Place.STATUS_TEMPORARILY_CLOSED]
    ).prefetch_related("communities", "categories")

    def get_serializer_class(self):
        return PlaceDetailSerializer if self.action == "retrieve" else PlaceListSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        p = self.request.query_params
        # trigram-ish fallback via icontains search backend; full text added
        # through raw ILIKE on normalized name for accents-insensitive match
        term = p.get("search") or p.get("q")
        if term:
            qs = qs.filter(Q(name__icontains=term) | Q(normalized_name__icontains=term.lower())
                           | Q(description__icontains=term) | Q(city__icontains=term))
        lat, lng = p.get("lat"), p.get("lng")
        radius = p.get("radius")
        if lat and lng:
            try:
                point = Point(float(lng), float(lat), srid=4326)
                qs = qs.filter(location__isnull=False).annotate(distance_m=Distance("location", point))
                if radius:
                    qs = qs.filter(location__dwithin=(point, D(m=float(radius))))
            except (ValueError, TypeError):
                pass
        bbox = p.get("bbox")  # min_lon,min_lat,max_lon,max_lat
        if bbox:
            try:
                x1, y1, x2, y2 = [float(v) for v in bbox.split(",")]
                from django.contrib.gis.geos import Polygon
                qs = qs.filter(location__within=Polygon.from_bbox((x1, y1, x2, y2)))
            except ValueError:
                pass
        return qs

    def list(self, request, *args, **kwargs):
        key = cache_key("places_list", dict(request.query_params))
        cached = get_cached(key)
        if cached is not None:
            return Response(cached)
        response = super().list(request, *args, **kwargs)
        set_cached(key, response.data, settings.CACHE_TTL["places_list"])
        return response

    def retrieve(self, request, *args, **kwargs):
        key = cache_key("places_detail", {"id": kwargs.get("pk")})
        cached = get_cached(key)
        if cached is not None:
            return Response(cached)
        response = super().retrieve(request, *args, **kwargs)
        set_cached(key, response.data, settings.CACHE_TTL["places_detail"])
        return response
