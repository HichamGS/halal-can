from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver

from apps.categories.models import Category
from apps.communities.models import Community
from apps.places.cache_utils import invalidate_prefixes
from apps.places.models import Place


@receiver([post_save, post_delete], sender=Place)
def invalidate_places_cache(sender, instance, **kwargs):
    # canonical data changed -> drop cached list/detail responses
    invalidate_prefixes("places_list", "places_detail", "cities", "provinces")


@receiver([post_save, post_delete], sender=Category)
@receiver([post_save, post_delete], sender=Community)
def invalidate_taxonomy_cache(sender, instance, **kwargs):
    invalidate_prefixes("communities", "categories")
