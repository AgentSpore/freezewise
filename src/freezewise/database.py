"""Database — singleton connection with async context manager for safe access."""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

import aiosqlite
from loguru import logger

DB_PATH = Path("freezewise.db")

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
""";

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

    # Add locale column to existing DBs (migration for legacy schemas)
    cursor = await db.execute("PRAGMA table_info(products)")
    cols = {row["name"] for row in await cursor.fetchall()}
    if "locale" not in cols:
        await db.execute("ALTER TABLE products ADD COLUMN locale TEXT NOT NULL DEFAULT 'en'")
        logger.info("Migrated: added locale column")

    # Run index migrations
    for stmt in MIGRATIONS:
        try:
            await db.execute(stmt)
        except Exception as exc:
            logger.warning("Migration skipped ({}): {}", stmt[:50], exc)

    await db.commit()

    cursor = await db.execute("SELECT COUNT(*) as cnt FROM products")
    row = await cursor.fetchone()
    logger.info("Database ready — {} cached products", row["cnt"])


async def close_db() -> None:
    """Close database connection on shutdown."""
    global _db
    if _db:
        await _db.close()
        _db = None
