"""FreezeWise schemas."""

from freezewise.schemas.product import (
    CategoryInfo,
    ProductResponse,
    ProductSearchResponse,
)
from freezewise.schemas.recipe import RecipeRequest, RecipeResponse, RecipeSuggestion
from freezewise.schemas.scan import ScanProgress, ScannedProduct

__all__ = [
    "CategoryInfo",
    "ProductResponse",
    "ProductSearchResponse",
    "RecipeRequest",
    "RecipeResponse",
    "RecipeSuggestion",
    "ScanProgress",
    "ScannedProduct",
]
