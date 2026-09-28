"""Shared abstract base for lookup (taxonomy) models.

Communities, categories and sources are *database records*, never hard-coded
enum values in application logic, so new communities (Somali, Turkish, South
Asian, ...) can be added through the admin without a code change.
"""
from django.db import models


class TimeStampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True
