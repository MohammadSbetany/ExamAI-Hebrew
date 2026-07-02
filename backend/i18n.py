"""
i18n.py — lightweight backend localization.

Loads locale dictionaries from backend/locales/*.json and resolves dot-notation
keys, falling back to Hebrew (the default) for missing keys/locales. A FastAPI
dependency reads the incoming Accept-Language header to pick the active locale.
"""
import json
import os
from functools import lru_cache

from fastapi import Header

# The app currently ships Hebrew only. To add another language later, add its
# `backend/locales/<lang>.json` file and include its code in SUPPORTED.
_LOCALES_DIR = os.path.join(os.path.dirname(__file__), "locales")
SUPPORTED = {"he"}
DEFAULT_LOCALE = "he"


@lru_cache(maxsize=None)
def _load(lang: str) -> dict:
    path = os.path.join(_LOCALES_DIR, f"{lang}.json")
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError):
        return {}


def _lookup(tree: dict, key: str):
    node = tree
    for part in key.split("."):
        if isinstance(node, dict) and part in node:
            node = node[part]
        else:
            return None
    return node if isinstance(node, str) else None


def translate(key: str, lang: str = DEFAULT_LOCALE) -> str:
    """Resolve a dot-notation key for `lang`, falling back to Hebrew, then the key."""
    lang = lang if lang in SUPPORTED else DEFAULT_LOCALE
    for source in (lang, DEFAULT_LOCALE):
        value = _lookup(_load(source), key)
        if value is not None:
            return value
    return key


def get_locale(accept_language: str | None = Header(default=None)) -> str:
    """
    FastAPI dependency — choose a supported locale from the Accept-Language header,
    falling back to Hebrew when the header is empty or unsupported.
    """
    if not accept_language:
        return DEFAULT_LOCALE
    primary = accept_language.split(",")[0].strip().lower().split("-")[0]
    return primary if primary in SUPPORTED else DEFAULT_LOCALE
