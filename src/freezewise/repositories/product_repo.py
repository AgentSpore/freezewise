"""Database access for products table — all SQL queries live here."""

from __future__ import annotations

import json

from loguru import logger

from freezewise.database import get_db
from freezewise.schemas.product import ProductResponse


class ProductRepository:
    """All database operations for the products table.

    Products are cached per locale (en/ru/cn) — same product name with
    different locale = different rows with localized content.
    """

    async def search(self, query: str, locale: str = "en", limit: int = 20) -> list[dict]:
        """Search products by name in any language, filtered by locale."""
        pattern = f"%{self._escape_like(query.lower())}%"
        async with get_db() as db:
            cursor = await db.execute(
                """SELECT * FROM products
                   WHERE locale = ?
                     AND (ULOWER(name) LIKE ? ESCAPE '\\'
                          OR ULOWER(name_ru) LIKE ? ESCAPE '\\'
                          OR ULOWER(name_cn) LIKE ? ESCAPE '\\')
                   ORDER BY category, name
                   LIMIT ?""",
                (locale, pattern, pattern, pattern, limit),
            )
            return await cursor.fetchall()

    async def get_by_id(self, product_id: int) -> dict | None:
        """Get product by ID."""
        async with get_db() as db:
            cursor = await db.execute(
                "SELECT * FROM products WHERE id = ?", (product_id,),
            )
            return await cursor.fetchone()

    async def get_all(
        self,
        q: str | None = None,
        category: str | None = None,
        locale: str = "en",
    ) -> list[dict]:
        """List all products in given locale, optionally filtered."""
        async with get_db() as db:
            if q:
                pattern = f"%{self._escape_like(q.lower())}%"
                cursor = await db.execute(
                    """SELECT * FROM products
                       WHERE locale = ?
                         AND (ULOWER(name) LIKE ? ESCAPE '\\'
                              OR ULOWER(name_ru) LIKE ? ESCAPE '\\'
                              OR ULOWER(name_cn) LIKE ? ESCAPE '\\')
                       ORDER BY category, name""",
                    (locale, pattern, pattern, pattern),
                )
            elif category:
                cursor = await db.execute(
                    "SELECT * FROM products WHERE locale = ? AND category = ? ORDER BY name",
                    (locale, category),
                )
            else:
                cursor = await db.execute(
                    "SELECT * FROM products WHERE locale = ? ORDER BY category, name",
                    (locale,),
                )
            return await cursor.fetchall()

    async def get_categories(self, locale: str = "en") -> list[dict]:
        """Get category names with product counts for given locale."""
        async with get_db() as db:
            cursor = await db.execute(
                """SELECT category, COUNT(*) as count
                   FROM products
                   WHERE locale = ?
                   GROUP BY category
                   ORDER BY count DESC""",
                (locale,),
            )
            return await cursor.fetchall()

    async def save(self, product_data: dict, locale: str = "en") -> int:
        """Save product to cache. Returns product ID.

        Uses INSERT OR IGNORE — if (name, locale) already exists, returns its ID.
        """
        async with get_db() as db:
            tips_json = json.dumps(product_data["tips"], ensure_ascii=False)
            cursor = await db.execute(
                """INSERT OR IGNORE INTO products
                   (name, name_ru, name_cn, category, can_freeze, freeze_months,
                    freeze_how, thaw_how, fridge_days, pantry_days, spoilage_signs,
                    tips, icon, source, locale)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ai', ?)""",
                (
                    product_data["name"],
                    product_data["name_ru"],
                    product_data["name_cn"],
                    product_data["category"],
                    int(product_data["can_freeze"]),
                    product_data["freeze_months"],
                    product_data["freeze_how"],
                    product_data["thaw_how"],
                    product_data["fridge_days"],
                    product_data["pantry_days"],
                    product_data["spoilage_signs"],
                    tips_json,
                    product_data["icon"],
                    locale,
                ),
            )
            await db.commit()

            if cursor.lastrowid and cursor.lastrowid > 0:
                logger.info("Cached '{}' [{}] with id={}", product_data["name"], locale, cursor.lastrowid)
                return cursor.lastrowid

            cursor = await db.execute(
                "SELECT id FROM products WHERE name = ? COLLATE NOCASE AND locale = ?",
                (product_data["name"], locale),
            )
            row = await cursor.fetchone()
            return row["id"] if row else 0

    async def find_by_name(self, name: str, locale: str = "en") -> dict | None:
        """Find product by name in given locale."""
        pattern = f"%{self._escape_like(name.lower())}%"
        async with get_db() as db:
            cursor = await db.execute(
                """SELECT * FROM products
                   WHERE locale = ? AND ULOWER(name) LIKE ? ESCAPE '\\'
                   LIMIT 1""",
                (locale, pattern),
            )
            return await cursor.fetchone()

    async def delete(self, product_id: int) -> bool:
        """Delete a product from cache."""
        async with get_db() as db:
            cursor = await db.execute("DELETE FROM products WHERE id = ?", (product_id,))
            await db.commit()
            return cursor.rowcount > 0

    @staticmethod
    def to_response(row: dict) -> ProductResponse:
        """Convert a database row to ProductResponse."""
        tips_raw = row.get("tips", "[]")
        try:
            tips = json.loads(tips_raw) if isinstance(tips_raw, str) else tips_raw
        except (json.JSONDecodeError, TypeError):
            tips = []

        return ProductResponse(
            id=row["id"],
            name=row["name"],
            name_ru=row["name_ru"],
            name_cn=row["name_cn"],
            category=row["category"],
            can_freeze=bool(row["can_freeze"]),
            freeze_months=row["freeze_months"],
            freeze_how=row["freeze_how"],
            thaw_how=row["thaw_how"],
            fridge_days=row["fridge_days"],
            pantry_days=row["pantry_days"],
            spoilage_signs=row["spoilage_signs"],
            tips=tips,
            icon=row["icon"],
        )

    @staticmethod
    def _escape_like(query: str) -> str:
        """Escape LIKE wildcards to prevent wildcard injection."""
        return query.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
