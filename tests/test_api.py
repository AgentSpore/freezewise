"""End-to-end API tests for FreezeWise — stateless server, AI-powered products."""

from __future__ import annotations

import pytest
from httpx import AsyncClient

import freezewise.database as db_mod


# -- Health -------------------------------------------------------------------


@pytest.mark.asyncio
async def test_health(client: AsyncClient) -> None:
    resp = await client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert data["service"] == "freezewise"


# -- Products (cached) -------------------------------------------------------


@pytest.mark.asyncio
async def test_products_list(client: AsyncClient) -> None:
    """List cached products (seeded by conftest)."""
    resp = await client.get("/api/products")
    assert resp.status_code == 200
    products = resp.json()
    assert len(products) == 4
    p = products[0]
    assert "id" in p
    assert "name" in p
    assert "name_ru" in p
    assert "category" in p
    assert "icon" in p


@pytest.mark.asyncio
async def test_products_list_by_category(client: AsyncClient) -> None:
    resp = await client.get("/api/products", params={"category": "meat"})
    assert resp.status_code == 200
    products = resp.json()
    assert len(products) >= 1
    assert all(p["category"] == "meat" for p in products)


@pytest.mark.asyncio
async def test_product_detail(client: AsyncClient) -> None:
    resp = await client.get("/api/products/1")
    assert resp.status_code == 200
    product = resp.json()
    assert product["id"] == 1
    assert product["name"]
    assert product["name_ru"]
    assert isinstance(product["tips"], list)
    assert isinstance(product["can_freeze"], bool)


@pytest.mark.asyncio
async def test_product_not_found(client: AsyncClient) -> None:
    resp = await client.get("/api/products/9999")
    assert resp.status_code == 404


# -- Search (AI-powered) -----------------------------------------------------


@pytest.mark.asyncio
async def test_search_cached_english(client: AsyncClient) -> None:
    resp = await client.get("/api/products/search", params={"q": "broccoli"})
    assert resp.status_code == 200
    data = resp.json()
    assert "products" in data
    assert len(data["products"]) >= 1
    assert data["products"][0]["name"] == "Broccoli"


@pytest.mark.asyncio
async def test_search_cached_russian(client: AsyncClient) -> None:
    resp = await client.get("/api/products/search", params={"q": "\u041c\u043e\u043b\u043e\u043a\u043e"})
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["products"]) >= 1


@pytest.mark.asyncio
async def test_search_cached_chinese(client: AsyncClient) -> None:
    resp = await client.get("/api/products/search", params={"q": "\u9e21"})
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["products"]) >= 1


@pytest.mark.asyncio
async def test_search_no_results(client: AsyncClient) -> None:
    resp = await client.get("/api/products/search", params={"q": "xyznonexistent"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["products"] == []


@pytest.mark.asyncio
async def test_search_response_structure(client: AsyncClient) -> None:
    resp = await client.get("/api/products/search", params={"q": "chicken"})
    assert resp.status_code == 200
    data = resp.json()
    assert set(data.keys()) == {"products", "source", "query"}


# -- Categories ---------------------------------------------------------------


@pytest.mark.asyncio
async def test_categories(client: AsyncClient) -> None:
    resp = await client.get("/api/categories")
    assert resp.status_code == 200
    cats = resp.json()
    assert len(cats) >= 3
    for c in cats:
        assert c["count"] > 0
        assert c["icon"]


# -- Recipes (AI, with product_names) ----------------------------------------


@pytest.mark.asyncio
async def test_recipes_with_names(client: AsyncClient) -> None:
    resp = await client.post(
        "/api/fridge/recipes",
        json={"product_names": ["Broccoli", "Chicken Breast", "Milk"], "locale": "en"},
    )
    # May return 200 (AI available) or 503 (AI unavailable in test env)
    assert resp.status_code in (200, 503)
    if resp.status_code == 200:
        data = resp.json()
        assert "recipes" in data
        assert len(data["recipes"]) >= 1
        assert data["source"] == "ai"


@pytest.mark.asyncio
async def test_recipes_with_product_ids(client: AsyncClient) -> None:
    resp = await client.post(
        "/api/fridge/recipes",
        json={"product_ids": [1, 2, 3], "locale": "en"},
    )
    assert resp.status_code in (200, 503)
    if resp.status_code == 200:
        data = resp.json()
        assert "recipes" in data
        assert len(data["recipes"]) >= 1


@pytest.mark.asyncio
async def test_recipes_empty(client: AsyncClient) -> None:
    resp = await client.post(
        "/api/fridge/recipes",
        json={"locale": "en"},
    )
    assert resp.status_code == 400


# -- Data Quality -------------------------------------------------------------


@pytest.mark.asyncio
async def test_all_products_have_required_fields(client: AsyncClient) -> None:
    resp = await client.get("/api/products")
    products = resp.json()
    assert len(products) >= 4
    for p in products:
        assert p["name"]
        assert p["name_ru"]
        assert p["name_cn"]
        assert p["category"]
        assert p["icon"]


@pytest.mark.asyncio
async def test_product_detail_has_tips(client: AsyncClient) -> None:
    resp = await client.get("/api/products/1")
    p = resp.json()
    assert isinstance(p["tips"], list)
    assert len(p["tips"]) >= 1
    assert p["spoilage_signs"]


# -- Cold-safe / spoilage fields ----------------------------------------------


@pytest.mark.asyncio
async def test_product_has_cold_fields(client: AsyncClient) -> None:
    """Every product exposes the new cold-safe / rancid fields."""
    resp = await client.get("/api/products/1")
    p = resp.json()
    assert p["cold_safe"] in ("yes", "no", "depends")
    assert "cold_note" in p
    assert "rancid_signs" in p


# -- Curated seed: search works WITHOUT the AI --------------------------------


@pytest.mark.asyncio
async def test_seed_search_chicken(seeded_client: AsyncClient) -> None:
    """A long-tail food resolves from the curated seed, not the AI."""
    resp = await seeded_client.get("/api/products/search", params={"q": "chicken"})
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["products"]) >= 1
    assert data["source"] == "cache"
    p = data["products"][0]
    assert p["cold_safe"] in ("yes", "no", "depends")
    assert p["spoilage_signs"]


@pytest.mark.asyncio
async def test_seed_search_walnuts_has_rancid(seeded_client: AsyncClient) -> None:
    """Walnuts come from the seed and carry rancidity guidance for fats/nuts."""
    resp = await seeded_client.get("/api/products/search", params={"q": "walnuts"})
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["products"]) >= 1
    walnut = next((p for p in data["products"] if p["name"] == "Walnuts"), None)
    assert walnut is not None
    assert walnut["rancid_signs"]
    assert walnut["cold_safe"] == "yes"


@pytest.mark.asyncio
async def test_seed_search_olive_oil(seeded_client: AsyncClient) -> None:
    resp = await seeded_client.get("/api/products/search", params={"q": "olive oil"})
    assert resp.status_code == 200
    assert len(resp.json()["products"]) >= 1


@pytest.mark.asyncio
async def test_seed_search_russian(seeded_client: AsyncClient) -> None:
    """Russian query against the curated seed (Молоко = Milk)."""
    resp = await seeded_client.get("/api/products/search", params={"q": "Молоко"})
    assert resp.status_code == 200
    assert len(resp.json()["products"]) >= 1


@pytest.mark.asyncio
async def test_seed_is_idempotent(seeded_client: AsyncClient) -> None:
    """Re-running the seed inserts nothing the second time."""
    again = await db_mod.seed_products()
    assert again == 0


@pytest.mark.asyncio
async def test_seed_populated_many_products(seeded_client: AsyncClient) -> None:
    """The curated seed loads the full dataset (long tail of common foods)."""
    resp = await seeded_client.get("/api/products")
    assert resp.status_code == 200
    assert len(resp.json()) >= 70
