"""Fridge-related API endpoints — recipes only (fridge data lives in localStorage)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request

from freezewise.deps import get_product_service, get_recipe_service
from freezewise.rate_limit import ai_recipe_limiter
from freezewise.schemas.recipe import RecipeRequest, RecipeResponse
from freezewise.services.product_service import ProductService
from freezewise.services.recipe_service import RecipeService

router = APIRouter(prefix="/api/fridge", tags=["fridge"])


@router.post("/recipes", response_model=RecipeResponse)
async def fridge_recipes(
    http_request: Request,
    request: RecipeRequest,
    recipe_service: RecipeService = Depends(get_recipe_service),
    product_service: ProductService = Depends(get_product_service),
) -> RecipeResponse:
    """Get AI recipe suggestions from product names."""
    await ai_recipe_limiter.check(http_request)
    names: list[str] = []

    if request.product_names:
        names = [n.strip() for n in request.product_names if n.strip()]
    elif request.product_ids:
        for pid in request.product_ids:
            product = await product_service.get(pid)
            if product:
                names.append(product.name)

    if not names:
        raise HTTPException(status_code=400, detail="No products provided")

    try:
        recipes = await recipe_service.suggest(names, locale=request.locale, model_name=request.model)
    except ValueError as exc:
        raise HTTPException(status_code=503, detail="Recipe generation failed")
    return RecipeResponse(recipes=recipes, source="ai")
