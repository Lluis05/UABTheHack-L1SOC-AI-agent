"""Ningún test puede gastar cuota del LLM: soc.llm.complete falla si alguien lo llama sin simularlo."""
import pytest


@pytest.fixture(autouse=True)
def _block_real_llm(monkeypatch):
    def blocked(*a, **k):
        raise RuntimeError("LLM real bloqueado en tests (simula soc.triage.agent.cached_complete)")

    monkeypatch.setattr("soc.llm.complete", blocked)
    monkeypatch.setattr("soc.triage.agent.complete", blocked)  # agent.py lo importa por nombre
