"""Capa de abstracción del LLM.

Proveedores, en orden de preferencia (configurable con LLM_PROVIDERS en .env):
  - claude_code: Claude Code en modo headless (`claude -p`), usa la suscripción del usuario.
  - gemini:      Google Gemini API (free tier) como fallback.

Seguridad: las alertas contienen datos controlados por el atacante, así que
Claude se ejecuta SIN herramientas (--tools "") y sin persistencia de sesión.
Aunque una alerta contenga una prompt injection, el modelo no puede ejecutar
comandos ni tocar ficheros.
"""

from __future__ import annotations

import json
import logging
import os
import shutil
import subprocess
from typing import Any

from dotenv import load_dotenv

load_dotenv()
log = logging.getLogger(__name__)


class LLMError(RuntimeError):
    pass


def _claude_code(system: str, prompt: str, schema: dict | None) -> str | dict:
    exe = shutil.which("claude")
    if not exe:
        raise LLMError("No se encuentra el CLI 'claude' en el PATH")
    cmd = [
        exe, "-p",
        "--tools", "",
        "--no-session-persistence",
        "--output-format", "json",
        "--system-prompt", system,
    ]
    if model := os.getenv("CLAUDE_MODEL"):
        cmd += ["--model", model]
    if schema:
        cmd += ["--json-schema", json.dumps(schema)]
    try:
        r = subprocess.run(
            cmd, input=prompt, capture_output=True, text=True, encoding="utf-8",
            timeout=int(os.getenv("LLM_TIMEOUT", "180")),
        )
    except subprocess.TimeoutExpired as e:
        raise LLMError("Timeout de Claude Code") from e
    try:
        out = json.loads(r.stdout)
    except json.JSONDecodeError as e:
        raise LLMError(f"Salida inválida de Claude Code: {r.stderr or r.stdout[:300]}") from e
    if out.get("is_error"):
        raise LLMError(f"Claude Code error: {out.get('result') or out.get('api_error_status')}")
    if schema:
        if isinstance(out.get("structured_output"), dict):
            return out["structured_output"]
        return json.loads(out["result"])
    return out["result"]


def _gemini(system: str, prompt: str, schema: dict | None) -> str | dict:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise LLMError("Falta GEMINI_API_KEY en .env")
    from google import genai
    from google.genai import types

    config = types.GenerateContentConfig(system_instruction=system)
    if schema:
        config.response_mime_type = "application/json"
        config.response_json_schema = schema
    client = genai.Client(api_key=api_key)
    resp = client.models.generate_content(
        model=os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
        contents=prompt,
        config=config,
    )
    return json.loads(resp.text) if schema else resp.text


PROVIDERS = {"claude_code": _claude_code, "gemini": _gemini}


def complete(system: str, prompt: str, schema: dict | None = None) -> tuple[Any, str]:
    """Llama al LLM con fallback automático.

    Devuelve (respuesta, proveedor_usado). Si se pasa `schema` (JSON Schema),
    la respuesta es un dict validado; si no, texto.
    """
    order = [p.strip() for p in os.getenv("LLM_PROVIDERS", "claude_code,gemini").split(",") if p.strip()]
    errors = []
    for name in order:
        fn = PROVIDERS.get(name)
        if fn is None:
            errors.append(f"{name}: proveedor desconocido")
            continue
        try:
            return fn(system, prompt, schema), name
        except Exception as e:  # noqa: BLE001 - cualquier fallo pasa al siguiente proveedor
            log.warning("Proveedor %s falló: %s", name, e)
            errors.append(f"{name}: {e}")
    raise LLMError("Todos los proveedores fallaron -> " + " | ".join(errors))


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    demo_schema = {
        "type": "object",
        "properties": {
            "verdict": {"type": "string", "enum": ["true_positive", "false_positive", "benign", "escalate"]},
            "confidence": {"type": "number"},
            "reasoning": {"type": "string"},
        },
        "required": ["verdict", "confidence", "reasoning"],
    }
    result, provider = complete(
        "Eres un analista SOC L1. Clasifica la alerta.",
        "Alerta: 1 intento de login fallido desde 1.2.3.4 para el usuario jdoe.",
        demo_schema,
    )
    print(f"[{provider}]", json.dumps(result, indent=2, ensure_ascii=False))
