"""Database initialization for FreezeWise — no seed data, AI generates on demand."""

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
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_products_name_ru ON products(name_ru COLLATE NOCASE);
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_name_unique ON products(name COLLATE NOCASE);
""";


def _dict_row_factory(cursor: aiosqlite.Cursor, row: tuple) -> dict:
    """Convert row to dict using cursor description."""
    columns = [col[0] for col in cursor.description]
    return dict(zip(columns, row))


@asynccontextmanager
async def get_db() -> AsyncIterator[aiosqlite.Connection]:
    """Async context manager for database connections.

    Usage:
        async with get_db() as db:
            cursor = await db.execute(...)
    """
    db = await aiosqlite.connect(str(DB_PATH))
    db.row_factory = _dict_row_factory
    await db.create_function("ULOWER", 1, lambda s: s.lower() if s else s)
    try:
        yield db
    finally:
        await db.close()


async def init_db() -> None:
    """Initialize database schema. No seed data — AI generates products on demand."""
    async with get_db() as db:
        await db.executescript(SCHEMA)
        cursor = await db.execute("SELECT COUNT(*) as cnt FROM products")
        row = await cursor.fetchone()
        logger.info("Database ready — {} cached products", row["cnt"])
