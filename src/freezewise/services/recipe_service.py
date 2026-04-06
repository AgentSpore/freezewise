"""AI recipe suggestion service — raw httpx (Agent can't do nested list[Object] via OpenRouter)."""

from __future__ import annotations

import html
import json
import re

import httpx
from loguru import logger

from freezewise.config import settings
from freezewise.schemas.recipe import RecipeSuggestion


class RecipeService:
    """AI-powered recipe suggestions via raw OpenRouter calls.

    Note: pydantic-ai Agent fails with nested list[Object] output via OpenRouter
    (flat models work, but list[RecipeItem] doesn't). Using raw httpx is reliable.
    """

    async def suggest(
        self,
        product_names: list[str],
        locale: str = "en",
        model_name: str | None = None,
    ) -> list[RecipeSuggestion]:
        """Generate 3 recipe suggestions from product names."""
        lang_map = {"en": "English", "ru": "Russian", "cn": "Chinese"}
        language = lang_map.get(locale, "English")
        model = model_name or settings.text_model

        prompt = (
            f"Suggest 3 simple recipes using: {', '.join(product_names)}.\n"
            f"For each: title, ingredients (list), steps (list), time_minutes (int).\n"
            f"Respond in {language}.\n"
            f"Return ONLY a JSON array. No markdown."
        )

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    "https://openrouter.ai/api/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {settings.openrouter_api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": model,
                        "messages": [
                            {"role": "system", "content": "You are a chef AI. Return only valid JSON arrays."},
                            {"role": "user", "content": prompt},
                        ],
                        "temperature": 0.7,
                        "max_tokens": 2000,
                    },
                )
                resp.raise_for_status()
                content = resp.json()["choices"][0]["message"].get("content", "")

                content = re.sub(r"```json\s*", "", content)
                content = re.sub(r"```\s*", "", content).strip()
                match = re.search(r"\[[\s\S]*\]", content)
                if not match:
                    raise ValueError("No JSON array in response")

                raw = json.loads(match.group())
                recipes = self._parse(raw, product_names)
                if recipes:
                    logger.info("Generated {} recipes via {} ({})", len(recipes), model, language)
                    return recipes

                raise ValueError("Parsed 0 recipes")

        except Exception as exc:
            logger.error("Recipe generation failed ({}): {}", model, type(exc).__name__)
            raise ValueError("Recipe generation failed") from exc

    @staticmethod
    def _parse(raw: list, product_names: list[str]) -> list[RecipeSuggestion]:
        """Parse raw JSON array into RecipeSuggestion list with XSS protection."""
        recipes: list[RecipeSuggestion] = []
        for item in raw:
            if not isinstance(item, dict):
                continue
            try:
                title_lower = (
                    item.get("title", "") + " " + " ".join(item.get("ingredients", []))
                ).lower()
                recipes.append(RecipeSuggestion(
                    title=html.escape(str(item.get("title", "Recipe")), quote=False),
                    ingredients=[html.escape(str(i), quote=False) for i in item.get("ingredients", []) if i],
                    steps=[html.escape(str(s), quote=False) for s in item.get("steps", []) if s],
                    time_minutes=int(item.get("time_minutes", item.get("time", 20))),
                    uses_expiring=[n for n in product_names if n.lower() in title_lower],
                ))
            except (ValueError, TypeError) as exc:
                logger.debug("Skipping malformed recipe: {}", exc)
        return recipes
