from rest_framework import serializers

from apps.places.models import Place
from apps.submissions.models import UserSubmission


class SubmissionCreateSerializer(serializers.ModelSerializer):
    """Public submission endpoint. Everything lands in the moderation queue –
    nothing is written to canonical data until an admin approves it."""

    categories = serializers.ListField(
        child=serializers.SlugField(), required=False, write_only=True)
    communities = serializers.ListField(
        child=serializers.SlugField(), required=False, write_only=True)

    class Meta:
        model = UserSubmission
        fields = [
            "submission_type", "place", "suggested_name", "suggested_phone",
            "suggested_website", "suggested_address", "suggested_city",
            "suggested_province", "suggested_latitude", "suggested_longitude",
            "categories", "communities", "message", "submitter_email",
            "submitter_name",
        ]

    def validate_submission_type(self, value):
        valid = [c[0] for c in UserSubmission.TYPE_CHOICES]
        if value not in valid:
            raise serializers.ValidationError(f"Unknown submission type. One of {valid}")
        return value

    def validate(self, attrs):
        stype = attrs.get("submission_type")
        needs_place = stype in (
            UserSubmission.TYPE_REPORT_CLOSED, UserSubmission.TYPE_REPORT_INCORRECT,
            UserSubmission.TYPE_ADDRESS_CORRECTION, UserSubmission.TYPE_CATEGORY_SUGGESTION,
            UserSubmission.TYPE_COMMUNITY_SUGGESTION,
        )
        if needs_place and not attrs.get("place"):
            raise serializers.ValidationError({"place": "This submission requires a place id."})
        if stype == UserSubmission.TYPE_SUGGEST_PLACE and not attrs.get("suggested_name"):
            raise serializers.ValidationError({"suggested_name": "Required when suggesting a place."})
        return attrs

    def create(self, validated_data):
        cats = validated_data.pop("categories", [])
        comms = validated_data.pop("communities", [])
        submission = UserSubmission.objects.create(**validated_data)
        if cats:
            from apps.categories.models import Category
            submission.categories.set(Category.objects.filter(slug__in=cats))
        if comms:
            from apps.communities.models import Community
            submission.communities.set(Community.objects.filter(slug__in=comms))
        return submission


class SubmissionOutSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserSubmission
        fields = ["id", "submission_type", "status", "created_at"]


class ReportSerializer(serializers.Serializer):
    """POST /api/v1/places/{id}/report"""

    report_type = serializers.ChoiceField(choices=[
        ("closed", "Business is closed"),
        ("incorrect_info", "Information is incorrect"),
        ("address", "Address is wrong"),
        ("other", "Other"),
    ])
    message = serializers.CharField(max_length=2000)

    def create_submission(self, place):
        mapping = {
            "closed": UserSubmission.TYPE_REPORT_CLOSED,
            "incorrect_info": UserSubmission.TYPE_REPORT_INCORRECT,
            "address": UserSubmission.TYPE_ADDRESS_CORRECTION,
            "other": UserSubmission.TYPE_REPORT_INCORRECT,
        }
        submission = UserSubmission.objects.create(
            submission_type=mapping[self.validated_data["report_type"]],
            place=place,
            message=self.validated_data["message"],
        )
        # repeated pending reports push a place into 'reported' for admin review
        open_reports = UserSubmission.objects.filter(
            place=place, status=UserSubmission.STATUS_PENDING,
        ).count()
        if open_reports >= 3 and place.verification_status == Place.VERIFY_UNVERIFIED:
            place.verification_status = Place.VERIFY_REPORTED
            place.save(update_fields=["verification_status", "updated_at"])
        return submission
