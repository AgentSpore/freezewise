"""Shared constants for schemas and services."""

from __future__ import annotations

CATEGORY_ICONS: dict[str, str] = {
    "vegetables": "\U0001f966",
    "fruits": "\U0001f34e",
    "meat": "\U0001f969",
    "seafood": "\U0001f990",
    "dairy": "\U0001f9c0",
    "bread": "\U0001f35e",
    "prepared": "\U0001f372",
    "frozen": "\U0001f9ca",
    "grains": "\U0001f33e",
    "herbs": "\U0001f33f",
    "beverages": "\U0001f964",
    "condiments": "\U0001fad9",
    "snacks": "\U0001f36a",
    "other": "\U0001f37d\ufe0f",
}

VALID_CATEGORIES = frozenset(CATEGORY_ICONS)
