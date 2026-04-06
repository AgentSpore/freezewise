"""FreezeWise FastAPI application."""

from __future__ import annotations

import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from loguru import logger

from freezewise.api.fridge import router as fridge_router
from freezewise.api.products import router as products_router
from freezewise.api.scan import router as scan_router
from freezewise.database import init_db

STATIC_DIR = Path(__file__).resolve().parent.parent.parent / "static"


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Initialize database on startup."""
    logger.info("FreezeWise starting up — initializing database")
    await init_db()
    logger.info("Database ready")
    yield
    logger.info("FreezeWise shutting down")


app = FastAPI(
    title="FreezeWise",
    description="AI-powered food storage guide and smart fridge manager",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — restrict to same-origin + configured origins
_CORS_ORIGINS = [
    o.strip()
    for o in os.getenv("CORS_ORIGINS", "").split(",")
    if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_CORS_ORIGINS or ["*"],
    allow_credentials=bool(_CORS_ORIGINS),  # credentials only with explicit origins
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type"],
)

# Routers
app.include_router(products_router)
app.include_router(fridge_router)
app.include_router(scan_router)

# Static files
if STATIC_DIR.is_dir():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR), html=True), name="static")


@app.get("/health")
async def health() -> dict:
    """Health check endpoint."""
    return {"status": "ok", "service": "freezewise", "version": "1.0.0"}


@app.get("/")
async def root():
    """Serve index.html."""
    index = STATIC_DIR / "index.html"
    if index.exists():
        return FileResponse(str(index))
    return {"message": "FreezeWise API", "docs": "/docs"}
