"""Configuración central: rutas y URLs leídas de .env. Nunca escribir rutas a mano en el código."""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(REPO_ROOT / ".env")


def _path(env: str, default: str) -> Path:
    p = Path(os.getenv(env) or default)
    return p if p.is_absolute() else (REPO_ROOT / p).resolve()


DATASET_DIR: Path = _path("DATASET_DIR", "../DTT-UAB-The-Hack")
OUTPUT_DIR: Path = _path("OUTPUT_DIR", "output")
CACHE_DIR: Path = OUTPUT_DIR / "cache"
SOC_API_URL: str = os.getenv("SOC_API_URL", "http://localhost:8000")
