"""AI product generation service — pydantic-ai Agent with PromptedOutput."""

from __future__ import annotations

import asyncio
import collections

from loguru import logger

from freezewise.repositories.product_repo import ProductRepository
from freezewise.services.agents import make_model, product_agent

_MAX_LOCKS = 1024
_generation_locks: collections.OrderedDict[str, asyncio.Lock] = collections.OrderedDict()


class ProductAIService:
    """AI generation for food products via pydantic-ai Agent.

    PromptedOutput works with ALL models — no raw httpx fallback needed.
    """

    def __init__(self, repo: ProductRepository) -> None:
        self.repo = repo

    async def generate(self, query: str, model_name: str | None = None, locale: str = "en") -> dict | None:
        """Generate product storage info via pydantic-ai Agent."""
        lang_map = {"en": "English", "ru": "Russian", "cn": "Chinese"}
        language = lang_map.get(locale, "English")

        try:
            result = await product_agent.run(
                f"Generate storage information for: {query}. "
                f"Write freeze_how, thaw_how, spoilage_signs, and tips in {language}.",
                model=make_model(model_name),
            )
            product = result.output.with_default_icon()
            logger.info("Generated '{}' via Agent ({})", product.name, model_name or "default")
            return product.model_dump()
        except Exception as exc:
            logger.error("Product generation failed for '{}': {}", query, type(exc).__name__)
            return None

    async def search_or_generate(self, query: str, model_name: str | None = None, locale: str = "en") -> list[dict]:
        """Search DB first (per locale), generate via AI if no results found."""
        rows = await self.repo.search(query, locale=locale, limit=20)
        if rows:
            logger.debug("Cache hit for '{}' [{}]: {} results", query, locale, len(rows))
            return rows

        # Lock per (query, locale) to prevent duplicate generation
        key = f"{locale}:{query.lower().strip()}"
        if key not in _generation_locks:
            while len(_generation_locks) >= _MAX_LOCKS:
                _generation_locks.popitem(last=False)
            _generation_locks[key] = asyncio.Lock()
        else:
            _generation_locks.move_to_end(key)

        async with _generation_locks[key]:
            rows = await self.repo.search(query, locale=locale, limit=1)
            if rows:
                return rows

            logger.info("Cache miss for '{}' [{}] — generating via AI", query, locale)
            product_data = await self.generate(query, model_name, locale=locale)
            if not product_data:
                return []

            product_id = await self.repo.save(product_data, locale=locale)
            if not product_id:
                return []

            row = await self.repo.get_by_id(product_id)
            return [row] if row else []
