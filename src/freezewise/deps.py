"""FastAPI dependency injection wiring.

All service instantiation goes through Depends() — routers never create
services directly.
"""

from __future__ import annotations

from fastapi import Depends

from freezewise.repositories.product_repo import ProductRepository
from freezewise.services.product_ai import ProductAIService
from freezewise.services.product_service import ProductService
from freezewise.services.recipe_service import RecipeService
from freezewise.services.scan_service import ScanService


def get_product_repo() -> ProductRepository:
    """Provide ProductRepository instance."""
    return ProductRepository()


def get_product_ai(
    repo: ProductRepository = Depends(get_product_repo),
) -> ProductAIService:
    """Provide ProductAIService with its repository dependency."""
    return ProductAIService(repo=repo)


def get_product_service(
    repo: ProductRepository = Depends(get_product_repo),
    ai: ProductAIService = Depends(get_product_ai),
) -> ProductService:
    """Provide ProductService with all dependencies."""
    return ProductService(repo=repo, ai=ai)


def get_recipe_service() -> RecipeService:
    """Provide RecipeService instance."""
    return RecipeService()


def get_scan_service(
    repo: ProductRepository = Depends(get_product_repo),
    ai: ProductAIService = Depends(get_product_ai),
) -> ScanService:
    """Provide ScanService with its dependencies."""
    return ScanService(repo=repo, ai=ai)
