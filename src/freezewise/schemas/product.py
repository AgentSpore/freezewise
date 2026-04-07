"""Product schemas — API responses and AI validation."""

from __future__ import annotations

import html

from loguru import logger
from pydantic import BaseModel, Field, field_validator

from freezewise.schemas.constants import CATEGORY_ICONS, VALID_CATEGORIES


def _sanitize(value: str) -> str:
    """XSS protection: escape HTML in LLM output."""
    return html.escape(value, quote=False)


# ── API Response Models ──


class ProductResponse(BaseModel):
    """Full product info with storage guidelines."""

    id: int
    name: str
    name_ru: str
    name_cn: str
    category: str
    can_freeze: bool
    freeze_months: int
    freeze_how: str
    thaw_how: str
    fridge_days: int
    pantry_days: int
    spoilage_signs: str
    tips: list[str]
    icon: str


class CategoryInfo(BaseModel):
    """Category with product count."""

    name: str
    count: int
    icon: str


class ProductSearchResponse(BaseModel):
    """Search response with source indicator."""

    products: list[ProductResponse]
    source: str = "cache"
    query: str


# ── AI Input Validation ──


class ProductAIInput(BaseModel):
    """Validates and sanitizes AI-generated product data.

    Used by ProductAIService to parse LLM JSON output.
    Handles XSS escaping, category normalization, integer clamping, icon defaults.
    """

    name: str
    name_ru: str
    name_cn: str
    category: str = "other"
    can_freeze: bool = False
    freeze_months: int = Field(default=0, ge=0)
    freeze_how: str = ""
    thaw_how: str = ""
    fridge_days: int = Field(default=0, ge=0)
    pantry_days: int = Field(default=0, ge=0)
    spoilage_signs: str
    tips: list[str] = Field(default_factory=list)
    icon: str = ""

    @field_validator("name", "name_ru", "name_cn", "spoilage_signs", mode="before")
    @classmethod
    def must_be_nonempty_sanitized_string(cls, v: object) -> str:
        if not v or not isinstance(v, str):
            raise ValueError("must be a non-empty string")
        return _sanitize(v)

    @field_validator("category", mode="before")
    @classmethod
    def normalize_category(cls, v: object) -> str:
        if isinstance(v, str):
            cleaned = _sanitize(v)
            return cleaned if cleaned in VALID_CATEGORIES else "other"
        return "other"

    @field_validator("freeze_months", "fridge_days", "pantry_days", mode="before")
    @classmethod
    def clamp_nonneg_int(cls, v: object) -> int:
        try:
            return max(0, int(v))
        except (ValueError, TypeError):
            return 0

    @field_validator("freeze_how", "thaw_how", mode="before")
    @classmethod
    def sanitize_optional_str(cls, v: object) -> str:
        return _sanitize(v) if isinstance(v, str) else ""

    @field_validator("tips", mode="before")
    @classmethod
    def sanitize_tips(cls, v: object) -> list[str]:
        if not isinstance(v, list):
            return []
        return [_sanitize(str(t)) for t in v if t][:5]

    @field_validator("icon", mode="before")
    @classmethod
    def validate_icon(cls, v: object) -> str:
        return v if isinstance(v, str) and 0 < len(v) <= 4 else ""

    def with_default_icon(self) -> ProductAIInput:
        """Fill missing icon from category default."""
        if not self.icon:
            return self.model_copy(update={"icon": CATEGORY_ICONS.get(self.category, "\U0001f37d\ufe0f")})
        return self


def validate_product_data(data: dict) -> dict | None:
    """Validate and normalize AI-generated product data via Pydantic model.

    Rejects non-food items (all storage times = 0) and obviously invalid content.
    """
    try:
        validated = ProductAIInput.model_validate(data).with_default_icon()

        # Reject if all storage times are 0 — not a real food product
        if validated.fridge_days == 0 and validated.pantry_days == 0 and validated.freeze_months == 0:
            logger.warning("Rejected '{}' — all storage times are 0 (not food)", validated.name)
            return None

        return validated.model_dump()
    except Exception as exc:
        logger.warning("Product validation failed: {}", exc)
        return None
