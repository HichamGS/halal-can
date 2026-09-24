from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle

from apps.places.models import Place
from apps.submissions.serializers import (ReportSerializer,
                                          SubmissionCreateSerializer,
                                          SubmissionOutSerializer)


class SubmissionViewSet(viewsets.GenericViewSet):
    """POST /api/v1/submissions  (moderated – nothing hits canonical data directly)"""

    serializer_class = SubmissionCreateSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "submission"

    def get_queryset(self):
        from apps.submissions.models import UserSubmission
        return UserSubmission.objects.none()  # public API is write-only

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        submission = serializer.save()
        return Response(
            SubmissionOutSerializer(submission).data,
            status=status.HTTP_201_CREATED,
        )


class PlaceReportViewSet(viewsets.ViewSet):
    """POST /api/v1/places/{id}/report"""

    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "submission"

    def create(self, request, place_pk=None):
        try:
            place = Place.objects.get(pk=place_pk)
        except Place.DoesNotExist:
            return Response({"detail": "Place not found."}, status=status.HTTP_404_NOT_FOUND)
        serializer = ReportSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        submission = serializer.create_submission(place)
        return Response(
            SubmissionOutSerializer(submission).data,
            status=status.HTTP_201_CREATED,
        )
