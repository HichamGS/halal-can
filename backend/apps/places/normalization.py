"""Normalization helpers – external data is normalized BEFORE it enters the
canonical database. Nothing here blindly inserts provider records."""
import re
import unicodedata


def strip_accents(value: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFKD", value) if not unicodedata.combining(c)
    )


def normalize_name(name: str) -> str:
    """Lowercase, de-accent, collapse whitespace/punctuation for matching."""
    if not name:
        return ""
    n = strip_accents(name).lower()
    n = re.sub(r"[^\w\s&]", " ", n)
    n = re.sub(r"\s+", " ", n).strip()
    # drop common legal suffixes that vary between providers
    n = re.sub(r"\b(inc|llc|ltd|lte|groupe|group)\b", "", n)
    return re.sub(r"\s+", " ", n).strip()


def normalize_phone(phone: str) -> str:
    """E.164-ish North American normalization: digits only, drop leading 1."""
    if not phone:
        return ""
    digits = re.sub(r"\D", "", phone)
    if len(digits) == 11 and digits.startswith("1"):
        digits = digits[1:]
    return digits


def normalize_postal_code(postal: str) -> str:
    if not postal:
        return ""
    p = re.sub(r"[^A-Za-z0-9]", "", postal).upper()
    if len(p) == 6:
        p = f"{p[:3]} {p[3:]}"
    return p


def normalize_url(url: str) -> str:
    if not url:
        return ""
    u = url.strip().lower()
    u = re.sub(r"^https?://", "", u)
    u = re.sub(r"^www\.", "", u)
    return u.rstrip("/")


def domain_of(url: str) -> str:
    u = normalize_url(url)
    return u.split("/")[0] if u else ""


def normalize_address(address: str) -> str:
    if not address:
        return ""
    a = strip_accents(address).lower()
    replacements = {
        r"\bst\.?\b": "street", r"\bave?\.?\b": "avenue", r"\bbld?\.?g\b": "boulevard",
        r"\brd\b": "road", r"\bdr\b": "drive", r"\bln\b": "lane", r"\bblvd\b": "boulevard",
        r"\bn\b": "north", r"\bs\b": "south", r"\be\b": "east", r"\bw\b": "west",
        r"\bsub\w*\b": "subdivision",
    }
    for pat, rep in replacements.items():
        a = re.sub(pat, rep, a)
    a = re.sub(r"[^\w\s#]", " ", a)
    return re.sub(r"\s+", " ", a).strip()
