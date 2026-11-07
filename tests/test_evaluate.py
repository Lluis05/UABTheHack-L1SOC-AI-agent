"""Tests de eval/evaluate.py (B4) con tickets y etiquetas sintéticos: sin LLM ni DataStore."""
import json

import pytest

from eval.evaluate import (NO_TICKET, evaluate, format_report, load_cases, main, normalize_label,
                           severity_distance, tickets_by_alert)


def ticket(aid, verdict, severity="low", escalate=False, rule="UC-EML-001", decided="llm", **extra):
    return {"ticket_id": "TKT-" + aid, "alert_ids": [aid], "verdict": verdict, "severity": severity,
            "confidence": 0.8, "title": f"t {aid}", "escalation": {"escalate": escalate},
            "x_rule": {"rule_id": rule}, "x_decided_by": {"verdict": decided}, **extra}


def label(aid, verdict, severity=None, escalate=None, **extra):
    return normalize_label({"alert_id": aid, "verdict": verdict, "severity": severity, "escalate": escalate, **extra})


def test_normalize_label_validates():
    assert label("A", "false_positive")["verdict"] == ["false_positive"]
    assert label("A", ["false_positive", "benign_true_positive"])["verdict"] == ["false_positive",
                                                                                  "benign_true_positive"]
    with pytest.raises(ValueError):
        normalize_label({"alert_id": "A", "verdict": "maybe"})
    with pytest.raises(ValueError):
        normalize_label({"alert_id": "A", "verdict": "true_positive", "severity": "urgent"})


def test_severity_distance():
    assert severity_distance("low", "high") == 2
    assert severity_distance("critical", "critical") == 0
    assert severity_distance(None, "low") is None


def test_dedup_ticket_covers_all_its_alerts():
    t = {**ticket("A", "false_positive"), "alert_ids": ["A", "B"]}
    assert set(tickets_by_alert([t])) == {"A", "B"}


def test_metrics_and_error_kinds():
    tickets = [
        ticket("A", "true_positive", "high", escalate=True),          # bien
        ticket("B", "false_positive", "informational"),               # TP perdido (lo peor)
        ticket("C", "true_positive", "medium", escalate=True),        # falsa alarma
        ticket("D", "benign_true_positive", "informational", rule="UC-EDR-002", decided="policy"),
        ticket("E", "true_positive", "low", escalate=False),          # severidad a 2 niveles + escalado perdido
    ]
    labels = {l["alert_id"]: l for l in [
        label("A", "true_positive", "high", True),
        label("B", "true_positive", "medium", True),
        label("C", "false_positive", "informational", False),
        label("D", ["false_positive", "benign_true_positive"], "informational"),  # se aceptan las dos
        label("E", "true_positive", "high", True),
        label("F", "false_positive"),                                 # sin ticket
    ]}
    m = evaluate(tickets, labels)
    assert m["n_labels"] == 6 and m["n_with_ticket"] == 5
    assert m["verdict_accuracy"] == round(3 / 6, 3)
    assert m["tp_expected"] == 3 and m["tp_missed"] == 1 and m["tp_recall"] == round(2 / 3, 3)
    assert m["false_alarms"] == 1
    assert m["confusion"]["true_positive"]["false_positive"] == 1
    assert m["confusion"]["benign_true_positive"]["benign_true_positive"] == 1
    assert m["confusion"]["false_positive"][NO_TICKET] == 1
    assert m["severity_n"] == 5 and m["severity_exact"] == round(2 / 5, 3)
    assert m["escalation_n"] == 4 and m["escalation_missed"] == 2
    kinds = {e["alert_id"]: e["kind"] for e in m["errors"]}
    assert kinds == {"B": "TP perdido", "F": "sin ticket", "C": "falsa alarma", "E": "severidad"}
    assert m["errors"][0]["alert_id"] == "B"                          # lo más grave primero
    assert m["by_decider"]["policy"] == {"ok": 1, "n": 1, "accuracy": 1.0}
    assert "Matriz de confusión" in format_report(m, "x")


def test_injection_metrics():
    tickets = [ticket("A", "true_positive", x_injection={"detected": True}),
               ticket("B", "false_positive", x_injection={"detected": False}),
               ticket("C", "false_positive", x_injection={"detected": True})]
    labels = {"A": label("A", "true_positive", injection=True), "B": label("B", "true_positive", injection=True),
              "C": label("C", "false_positive", injection=False)}
    m = evaluate(tickets, labels)
    assert m["injection_n"] == 2 and m["injection_detected"] == 0.5 and m["injection_not_closed"] == 0.5
    assert m["injection_controls"] == 1 and m["injection_false_detections"] == 1


def test_load_cases_strips_expected(tmp_path):
    p = tmp_path / "cases.jsonl"
    p.write_text(json.dumps({"alert_id": "ALR-X", "rule_id": "UC-AI-001",
                             "x_expected": {"verdict": "true_positive", "injection": True}}) + "\n", encoding="utf-8")
    alerts, labels = load_cases(p)
    assert "x_expected" not in alerts[0] and labels["ALR-X"]["injection"] and labels["ALR-X"]["rule_id"] == "UC-AI-001"


def test_cli_end_to_end(tmp_path, capsys):
    tk, lb, rep = tmp_path / "t.jsonl", tmp_path / "l.jsonl", tmp_path / "r.json"
    tk.write_text(json.dumps(ticket("A", "false_positive", "informational")) + "\n", encoding="utf-8")
    lb.write_text(json.dumps({"alert_id": "A", "verdict": "false_positive", "severity": "informational"}) + "\n",
                  encoding="utf-8")
    assert main(["--tickets", str(tk), "--labels", str(lb), "--report", str(rep)]) == 0
    assert json.loads(rep.read_text(encoding="utf-8"))["verdict_accuracy"] == 1.0
    assert main(["--labels", str(tmp_path / "no.jsonl"), "--tickets", str(tk)]) == 2
