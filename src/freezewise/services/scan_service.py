"""Photo scan service — Vision AI identifies food items from photos."""

from __future__ import annotations

import base64
import json
import re
from collections.abc import AsyncIterator

import httpx
from loguru import logger

from freezewise.config import settings
from freezewise.repositories.product_repo import ProductRepository
from freezewise.schemas.scan import ScanProgress, ScannedProduct
from freezewise.services.product_ai import ProductAIService

VISION_PROMPT = """You are a food identification system. Analyze this photo and identify ALL food items visible.

Return ONLY valid JSON, no markdown, no explanation:
{"items": [{"name": "english food name", "quantity": 1, "category": "vegetable"}]}

Categories: vegetable, fruit, dairy, meat, seafood, bread, beverage, condiment, prepared, frozen, grains, snacks, other.
Rules:
- Use generic English names (e.g. "apple" not "Granny Smith")
- Merge duplicates, sum quantities (3 apples -> quantity: 3)
- If no food items found, return {"items": []}
- Only include food items, ignore non-food objects
- Be specific: "chicken breast" not just "meat"
"""


class ScanService:
    """Photo scan orchestrator — vision AI + product generation.

    Note: Vision uses raw httpx because pydantic-ai Agent doesn't support
    multipart image content in run() — this is a known limitation.
    """

    def __init__(self, repo: ProductRepository, ai: ProductAIService) -> None:
        self.repo = repo
        self.ai = ai

    async def scan_photo(
        self,
        image_bytes: bytes,
        mime_type: str,
    ) -> AsyncIterator[str]:
        """Process a food photo -> identify items -> generate storage info -> yield SSE events."""
        yield self._event(stage="analyzing", progress=10, message="Analyzing photo...")

        image_b64 = base64.b64encode(image_bytes).decode("ascii")
        detected = await self._identify_items(image_b64, mime_type)

        if detected is None:
            yield self._event(stage="error", progress=0, message="Could not analyze photo. Try a clearer image.")
            return

        if not detected:
            yield self._event(stage="done", progress=100, message="No food items detected.", products=[])
            return

        yield self._event(stage="identified", progress=40, message=f"Found {len(detected)} items", products=detected)

        added_ids: list[int] = []
        for i, product in enumerate(detected):
            progress = 40 + int(50 * (i + 1) / len(detected))
            yield self._event(stage="generating", progress=progress, message=f"Getting storage info ({i + 1}/{len(detected)})...")

            row = await self.repo.find_by_name(product.name)
            if row:
                added_ids.append(row["id"])
            else:
                product_data = await self.ai.generate(product.name)
                if product_data:
                    pid = await self.repo.save(product_data)
                    if pid:
                        added_ids.append(pid)

        yield self._event(
            stage="done", progress=100,
            message=f"Ready! {len(added_ids)} products identified.",
            products=detected, added_ids=added_ids,
        )

    async def _identify_items(self, image_b64: str, mime_type: str) -> list[ScannedProduct] | None:
        """Call vision models in cascade via raw httpx (Agent doesn't support image content)."""
        messages = [{
            "role": "user",
            "content": [
                {"type": "text", "text": VISION_PROMPT},
                {"type": "image_url", "image_url": {"url": f"data:{mime_type};base64,{image_b64}"}},
            ],
        }]

        for model in settings.vision_models:
            try:
                async with httpx.AsyncClient(timeout=90.0) as client:
                    resp = await client.post(
                        "https://openrouter.ai/api/v1/chat/completions",
                        headers={
                            "Authorization": f"Bearer {settings.openrouter_api_key}",
                            "Content-Type": "application/json",
                        },
                        json={
                            "model": model,
                            "messages": messages,
                            "temperature": 0.2,
                            "max_tokens": 1000,
                        },
                    )
                    resp.raise_for_status()
                    data = resp.json()
                    content = data["choices"][0]["message"].get("content")
                    if not content:
                        logger.warning("Empty content from vision model {}", model)
                        continue

                    content = re.sub(r"```json\s*", "", content)
                    content = re.sub(r"```\s*", "", content).strip()
                    match = re.search(r"\{[\s\S]*\}", content)
                    if not match:
                        logger.warning("No JSON in vision response from {}", model)
                        continue

                    result = json.loads(match.group())
                    items = result.get("items", [])
                    logger.info("Vision model {} identified {} items", model, len(items))
                    return self._parse_items(items)

            except httpx.HTTPStatusError as exc:
                logger.warning("Vision HTTP error ({}): {}", model, exc.response.status_code)
            except (httpx.HTTPError, json.JSONDecodeError, KeyError, IndexError) as exc:
                logger.warning("Vision model {} failed: {}", model, type(exc).__name__)

        return None

    @staticmethod
    def _parse_items(raw_items: list) -> list[ScannedProduct]:
        """Parse raw vision output into ScannedProduct list."""
        detected: list[ScannedProduct] = []
        for item in raw_items:
            if not isinstance(item, dict) or not item.get("name"):
                continue
            detected.append(ScannedProduct(
                name=str(item["name"]),
                quantity=max(1, int(item.get("quantity", 1))),
                category=str(item.get("category", "other")),
                confidence=min(1.0, max(0.0, float(item.get("confidence", 0.8)))),
            ))
        return detected

    @staticmethod
    def _event(**kwargs: object) -> str:
        """Serialize a ScanProgress to JSON for SSE."""
        return json.dumps(ScanProgress(**kwargs).model_dump())
