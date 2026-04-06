"""Centralized configuration — validated at import time."""

from __future__ import annotations

import os

from pydantic import BaseModel, Field


class Settings(BaseModel):
    """Application settings loaded from environment variables."""

    openrouter_api_key: str = Field(default="")
    openrouter_url: str = "https://openrouter.ai/api/v1/chat/completions"
    # Default model — gemini works with Agent, raw, and Vision
    agent_model: str = "google/gemini-2.0-flash-001"
    text_model: str = "google/gemini-2.0-flash-001"
    # Models supporting tool_choice (pydantic-ai structured output)
    tool_capable_models: list[str] = Field(default_factory=lambda: [
        "google/gemini-2.0-flash-001",
        "nvidia/nemotron-3-super-120b-a12b:free",
        "openai/gpt-oss-120b:free",
        "openai/gpt-oss-20b:free",
        "minimax/minimax-m2.5:free",
        "nvidia/nemotron-nano-12b-v2-vl:free",
        "nvidia/nemotron-nano-9b-v2:free",
        "stepfun/step-3.5-flash:free",
    ])
    vision_models: list[str] = Field(default_factory=lambda: [
        "google/gemini-2.0-flash-001",
        "qwen/qwen3.6-plus:free",
        "google/gemma-3-27b-it:free",
    ])
    max_image_size: int = 5 * 1024 * 1024
    db_path: str = "freezewise.db"

    @property
    def has_api_key(self) -> bool:
        return bool(self.openrouter_api_key)


settings = Settings(
    openrouter_api_key=os.getenv("OPENROUTER_API_KEY", ""),
)
