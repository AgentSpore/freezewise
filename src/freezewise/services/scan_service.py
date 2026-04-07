"""Photo scan service — pydantic-ai Vision Agent identifies food from photos."""

from __future__ import annotations

import json
from collections.abc import AsyncIterator

from loguru import logger
from pydantic_ai import BinaryContent

from freezewise.config import settings
from freezewise.repositories.product_repo import ProductRepository
from freezewise.schemas.scan import ScanProgress, ScannedProduct
from freezewise.services.agents import make_model, vision_agent
from freezewise.services.product_ai import ProductAIService

VISION_PROMPT = (
    "Identify ALL food items visible in this photo. "
    "Use generic English names (e.g. 'apple' not 'Granny Smith'). "
    "Merge duplicates and sum quantities (3 apples → quantity: 3). "
    "Only include food items, ignore non-food objects. "
    "Be specific: 'chicken breast' not just 'meat'."
)


class ScanService:
    """Photo scan orchestrator — pydantic-ai vision agent + product generation."""

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

        detected = await self._identify_items(image_bytes, mime_type)

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

            row = await self.repo.find_by_name(product.name, locale="en")
            if row:
                added_ids.append(row["id"])
            else:
                product_data = await self.ai.generate(product.name, locale="en")
                if product_data:
                    pid = await self.repo.save(product_data, locale="en")
                    if pid:
                        added_ids.append(pid)

        yield self._event(
            stage="done", progress=100,
            message=f"Ready! {len(added_ids)} products identified.",
            products=detected, added_ids=added_ids,
        )

    async def _identify_items(self, image_bytes: bytes, mime_type: str) -> list[ScannedProduct] | None:
        """Use pydantic-ai vision agent with model cascade fallback."""
        for model_name in settings.vision_models:
            try:
                result = await vision_agent.run(
                    [
                        VISION_PROMPT,
                        BinaryContent(data=image_bytes, media_type=mime_type),
                    ],
                    model=make_model(model_name),
                )
                items = result.output.items
                logger.info("Vision model {} identified {} items", model_name, len(items))
                return items
            except Exception as exc:
                logger.warning("Vision model {} failed: {}", model_name, type(exc).__name__)
                continue

        return None

    @staticmethod
    def _event(**kwargs: object) -> str:
        """Serialize a ScanProgress to JSON for SSE."""
        return json.dumps(ScanProgress(**kwargs).model_dump())
