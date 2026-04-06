"""Photo scan schemas."""

from __future__ import annotations

from pydantic import BaseModel, Field


class ScannedProduct(BaseModel):
    """A single product detected in a photo."""

    name: str
    quantity: int = 1
    category: str = "other"
    confidence: float = Field(default=0.8, ge=0.0, le=1.0)


class VisionResult(BaseModel):
    """Structured output from Vision AI — list of identified food items."""

    items: list[ScannedProduct] = Field(default_factory=list)


class ScanProgress(BaseModel):
    """SSE progress event for photo scan."""

    stage: str  # analyzing, identified, generating, done, error
    progress: int = Field(default=0, ge=0, le=100)
    message: str = ""
    products: list[ScannedProduct] = Field(default_factory=list)
    added_ids: list[int] = Field(default_factory=list)
