"""pydantic-ai agents for FreezeWise — PromptedOutput for universal model support.

Uses PromptedOutput instead of default Tool mode — works with ALL models
including free ones that don't support tool_choice (qwen, llama, gemma, etc.).
"""

from __future__ import annotations

from pydantic_ai import Agent
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.output import PromptedOutput
from pydantic_ai.providers.openai import OpenAIProvider

from freezewise.config import settings
from freezewise.schemas.product import ProductAIInput
from freezewise.schemas.recipe import RecipeListResult
from freezewise.schemas.scan import VisionResult

# Shared OpenRouter provider
provider = OpenAIProvider(
    base_url="https://openrouter.ai/api/v1",
    api_key=settings.openrouter_api_key,
)


def make_model(model_name: str | None = None) -> OpenAIChatModel:
    """Create OpenRouter model for pydantic-ai."""
    return OpenAIChatModel(model_name or settings.agent_model, provider=provider)


# ── Product Generation Agent ──

product_agent = Agent(
    model=make_model(),
    system_prompt=(
        "You are a food storage expert. "
        "Given a food product name (in any language), generate comprehensive storage information. "
        "Translate the product name accurately into English, Russian (Cyrillic), and Simplified Chinese. "
        "All fields must be filled with realistic, practical data. "
        "Tips must be specific and actionable (3-5 tips). "
        "Spoilage signs must be detailed enough to be useful. "
        "Icon must be a single emoji representing the food."
    ),
    output_type=PromptedOutput(ProductAIInput),
    retries=2,
)


# ── Recipe Agent (now works with all models via PromptedOutput) ──

recipe_agent = Agent(
    model=make_model(),
    system_prompt="You are a chef AI. Suggest simple, practical recipes using the given ingredients.",
    output_type=PromptedOutput(RecipeListResult),
    retries=2,
)


# ── Vision Agent ──

vision_agent = Agent(
    model=make_model(),
    system_prompt=(
        "You are a food identification system. "
        "Analyze the provided photo and identify ALL food items visible. "
        "Use generic English names. Merge duplicates and sum quantities. "
        "Only include food items, ignore non-food objects."
    ),
    output_type=PromptedOutput(VisionResult),
    retries=1,
)
