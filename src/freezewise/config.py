"""Centralized configuration — validated at import time."""

from __future__ import annotations

import os

from pydantic import BaseModel, Field


class Settings(BaseModel):
    """Application settings loaded from environment variables."""

    openrouter_api_key: str = Field(default="")
    # Default model — gemini-2.0-flash-001: best quality/speed/cost ratio
    # $0.0003/req, 13s for product+recipe+vision, 28 items detected on test photo
    agent_model: str = "google/gemini-2.0-flash-001"
    # Vision models cascade (gemini → qwen → free fallback)
    vision_models: list[str] = Field(default_factory=lambda: [
        "google/gemini-2.0-flash-001",
        "qwen/qwen3-vl-32b-instruct",
        "qwen/qwen3.6-plus:free",
    ])
    max_image_size: int = 5 * 1024 * 1024
    db_path: str = "freezewise.db"

    @property
    def has_api_key(self) -> bool:
        return bool(self.openrouter_api_key)


settings = Settings(
    openrouter_api_key=os.getenv("OPENROUTER_API_KEY", ""),
)
