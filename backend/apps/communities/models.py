from django.db import models

from apps.common import TimeStampedModel


class Community(TimeStampedModel):
    """A cultural/community grouping (Moroccan, Algerian, Somali, ...).

    Purely data-driven: add new communities through Django admin – no code
    change and no hard-coded enum anywhere in the application.
    """

    slug = models.SlugField(max_length=64, unique=True)
    name = models.CharField(max_length=128)
    description = models.TextField(blank=True)
    # optional parent so taxonomies can be nested later
    # (e.g. Moroccan -> Maghreb -> North African handled via M2M instead,
    #  but a hierarchy is available if ever needed)
    parent = models.ForeignKey(
        "self", null=True, blank=True, on_delete=models.SET_NULL,
        related_name="children",
    )
    is_active = models.BooleanField(default=True)
    order = models.IntegerField(default=0, help_text="Display order.")

    class Meta:
        ordering = ["order", "name"]
        indexes = [models.Index(fields=["slug"]), models.Index(fields=["is_active"])]

    def __str__(self):
        return self.name
