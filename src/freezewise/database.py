"""Database — singleton connection with async context manager for safe access."""

from __future__ import annotations

import json
import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

import aiosqlite
from loguru import logger

from freezewise.data.foods_seed import FOODS_SEED

DB_PATH = Path("freezewise.db")

# New nullable-with-default columns added after the original schema shipped.
# Each entry: (column_name, column_definition) for ALTER TABLE on legacy DBs.
_ADDED_COLUMNS: tuple[tuple[str, str], ...] = (
    ("locale", "TEXT NOT NULL DEFAULT 'en'"),
    ("cold_safe", "TEXT NOT NULL DEFAULT 'depends'"),
    ("cold_note", "TEXT NOT NULL DEFAULT ''"),
    ("rancid_signs", "TEXT NOT NULL DEFAULT ''"),
)

SCHEMA = """
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    name_ru TEXT NOT NULL DEFAULT '',
    name_cn TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT 'other',
    can_freeze INTEGER NOT NULL DEFAULT 1,
    freeze_months INTEGER NOT NULL DEFAULT 3,
    freeze_how TEXT NOT NULL DEFAULT '',
    thaw_how TEXT NOT NULL DEFAULT '',
    fridge_days INTEGER NOT NULL DEFAULT 7,
    pantry_days INTEGER NOT NULL DEFAULT 0,
    spoilage_signs TEXT NOT NULL DEFAULT '',
    cold_safe TEXT NOT NULL DEFAULT 'depends',
    cold_note TEXT NOT NULL DEFAULT '',
    rancid_signs TEXT NOT NULL DEFAULT '',
    tips TEXT NOT NULL DEFAULT '[]',
    icon TEXT NOT NULL DEFAULT '',
    source TEXT NOT NULL DEFAULT 'ai',
    locale TEXT NOT NULL DEFAULT 'en',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_products_name_ru ON products(name_ru COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_products_locale ON products(locale);
"""

# Migration: drop old unique index, add locale column if missing, create new unique
MIGRATIONS = [
    "DROP INDEX IF EXISTS idx_products_name_unique",
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_products_name_locale_unique ON products(name COLLATE NOCASE, locale)",
]


def _dict_row_factory(cursor: aiosqlite.Cursor, row: tuple) -> dict:
    columns = [col[0] for col in cursor.description]
    return dict(zip(columns, row))


# Singleton connection
_db: aiosqlite.Connection | None = None


async def _get_connection() -> aiosqlite.Connection:
    """Get or create singleton database connection."""
    global _db
    if _db is None:
        _db = await aiosqlite.connect(str(DB_PATH))
        _db.row_factory = _dict_row_factory
        await _db.create_function("ULOWER", 1, lambda s: s.lower() if s else s)
    return _db


@asynccontextmanager
async def get_db() -> AsyncIterator[aiosqlite.Connection]:
    """Async context manager for database access.

    Uses singleton connection — no overhead per query.
    """
    db = await _get_connection()
    yield db


async def init_db() -> None:
    """Initialize database schema and run migrations."""
    db = await _get_connection()
    await db.executescript(SCHEMA)

    # Add columns to existing DBs (migration for legacy schemas)
    cursor = await db.execute("PRAGMA table_info(products)")
    cols = {row["name"] for row in await cursor.fetchall()}
    for name, definition in _ADDED_COLUMNS:
        if name not in cols:
            await db.execute(f"ALTER TABLE products ADD COLUMN {name} {definition}")
            logger.info("Migrated: added {} column", name)

    # Run index migrations
    for stmt in MIGRATIONS:
        try:
            await db.execute(stmt)
        except Exception as exc:
            logger.warning("Migration skipped ({}): {}", stmt[:50], exc)

    await db.commit()

    if os.getenv("FREEZEWISE_SKIP_SEED", "").lower() not in ("1", "true", "yes"):
        await seed_products()

    cursor = await db.execute("SELECT COUNT(*) as cnt FROM products")
    row = await cursor.fetchone()
    logger.info("Database ready — {} cached products", row["cnt"])


async def seed_products() -> int:
    """Upsert the curated food dataset (idempotent).

    Uses INSERT OR IGNORE keyed on the (name, locale) unique index, so
    repeated startups never duplicate rows. Returns the number of rows
    actually inserted on this call.
    """
    db = await _get_connection()
    inserted = 0
    for food in FOODS_SEED:
        tips_json = json.dumps(food["tips"], ensure_ascii=False)
        cursor = await db.execute(
            """INSERT OR IGNORE INTO products
               (name, name_ru, name_cn, category, can_freeze, freeze_months,
                freeze_how, thaw_how, fridge_days, pantry_days, spoilage_signs,
                cold_safe, cold_note, rancid_signs, tips, icon, source, locale)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'seed', 'en')""",
            (
                food["name"],
                food["name_ru"],
                food["name_cn"],
                food["category"],
                int(food["can_freeze"]),
                food["freeze_months"],
                food["freeze_how"],
                food["thaw_how"],
                food["fridge_days"],
                food["pantry_days"],
                food["spoilage_signs"],
                food["cold_safe"],
                food["cold_note"],
                food["rancid_signs"],
                tips_json,
                food["icon"],
            ),
        )
        if cursor.rowcount > 0:
            inserted += 1
    await db.commit()
    if inserted:
        logger.info("Seeded {} curated foods", inserted)
    return inserted


async def close_db() -> None:
    """Close database connection on shutdown."""
    global _db
    if _db:
        await _db.close()
        _db = None
