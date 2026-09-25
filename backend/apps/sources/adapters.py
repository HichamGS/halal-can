"""Source adapter architecture.

    SourceAdapter (base)
        +-- GooglePlacesAdapter      (official API only – NEVER scraping;
        |                             stores Place ID as external reference,
        |                             does not persist content as canonical)
        +-- OpenStreetMapAdapter     (ODbL licensed, attribution required)
        +-- OfficialWebsiteAdapter   (public business info, manual review)
        +-- BusinessSubmissionAdapter(user submissions -> moderation queue)

Each adapter: retrieve -> normalize -> identify source ids -> map fields ->
report errors -> provide timestamps.
"""
import logging

import requests

logger = logging.getLogger(__name__)


class NormalizedPlace:
    """Neutral, normalized representation produced by every adapter before
    it enters the dedup/canonicalization pipeline."""

    def __init__(self, name, phone="", website="", address="", city="",
                 province="", postal_code="", latitude=None, longitude=None,
                 categories=None, communities=None, description="",
                 external_id=None, source_url="", raw=None, attribution=""):
        self.name = name
        self.phone = phone
        self.website = website
        self.address = address
        self.city = city
        self.province = province
        self.postal_code = postal_code
        self.latitude = latitude
        self.longitude = longitude
        self.categories = categories or []
        self.communities = communities or []
        self.description = description
        self.external_id = external_id
        self.source_url = source_url
        self.raw = raw or {}
        self.attribution = attribution

    def to_dict(self):
        return {
            "name": self.name, "phone": self.phone, "website": self.website,
            "address": self.address, "city": self.city, "province": self.province,
            "postal_code": self.postal_code, "latitude": self.latitude,
            "longitude": self.longitude, "description": self.description,
        }


class SourceAdapter:
    """Base class. Subclasses must implement fetch()/normalize()."""

    adapter_id = ""

    def fetch(self, query, **kwargs):  # pragma: no cover - interface
        raise NotImplementedError

    def normalize(self, payload):  # pragma: no cover - interface
        raise NotImplementedError

    def run(self, query, **kwargs):
        try:
            payloads = self.fetch(query, **kwargs)
            return [self.normalize(p) for p in payloads]
        except Exception as exc:  # adapters report errors, never crash the pipeline
            logger.exception("adapter %s failed: %s", self.adapter_id, exc)
            return []


class GooglePlacesAdapter(SourceAdapter):
    """Official Google Places API only.

    Terms compliance:
      * No scraping of Maps/Search pages.
      * We persist only the Place ID (external identifier) + our own canonical
        data. Content is fetched live when displayed and attribution shown.
      * Do not use Redis to circumvent provider caching restrictions.
    """

    adapter_id = "google_places"
    ENDPOINT = "https://maps.googleapis.com/maps/api/place/textsearch/json"

    def __init__(self, api_key: str = ""):
        self.api_key = api_key

    def fetch(self, query, **kwargs):
        if not self.api_key:
            logger.warning("GooglePlacesAdapter: no API key configured; skipping.")
            return []
        resp = requests.get(
            self.ENDPOINT,
            params={"query": query, "key": self.api_key},
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        if data.get("status") not in ("OK", "ZERO_RESULTS"):
            logger.error("Google Places error: %s", data.get("status"))
            return []
        return data.get("results", [])

    def normalize(self, result):
        addr = result.get("formatted_address", "")
        comps = {t: a["long_name"]
                 for c in result.get("address_components", [])
                 for t, a in [(c["types"][0], c)]}
        loc = result.get("geometry", {}).get("location", {})
        return NormalizedPlace(
            name=result.get("name", ""),
            address=addr,
            city=comps.get("locality", ""),
            province=comps.get("administrative_area_level_1", ""),
            postal_code=comps.get("postal_code", ""),
            latitude=loc.get("lat"),
            longitude=loc.get("lng"),
            external_id=result.get("place_id"),  # store the PLACE ID only
            source_url=f"https://www.google.com/maps/place/?q=place_id:{result.get('place_id', '')}",
            attribution="Locations marked with G are provided by Google.",
            # NOTE: raw content intentionally NOT persisted (reference policy)
            raw={},
        )


class OpenStreetMapAdapter(SourceAdapter):
    """Overpass/Photon based lookup. ODbL – normalized data may be stored
    with attribution."""

    adapter_id = "openstreetmap"
    PHOTON = "https://photon.komoot.io/api/"

    def fetch(self, query, **kwargs):
        resp = requests.get(self.PHOTON, params={"q": query, "limit": 20}, timeout=15)
        resp.raise_for_status()
        return resp.json().get("features", [])

    def normalize(self, feature):
        p = feature.get("properties", {})
        lon, lat = (feature.get("geometry") or {}).get("coordinates", [None, None])
        tags = p.get("other_tags", {}) or {}
        return NormalizedPlace(
            name=p.get("name", ""),
            phone=(p.get("phone") or tags.get('"phone"', "")).strip(),
            website=(p.get("website") or tags.get('"website"', "")).strip(),
            address=" ".join(filter(None, [str(p.get("housenumber", "")), p.get("street", "")])),
            city=p.get("city") or p.get("town") or p.get("village") or "",
            province=p.get("state", ""),
            postal_code=p.get("postcode", ""),
            latitude=lat, longitude=lon,
            external_id=f"osm/{p.get('osm_type','way')}/{p.get('osm_id','')}",
            attribution="© OpenStreetMap contributors (ODbL)",
        )


class OfficialWebsiteAdapter(SourceAdapter):
    """Information taken from the business's own official website.
    Manual/administrated ingestion; canonical storage allowed."""

    adapter_id = "official_website"

    def fetch(self, query, **kwargs):
        # Retrieval is administratively curated in this phase; structure kept
        # so a future automated extractor can plug in without redesign.
        return [kwargs.get("payload", {})]

    def normalize(self, payload):
        return NormalizedPlace(
            name=payload.get("name", ""),
            phone=payload.get("phone", ""),
            website=payload.get("website", ""),
            address=payload.get("address", ""),
            city=payload.get("city", ""),
            province=payload.get("province", ""),
            postal_code=payload.get("postal_code", ""),
            latitude=payload.get("latitude"),
            longitude=payload.get("longitude"),
            description=payload.get("description", ""),
            external_id=payload.get("website"),
        )


class BusinessSubmissionAdapter(SourceAdapter):
    """User/owner submissions. Canonical data (we own it), but every record
    goes through the moderation pipeline first."""

    adapter_id = "business_submission"

    def fetch(self, query, **kwargs):
        return [kwargs.get("payload", {})]

    def normalize(self, payload):
        return NormalizedPlace(
            name=payload.get("name", ""),
            phone=payload.get("phone", ""),
            website=payload.get("website", ""),
            address=payload.get("address", ""),
            city=payload.get("city", ""),
            province=payload.get("province", ""),
            postal_code=payload.get("postal_code", ""),
            latitude=payload.get("latitude"),
            longitude=payload.get("longitude"),
            description=payload.get("description", ""),
            categories=payload.get("categories", []),
            communities=payload.get("communities", []),
        )


ADAPTER_REGISTRY = {
    cls.adapter_id: cls
    for cls in (GooglePlacesAdapter, OpenStreetMapAdapter,
                OfficialWebsiteAdapter, BusinessSubmissionAdapter)
}


def get_adapter(source) -> SourceAdapter:
    if source.adapter == "google_places":
        from django.conf import settings
        return GooglePlacesAdapter(api_key=settings.GOOGLE_PLACES_API_KEY)
    cls = ADAPTER_REGISTRY.get(source.adapter)
    if cls is None:
        raise ValueError(f"No adapter registered for source '{source.slug}'")
    return cls()
