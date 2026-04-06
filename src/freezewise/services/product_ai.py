"""AI product generation service — pydantic-ai Agent + raw fallback."""

from __future__ import annotations

import asyncio
import collections
import json
import re

import httpx
from loguru import logger

from freezewise.config import settings
from freezewise.repositories.product_repo import ProductRepository
from freezewise.schemas.product import ProductAIInput, validate_product_data
from freezewise.services.agents import is_tool_capable, make_model, product_agent

_MAX_LOCKS = 1024
_generation_locks: collections.OrderedDict[str, asyncio.Lock] = collections.OrderedDict()

GENERATION_PROMPT = """You are a food storage expert. Given a food product name (in any language), generate comprehensive storage information.

IMPORTANT: Respond ONLY with a valid JSON object. No markdown, no explanation, no code blocks.
Write freeze_how, thaw_how, spoilage_signs, and tips in {language}.

The JSON must have exactly these fields:
{{
  "name": "English name",
  "name_ru": "Russian name (Cyrillic)",
  "name_cn": "Chinese name (Simplified Chinese characters)",
  "category": "one of: vegetables, fruits, meat, seafood, dairy, bread, prepared, frozen, grains, herbs, beverages, condiments, snacks, other",
  "can_freeze": true or false,
  "freeze_months": integer (0 if cannot freeze),
  "freeze_how": "Step-by-step freezing instructions in {language}. Empty string if cannot freeze.",
  "thaw_how": "Best thawing method in {language}. Empty string if cannot freeze.",
  "fridge_days": integer (typical days in refrigerator, 0 if not stored in fridge),
  "pantry_days": integer (days at room temperature, 0 if must be refrigerated),
  "spoilage_signs": "Visual/smell/texture signs that the product has gone bad, in {language}",
  "tips": ["3-5 practical storage tips in {language} as an array of strings"],
  "icon": "single emoji that best represents this food"
}}

Product to analyze: {query}"""

LANG_MAP = {"en": "English", "ru": "Russian", "cn": "Chinese"}


class ProductAIService:
    """AI generation for food products — Agent or raw fallback based on model capability."""

    def __init__(self, repo: ProductRepository) -> None:
        self.repo = repo

    async def generate(self, query: str, model_name: str | None = None, locale: str = "en") -> dict | None:
        """Generate product storage info. Uses pydantic-ai Agent if model supports tools,
        otherwise falls back to raw httpx + JSON extraction."""
        model = model_name or settings.agent_model
        language = LANG_MAP.get(locale, "English")

        if is_tool_capable(model):
            return await self._generate_via_agent(query, model, language)
        return await self._generate_via_raw(query, model, language)

    async def _generate_via_agent(self, query: str, model_name: str, language: str = "English") -> dict | None:
        """Structured output via pydantic-ai Agent."""
        try:
            result = await product_agent.run(
                f"Generate storage information for: {query}. Write freeze_how, thaw_how, spoilage_signs, and tips in {language}.",
                model=make_model(model_name),
            )
            product = result.output.with_default_icon()
            logger.info("Generated '{}' via Agent ({})", product.name, model_name)
            return product.model_dump()
        except Exception as exc:
            logger.warning("Agent failed for '{}' ({}): {}", query, model_name, type(exc).__name__)
            return await self._generate_via_raw(query, model_name, language)

    async def _generate_via_raw(self, query: str, model_name: str, language: str = "English") -> dict | None:
        """Raw httpx call + JSON extraction for models without tool_choice."""
        prompt = GENERATION_PROMPT.format(query=query, language=language)
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    "https://openrouter.ai/api/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {settings.openrouter_api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": model_name,
                        "messages": [
                            {"role": "system", "content": "You are a food storage expert. Return only valid JSON."},
                            {"role": "user", "content": prompt},
                        ],
                        "temperature": 0.3,
                        "max_tokens": 1500,
                    },
                )
                resp.raise_for_status()
                content = resp.json()["choices"][0]["message"].get("content", "")
                content = re.sub(r"```json\s*", "", content)
                content = re.sub(r"```\s*", "", content).strip()
                match = re.search(r"\{[\s\S]*\}", content)
                if not match:
                    return None
                data = json.loads(match.group())
                validated = validate_product_data(data)
                if validated:
                    logger.info("Generated '{}' via raw ({})", validated["name"], model_name)
                return validated
        except Exception as exc:
            logger.error("Raw generation failed for '{}' ({}): {}", query, model_name, type(exc).__name__)
            return None

    async def search_or_generate(self, query: str, model_name: str | None = None, locale: str = "en") -> list[dict]:
        """Search DB first, generate via AI if no results found."""
        rows = await self.repo.search(query, limit=20)
        if rows:
            logger.debug("Cache hit for '{}': {} results", query, len(rows))
            return rows

        key = query.lower().strip()
        if key not in _generation_locks:
            while len(_generation_locks) >= _MAX_LOCKS:
                _generation_locks.popitem(last=False)
            _generation_locks[key] = asyncio.Lock()
        else:
            _generation_locks.move_to_end(key)

        async with _generation_locks[key]:
            rows = await self.repo.search(query, limit=1)
            if rows:
                return rows

            logger.info("Cache miss for '{}' — generating via AI", query)
            product_data = await self.generate(query, model_name, locale=locale)
            if not product_data:
                return []

            product_id = await self.repo.save(product_data)
            if not product_id:
                return []

            row = await self.repo.get_by_id(product_id)
            return [row] if row else []
