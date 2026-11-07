"""Criterios de cierre (runbooks) y escalado obligatorio (política §5): soc/policy/closure.py."""
from soc.data.store import get_store
from soc.enrich.context import build_context
from soc.policy.closure import LLM_CLOSE_MIN_CONFIDENCE, mandatory_escalation, ticket_status
from soc.policy.rules import r_terraform_pipeline
from soc.triage.prefilter import deterministic_ticket

CLOSE = [{"action": "close", "target": "ticket", "requires_approval": False}]
N1_BLOCK = {"action": "block_ioc", "target": "1.2.3.4", "requires_approval": False}
NEEDS_N2 = {"action": "isolate_host", "target": "WS-1", "requires_approval": True}


def hit(rule, **kw):
    return {"rule": rule, "effect": "context", **kw}


# ------------------------------------------------------------------ ticket_status
def test_benign_verdicts_close():
    assert ticket_status("false_positive", "informational", False, CLOSE) == "closed"
    assert ticket_status("benign_true_positive", "low", False, []) == "closed"


def test_runbook_closes_blocked_true_positive_low():
    # RB-02 / RB-05: bloqueado antes de producir efecto → cerrar (low)
    assert ticket_status("true_positive", "low", False, CLOSE) == "closed"
    # RB-01: purgar y bloquear (N1) y cerrar: el sistema no ejecuta nada, así que se cierra cuando el N1 lo hace
    assert ticket_status("true_positive", "informational", False, [N1_BLOCK, *CLOSE]) == "triaged"
    assert ticket_status("true_positive", "informational", False, [N1_BLOCK, *CLOSE], executed=[N1_BLOCK]) == "closed"


def test_true_positive_not_closed_without_close_or_when_severe():
    assert ticket_status("true_positive", "low", False, [N1_BLOCK]) == "triaged"
    assert ticket_status("true_positive", "medium", False, CLOSE) == "triaged"
    assert ticket_status("needs_more_info", "low", False, CLOSE) == "triaged"


def test_escalation_and_approvals_win_over_closing():
    assert ticket_status("true_positive", "low", True, CLOSE) == "escalated"
    assert ticket_status("false_positive", "low", False, [NEEDS_N2, *CLOSE]) == "awaiting_approval"
    assert ticket_status("false_positive", "low", False, [NEEDS_N2, *CLOSE], executed=[NEEDS_N2]) == "closed"


def test_llm_needs_confidence_to_close_but_policy_does_not():
    low = LLM_CLOSE_MIN_CONFIDENCE - 0.01
    assert ticket_status("false_positive", "informational", False, CLOSE, low, "llm") == "triaged"
    assert ticket_status("false_positive", "informational", False, CLOSE, LLM_CLOSE_MIN_CONFIDENCE, "llm") == "closed"
    assert ticket_status("false_positive", "informational", False, CLOSE, low, "policy") == "closed"


# ------------------------------------------------------------ mandatory_escalation
def test_section5_escalates_true_positives_regardless_of_severity():
    assert mandatory_escalation("true_positive", [hit("AV_EXECUTED")])[0].startswith("Obligatorio (política §5): ejecución")
    assert "persistencia" in mandatory_escalation("true_positive", [], "UC-IDP-005")[0]
    assert "fraude" in mandatory_escalation("true_positive", [], "UC-EML-004")[0]
    assert "credenciales" in mandatory_escalation("true_positive", [hit("CONFIRMED_ACCESS")])[0]


def test_section5_only_for_true_positive():
    assert mandatory_escalation("false_positive", [hit("AV_EXECUTED")], "UC-EML-004") == []
    assert mandatory_escalation("needs_more_info", [], "UC-IDP-005") == []


def test_blocked_data_leak_is_not_mandatory_but_dependency_confusion_with_secrets_is():
    assert mandatory_escalation("true_positive", [hit("CONTROL_BLOCKED", minus="bloqueado")], "UC-DLP-002") == []
    assert mandatory_escalation("true_positive", [hit("TARVIA_PKG_PUBLIC_REGISTRY")]) == []
    assert mandatory_escalation("true_positive", [hit("TARVIA_PKG_PUBLIC_REGISTRY", plus="robo de secretos")])


# ------------------------------------------------------------- dataset (sin LLM)
def _first(pred):
    return next(a for a in get_store().alerts() if pred(a))


def _ticket(alert):
    s = get_store()
    return deterministic_ticket(build_context(alert, s), s)


def test_waf_blocked_scan_is_closed_by_policy():
    pentest = {"192.0.2.10", "192.0.2.11", "192.0.2.12"}
    a = _first(lambda a: a["rule_id"] == "UC-WEB-001" and a["evidence"].get("action") == "blocked"
               and not set(a["entities"].get("ips", [])) & pentest)
    t = _ticket(a)
    assert t["verdict"] == "true_positive" and t["severity"] in ("informational", "low")
    assert t["x_status"] == "closed" and not t["escalation"]["escalate"]


def test_terraform_pipeline_is_closed_as_authorized():
    t = _ticket(_first(lambda a: a["rule_id"] == "UC-CLD-003" and "terraform" in str(a["evidence"])))
    assert "TERRAFORM_PIPELINE" in {h["rule"] for h in t["x_policy_hits"]}
    assert t["verdict"] == "benign_true_positive" and t["x_status"] == "closed"


def test_terraform_rule_rejects_other_origin():
    s = get_store()
    a = _first(lambda a: a["rule_id"] == "UC-CLD-003" and "terraform" in str(a["evidence"]))
    ctx = build_context(a, s)
    for e in ctx["related_events"]:
        e["sourceIPAddress"] = "203.0.113.9"
    assert r_terraform_pipeline(ctx, s)[0]["rule"] == "CLOUD_CHANGE_OUTSIDE_PIPELINE"


def test_closing_actions_from_runbooks():
    nessus = _ticket(_first(lambda a: a["rule_id"] == "UC-NET-003" and "NESSUS01" in str(a["entities"])))
    assert "propose_rule_exclusion" in {a["action"] for a in nessus["recommended_actions"]}
    assert nessus["x_status"] == "closed"
