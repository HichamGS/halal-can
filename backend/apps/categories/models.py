from django.db import models

from apps.common import TimeStampedModel


class Category(TimeStampedModel):
    """A place category (Restaurant, Grocery, Mosque, ...). Database-driven."""

    slug = models.SlugField(max_length=64, unique=True)
    name = models.CharField(max_length=128)
    description = models.TextField(blank=True)
    icon = models.CharField(
        max_length=64, blank=True,
        help_text="Optional icon identifier used by clients (e.g. lucide name).",
    )
    parent = models.ForeignKey(
        "self", null=True, blank=True, on_delete=models.SET_NULL,
        related_name="children",
    )
    is_active = models.BooleanField(default=True)
    order = models.IntegerField(default=0)

    class Meta:
        ordering = ["order", "name"]
        verbose_name_plural = "categories"
        indexes = [models.Index(fields=["slug"]), models.Index(fields=["is_active"])]

    def __str__(self):
        return self.name
