"""Versioned API routes: /api/v1/..."""
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.places.views import (CategoryViewSet, CityListViewSet,
                               CommunityViewSet, PlaceViewSet,
                               ProvinceListViewSet)
from apps.submissions.views import PlaceReportViewSet, SubmissionViewSet

router = DefaultRouter()
router.register("places", PlaceViewSet, basename="place")
router.register("communities", CommunityViewSet, basename="community")
router.register("categories", CategoryViewSet, basename="category")
router.register("provinces", ProvinceListViewSet, basename="province")
router.register("cities", CityListViewSet, basename="city")
router.register("submissions", SubmissionViewSet, basename="submission")

# POST /api/v1/places/{id}/report
report_detail = PlaceReportViewSet.as_view({"post": "create"})

urlpatterns = [
    path("places/<int:place_pk>/report", report_detail, name="place-report"),
    path("", include(router.urls)),
]
