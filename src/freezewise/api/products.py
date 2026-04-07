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
    locale: str = Query("en", description="Content language (en/ru/cn)"),
) -> list[ProductResponse]:
    """List cached products for given locale. Does NOT trigger AI generation."""
    return await service.list_all(q=q, category=category, locale=locale)


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

    # Minimum length to prevent junk queries (CJK chars count as full words)
    cleaned = q.strip()
    has_cjk = any(ord(c) > 0x2E80 for c in cleaned)
    min_len = 1 if has_cjk else 3
    if len(cleaned) < min_len:
        raise HTTPException(status_code=400, detail="Query too short")

    products = await service.search(cleaned, model_name=model, locale=locale)
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
    locale: str = Query("en", description="Content language (en/ru/cn)"),
) -> list[CategoryInfo]:
    """List product categories with counts for given locale."""
    return await service.list_categories(locale=locale)


@router.delete("/products/{product_id}")
async def delete_product(
    product_id: int,
    service: ProductService = Depends(get_product_service),
) -> dict:
    """Delete a cached product (for cleaning up junk/spam entries)."""
    deleted = await service.delete(product_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Product not found")
    return {"deleted": product_id}


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
