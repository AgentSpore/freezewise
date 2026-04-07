"""AI recipe suggestion service — pydantic-ai Agent with PromptedOutput."""

from __future__ import annotations

import html

from loguru import logger

from freezewise.schemas.recipe import RecipeSuggestion
from freezewise.services.agents import make_model, recipe_agent


class RecipeService:
    """AI-powered recipe suggestion service.

    Uses PromptedOutput — works with all models, no raw httpx fallback needed.
    """

    async def suggest(
        self,
        product_names: list[str],
        locale: str = "en",
        model_name: str | None = None,
    ) -> list[RecipeSuggestion]:
        """Generate recipe suggestions via pydantic-ai Agent."""
        lang_map = {"en": "English", "ru": "Russian", "cn": "Chinese"}
        language = lang_map.get(locale, "English")

        prompt = (
            f"Suggest 3 simple recipes using these ingredients: {', '.join(product_names)}. "
            f"Respond in {language}."
        )

        try:
            result = await recipe_agent.run(prompt, model=make_model(model_name))
            recipes = [
                RecipeSuggestion(
                    title=html.escape(r.title, quote=False),
                    ingredients=[html.escape(i, quote=False) for i in r.ingredients],
                    steps=[html.escape(s, quote=False) for s in r.steps],
                    time_minutes=r.time_minutes,
                    uses_expiring=[
                        name for name in product_names
                        if name.lower() in (r.title + " ".join(r.ingredients)).lower()
                    ],
                )
                for r in result.output.recipes
            ]
            logger.info("Generated {} recipes via Agent", len(recipes))
            return recipes
        except Exception as exc:
            logger.error("Recipe generation failed: {}", type(exc).__name__)
            raise ValueError("Recipe generation failed") from exc
