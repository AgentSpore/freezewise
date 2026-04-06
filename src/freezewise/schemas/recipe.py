"""Recipe suggestion schemas."""

from __future__ import annotations

from pydantic import BaseModel, Field


class RecipeRequest(BaseModel):
    """Request for recipe suggestions."""

    product_ids: list[int] = Field(default_factory=list)
    product_names: list[str] = Field(default_factory=list)
    locale: str = Field(default="en", pattern=r"^(en|ru|cn)$")
    model: str | None = Field(default=None, description="LLM model override")


class RecipeSuggestion(BaseModel):
    """A single recipe suggestion."""

    title: str
    ingredients: list[str]
    steps: list[str]
    time_minutes: int
    uses_expiring: list[str]


class RecipeListResult(BaseModel):
    """Structured output from Recipe AI Agent."""

    recipes: list[RecipeSuggestion] = Field(min_length=1, max_length=5)


class RecipeResponse(BaseModel):
    """API response with recipe suggestions."""

    recipes: list[RecipeSuggestion]
    source: str = "ai"
