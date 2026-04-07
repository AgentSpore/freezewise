"""Test fixtures for FreezeWise."""

from __future__ import annotations

import json
import os
import tempfile
from typing import AsyncIterator
from unittest.mock import patch

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

# Set test DB path before importing app
_test_db = tempfile.mkstemp(suffix=".db")[1]
os.environ.setdefault("FREEZEWISE_DB", _test_db)

import freezewise.database as db_mod  # noqa: E402
from freezewise.main import app  # noqa: E402

# Override DB path for tests
db_mod.DB_PATH = type(db_mod.DB_PATH)(_test_db)

# Mock product data for AI generation tests
MOCK_BROCCOLI = {
    "name": "Broccoli",
    "name_ru": "\u0411\u0440\u043e\u043a\u043a\u043e\u043b\u0438",
    "name_cn": "\u897f\u5170\u82b1",
    "category": "vegetables",
    "can_freeze": True,
    "freeze_months": 12,
    "freeze_how": "Blanch 3 min, ice bath, pat dry, freeze flat",
    "thaw_how": "Cook from frozen",
    "fridge_days": 5,
    "pantry_days": 0,
    "spoilage_signs": "Yellow florets, slimy stems, sulfur smell",
    "tips": ["Store unwashed in loose bag", "Stems are edible", "Blanch before freezing"],
    "icon": "\U0001f966",
}

MOCK_CHICKEN = {
    "name": "Chicken Breast",
    "name_ru": "\u041a\u0443\u0440\u0438\u043d\u0430\u044f \u0433\u0440\u0443\u0434\u043a\u0430",
    "name_cn": "\u9e21\u80f8\u8089",
    "category": "meat",
    "can_freeze": True,
    "freeze_months": 9,
    "freeze_how": "Wrap individually, remove air, freeze",
    "thaw_how": "Fridge overnight or cold water bath",
    "fridge_days": 2,
    "pantry_days": 0,
    "spoilage_signs": "Slimy, gray color, sour smell",
    "tips": ["Use within 2 days of purchase", "Freeze in portions", "Never refreeze thawed chicken"],
    "icon": "\U0001f357",
}

MOCK_MILK = {
    "name": "Milk",
    "name_ru": "\u041c\u043e\u043b\u043e\u043a\u043e",
    "name_cn": "\u725b\u5976",
    "category": "dairy",
    "can_freeze": True,
    "freeze_months": 3,
    "freeze_how": "Pour into container leaving headroom, freeze",
    "thaw_how": "Fridge overnight, shake well",
    "fridge_days": 7,
    "pantry_days": 0,
    "spoilage_signs": "Sour smell, lumpy texture, yellow tint",
    "tips": ["Check date on carton", "Store in back of fridge", "Shake after thawing"],
    "icon": "\U0001f95b",
}

MOCK_APPLE = {
    "name": "Apple",
    "name_ru": "\u042f\u0431\u043b\u043e\u043a\u043e",
    "name_cn": "\u82f9\u679c",
    "category": "fruits",
    "can_freeze": True,
    "freeze_months": 8,
    "freeze_how": "Slice, toss with lemon juice, freeze flat on tray",
    "thaw_how": "Use frozen in smoothies/baking, thaw in fridge for eating",
    "fridge_days": 30,
    "pantry_days": 7,
    "spoilage_signs": "Soft mushy spots, wrinkled skin, brown discoloration, fermented smell",
    "tips": ["Store away from other fruits", "One bad apple spoils the bunch", "Lemon juice prevents browning"],
    "icon": "\U0001f34e",
}

# Map query -> mock response
_MOCK_MAP: dict[str, dict] = {
    "broccoli": MOCK_BROCCOLI,
    "\u0431\u0440\u043e\u043a\u043a\u043e\u043b\u0438": MOCK_BROCCOLI,
    "chicken": MOCK_CHICKEN,
    "chicken breast": MOCK_CHICKEN,
    "\u043a\u0443\u0440\u0438\u043d": MOCK_CHICKEN,
    "milk": MOCK_MILK,
    "\u043c\u043e\u043b\u043e\u043a\u043e": MOCK_MILK,
    "apple": MOCK_APPLE,
    "\u044f\u0431\u043b\u043e\u043a\u043e": MOCK_APPLE,
    "\u9e21": MOCK_CHICKEN,
}


async def _mock_generate(self, query: str, model_name: str | None = None, locale: str = "en") -> dict | None:
    """Mock AI generation — returns predefined product data.

    Note: `self` is the ProductAIService instance (patched as instance method).
    """
    q = query.lower().strip()
    for key, value in _MOCK_MAP.items():
        if key in q:
            return value.copy()
    return None


async def _seed_test_products() -> None:
    """Insert test products directly into DB for tests that need existing data."""
    async with db_mod.get_db() as db:
        for product_data in [MOCK_BROCCOLI, MOCK_CHICKEN, MOCK_MILK, MOCK_APPLE]:
            tips_json = json.dumps(product_data["tips"], ensure_ascii=False)
            await db.execute(
                """INSERT OR IGNORE INTO products
                   (name, name_ru, name_cn, category, can_freeze, freeze_months,
                    freeze_how, thaw_how, fridge_days, pantry_days, spoilage_signs,
                    tips, icon, source, locale)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'test', 'en')""",
                (
                    product_data["name"],
                    product_data["name_ru"],
                    product_data["name_cn"],
                    product_data["category"],
                    int(product_data["can_freeze"]),
                    product_data["freeze_months"],
                    product_data["freeze_how"],
                    product_data["thaw_how"],
                    product_data["fridge_days"],
                    product_data["pantry_days"],
                    product_data["spoilage_signs"],
                    tips_json,
                    product_data["icon"],
                ),
            )
        await db.commit()


@pytest_asyncio.fixture
async def client() -> AsyncIterator[AsyncClient]:
    """Async HTTP test client with fresh database and mocked AI."""
    # Reset singleton connection and clean DB
    await db_mod.close_db()
    if os.path.exists(_test_db):
        os.unlink(_test_db)

    # Init DB schema
    await db_mod.init_db()

    # Seed test products for non-AI tests
    await _seed_test_products()

    # Mock AI generation so tests don't call OpenRouter.
    # Target the class method — ProductAIService.generate is now an instance method.
    with patch(
        "freezewise.services.product_ai.ProductAIService.generate",
        _mock_generate,
    ):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            yield ac

    # Cleanup: close singleton connection
    await db_mod.close_db()
    if os.path.exists(_test_db):
        os.unlink(_test_db)

    # Cleanup
    if os.path.exists(_test_db):
        os.unlink(_test_db)
