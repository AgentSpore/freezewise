"""Product lookup service — business logic only, no direct DB access."""

from __future__ import annotations

from loguru import logger

from freezewise.repositories.product_repo import ProductRepository
from freezewise.schemas.constants import CATEGORY_ICONS
from freezewise.schemas.product import CategoryInfo, ProductResponse
from freezewise.services.product_ai import ProductAIService


class ProductService:
    """Business logic for product operations.

    Delegates DB access to ProductRepository,
    AI generation to ProductAIService.
    """

    def __init__(self, repo: ProductRepository, ai: ProductAIService) -> None:
        self.repo = repo
        self.ai = ai

    async def search(self, query: str, model_name: str | None = None, locale: str = "en") -> list[ProductResponse]:
        """Search products — checks DB cache first, generates via AI if not found."""
        rows = await self.ai.search_or_generate(query, model_name=model_name, locale=locale)
        logger.debug("Search '{}' returned {} results", query, len(rows))
        return [self.repo.to_response(r) for r in rows]

    async def get(self, product_id: int) -> ProductResponse | None:
        """Get a single product by ID from cache."""
        row = await self.repo.get_by_id(product_id)
        if not row:
            return None
        return self.repo.to_response(row)

    async def list_all(
        self,
        q: str | None = None,
        category: str | None = None,
    ) -> list[ProductResponse]:
        """List cached products with full storage details."""
        rows = await self.repo.get_all(q=q, category=category)
        return [self.repo.to_response(r) for r in rows]

    async def list_categories(self) -> list[CategoryInfo]:
        """List all categories with product counts."""
        rows = await self.repo.get_categories()
        return [
            CategoryInfo(
                name=r["category"],
                count=r["count"],
                icon=CATEGORY_ICONS.get(r["category"], "\U0001f37d\ufe0f"),
            )
            for r in rows
        ]
