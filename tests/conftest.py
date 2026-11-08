"""Ningún test puede gastar cuota del LLM: soc.llm.complete falla si alguien lo llama sin simularlo."""
import pytest


@pytest.fixture(autouse=True)
def _block_real_llm(monkeypatch):
    def blocked(*a, **k):
        raise RuntimeError("LLM real bloqueado en tests (simula soc.triage.agent.cached_complete)")

    monkeypatch.setattr("soc.llm.complete", blocked)
    monkeypatch.setattr("soc.triage.agent.complete", blocked)  # agent.py lo importa por nombre


@pytest.fixture(autouse=True)
def _local_by_default(monkeypatch):
    """Los tests no dependen de que la API del SOC esté levantada (salvo los que montan una falsa)."""
    monkeypatch.setenv("SOC_API_MODE", "local")
    monkeypatch.setenv("OSINT_ENABLED", "0")   # ningún test sale a Internet (test_osint lo simula)
