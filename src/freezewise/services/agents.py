"""pydantic-ai agents for FreezeWise — structured output, retries, type safety.

Agents use tool_choice for structured output. Only models that support tools
can be used with Agent.run(). For other models, services fall back to raw httpx.
"""

from __future__ import annotations

from pydantic_ai import Agent
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider

from freezewise.config import settings
from freezewise.schemas.product import ProductAIInput
from freezewise.schemas.scan import VisionResult

# Shared OpenRouter provider
provider = OpenAIProvider(
    base_url="https://openrouter.ai/api/v1",
    api_key=settings.openrouter_api_key,
)


def make_model(model_name: str | None = None) -> OpenAIChatModel:
    """Create OpenRouter model for pydantic-ai."""
    return OpenAIChatModel(model_name or settings.agent_model, provider=provider)


def is_tool_capable(model_name: str) -> bool:
    """Check if a model supports tool_choice (required for pydantic-ai Agent)."""
    return model_name in settings.tool_capable_models


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
    output_type=ProductAIInput,
    retries=2,
)


# NOTE: Recipe Agent removed — OpenRouter can't handle nested list[Object] via tools.
# Recipes use raw httpx in RecipeService instead.


# ── Vision Agent ──

vision_agent = Agent(
    model=make_model(),
    system_prompt=(
        "You are a food identification system. "
        "Analyze the provided photo and identify ALL food items visible. "
        "Use generic English names. Merge duplicates and sum quantities. "
        "Only include food items, ignore non-food objects."
    ),
    output_type=VisionResult,
    retries=1,
)
