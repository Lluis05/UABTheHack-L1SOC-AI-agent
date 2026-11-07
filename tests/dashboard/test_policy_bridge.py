"""Tests de dashboard/policy.py: el dashboard aplica la política de soc/policy/approvals.py sin duplicarla."""
from dashboard import policy


class FakeStore:
    """CMDB mínima: lo justo para que approval_for distinga OT, TPV y cuentas de servicio."""

    ASSETS = {
        "plc-zar-03": {"hostname": "PLC-ZAR-03", "zone": "LOGISTICS-OT", "type": "PLC"},
        "tpv-bcn-01": {"hostname": "TPV-BCN-01", "zone": "STORES", "type": "TPV"},
    }

    def asset(self, key):
        return self.ASSETS.get((key or "").lower())

    def user(self, key):
        return {"account_type": "service"} if key == "svc_sccm" else None

    def services(self):
        return []


def make_ticket(*actions):
    return {"ticket_id": "T1", "recommended_actions": [{"action": a, "target": t} for a, t in actions]}


def approvals_of(ticket):
    return {(a["action"], a["target"]): a["x_approval"] for a in ticket["recommended_actions"]}


def test_ot_is_never_allowed():
    t = policy.annotate_ticket(make_ticket(("isolate_host", "PLC-ZAR-03")), FakeStore())
    rule = approvals_of(t)[("isolate_host", "PLC-ZAR-03")]
    assert rule["allowed"] is False
    assert "Operaciones" in rule["approvers"][0]


def test_block_ioc_dual_use_needs_n2_but_plain_ioc_does_not():
    t = policy.annotate_ticket(make_ticket(("block_ioc", "mega.nz"), ("block_ioc", "203.0.113.50")), FakeStore())
    rules = approvals_of(t)
    assert rules[("block_ioc", "mega.nz")]["requires_approval"] is True
    assert rules[("block_ioc", "203.0.113.50")]["requires_approval"] is False


def test_tpv_needs_business_approval():
    rule = approvals_of(policy.annotate_ticket(make_ticket(("isolate_host", "TPV-BCN-01")), FakeStore()))
    assert rule[("isolate_host", "TPV-BCN-01")]["approvers"] == ["N2", "Negocio"]


def test_analyst_actions_and_no_store():
    t = policy.annotate_ticket(make_ticket(("escalate", "Operaciones"), ("revoke_sessions", "u@x")), None)
    rules = approvals_of(t)
    assert rules[("escalate", "Operaciones")]["requires_approval"] is False
    assert rules[("revoke_sessions", "u@x")]["requires_approval"] is True


def test_annotate_does_not_mutate_and_handles_missing_actions():
    original = make_ticket(("block_ioc", "1.2.3.4"))
    policy.annotate_ticket(original, None)
    assert "x_approval" not in original["recommended_actions"][0]
    assert policy.annotate_ticket({"ticket_id": "T2"}, None)["recommended_actions"] == []


def test_store_holder_reports_failure_without_raising():
    def boom():
        raise FileNotFoundError("sin dataset")

    holder = policy.StoreHolder(boom)
    holder._load()  # síncrono en el test
    assert holder.status == policy.STORE_UNAVAILABLE
    assert holder.get() is None and "sin dataset" in holder.error


def test_store_holder_ready():
    holder = policy.StoreHolder(lambda: "store")
    holder._load()
    assert holder.status == policy.STORE_READY and holder.get() == "store"
