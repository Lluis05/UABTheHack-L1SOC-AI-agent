"""Utilidades de tiempo. El dataset usa ISO 8601 UTC con 'Z' (p. ej. 2026-10-05T07:56:30.000Z).

Los strings con ese formato se pueden comparar directamente (orden lexicográfico = orden temporal).
España: CEST (UTC+2) hasta el 25/10/2026 a las 01:00 UTC; después CET (UTC+1).
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

DST_END_UTC = datetime(2026, 10, 25, 1, 0, tzinfo=timezone.utc)


def parse(ts: str) -> datetime:
    """ISO (con 'Z', offset o sin zona = UTC) → datetime aware en UTC."""
    ts = ts.strip().replace(" ", "T")
    if ts.endswith("Z"):
        ts = ts[:-1] + "+00:00"
    dt = datetime.fromisoformat(ts)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def fmt(dt: datetime) -> str:
    """datetime → ISO UTC con milisegundos y 'Z', igual que el dataset."""
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.") + f"{dt.microsecond // 1000:03d}Z"


def shift(ts: str, hours: float = 0, days: float = 0) -> str:
    return fmt(parse(ts) + timedelta(hours=hours, days=days))


def window(ts: str, hours: float = 24) -> tuple[str, str]:
    """(ts - hours, ts + hours)."""
    return shift(ts, hours=-hours), shift(ts, hours=hours)


def utc_offset_madrid(dt_utc: datetime) -> int:
    return 2 if dt_utc < DST_END_UTC else 1


def to_local(ts: str) -> datetime:
    """UTC → hora local de Barcelona (naive). Útil para comparar con el calendario de cambios."""
    dt = parse(ts)
    return (dt + timedelta(hours=utc_offset_madrid(dt))).replace(tzinfo=None)


def local_to_utc(local: str) -> str:
    """'2026-10-08 08:00' (hora local) → ISO UTC. Formato del calendario de cambios."""
    naive = datetime.fromisoformat(local.strip().replace(" ", "T"))
    guess = naive.replace(tzinfo=timezone.utc) - timedelta(hours=2)
    off = utc_offset_madrid(guess)
    return fmt((naive - timedelta(hours=off)).replace(tzinfo=timezone.utc))
