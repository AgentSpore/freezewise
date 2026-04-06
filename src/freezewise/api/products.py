"""Product catalog API endpoints — AI-powered search."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from freezewise.deps import get_product_service
from freezewise.rate_limit import ai_search_limiter
from freezewise.schemas.product import (
    CategoryInfo,
    ProductResponse,
    ProductSearchResponse,
)
from freezewise.services.product_service import ProductService

router = APIRouter(prefix="/api", tags=["products"])


@router.get("/products", response_model=list[ProductResponse])
async def products_list(
    service: ProductService = Depends(get_product_service),
    q: str | None = Query(None, description="Filter cached products (name in any language)"),
    category: str | None = Query(None, description="Filter by category"),
) -> list[ProductResponse]:
    """List cached products with optional filter. Does NOT trigger AI generation."""
    return await service.list_all(q=q, category=category)


@router.get("/products/search", response_model=ProductSearchResponse)
async def products_search(
    request: Request,
    service: ProductService = Depends(get_product_service),
    q: str = Query(..., min_length=1, max_length=100, description="Search query (EN/RU/CN)"),
    model: str | None = Query(None, description="LLM model override"),
    locale: str = Query("en", description="Content language (en/ru/cn)"),
) -> ProductSearchResponse:
    """Search for a product — checks cache first, generates via AI if not found."""
    await ai_search_limiter.check(request)
    products = await service.search(q, model_name=model, locale=locale)
    source = "cache" if products and products[0].id > 0 else "ai"
    return ProductSearchResponse(products=products, source=source, query=q)


@router.get("/products/{product_id}", response_model=ProductResponse)
async def product_detail(
    product_id: int,
    service: ProductService = Depends(get_product_service),
) -> ProductResponse:
    """Get detailed product info by ID."""
    product = await service.get(product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


@router.get("/categories", response_model=list[CategoryInfo])
async def categories_list(
    service: ProductService = Depends(get_product_service),
) -> list[CategoryInfo]:
    """List all product categories with counts (from cache)."""
    return await service.list_categories()


@router.get("/models")
async def available_models() -> dict:
    """Return available free LLM models — tested and ranked by capability."""
    from freezewise.config import settings
    return {
        "default": settings.agent_model,
        "models": [
            {"id": "google/gemini-2.0-flash-001", "name": "Gemini 2.0 Flash", "context": 1_000_000, "vision": True, "tools": True, "recommended": True},
            {"id": "nvidia/nemotron-3-super-120b-a12b:free", "name": "Nemotron Super 120B", "context": 262_144, "vision": False, "tools": True, "recommended": True},
            {"id": "openai/gpt-oss-120b:free", "name": "GPT-OSS 120B", "context": 131_072, "vision": False, "tools": True, "recommended": True},
            {"id": "minimax/minimax-m2.5:free", "name": "Minimax M2.5", "context": 196_608, "vision": False, "tools": True, "recommended": False},
            {"id": "stepfun/step-3.5-flash:free", "name": "Step 3.5 Flash", "context": 256_000, "vision": False, "tools": False, "recommended": False},
            {"id": "openai/gpt-oss-20b:free", "name": "GPT-OSS 20B", "context": 131_072, "vision": False, "tools": True, "recommended": False},
            {"id": "nvidia/nemotron-nano-12b-v2-vl:free", "name": "Nemotron Nano 12B VL", "context": 128_000, "vision": True, "tools": True, "recommended": False},
            {"id": "qwen/qwen3.6-plus:free", "name": "Qwen 3.6 Plus", "context": 1_000_000, "vision": True, "tools": False, "recommended": False},
            {"id": "meta-llama/llama-3.3-70b-instruct:free", "name": "Llama 3.3 70B", "context": 65_536, "vision": False, "tools": False, "recommended": False},
            {"id": "qwen/qwen3-coder:free", "name": "Qwen 3 Coder", "context": 262_000, "vision": False, "tools": False, "recommended": False},
        ],
    }
