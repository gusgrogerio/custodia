"""Backend tests - Iteration 7
Focus: auto-return occurrences, /treatments endpoint (dedup per business day),
near_return/ready_for_return computations, alerts message format,
CSV export 'Dias com Tratativa' header, RBAC on /treatments.
"""
import os
import csv
import io
import uuid
import datetime
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"
ADMIN = {"email": "admin", "password": "123456789"}
AUTO_RETURN = {"caixa_postal", "recusado", "ausente_3", "mudou_se"}


def _login(email, password):
    return requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)


def _hdr(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _is_business_day_today():
    return datetime.datetime.utcnow().weekday() < 5


# ---------- fixtures ----------
@pytest.fixture(scope="module")
def admin_headers():
    r = _login(ADMIN["email"], ADMIN["password"])
    assert r.status_code == 200, r.text
    return _hdr(r.json()["token"])


@pytest.fixture(scope="module")
def operator_gru(admin_headers):
    suffix = uuid.uuid4().hex[:6]
    payload = {
        "email": f"TEST_op_gru7_{suffix}@d1.com",
        "password": "opgru123",
        "name": "TEST Op GRU iter7",
        "role": "operator",
        "region": "Guarulhos",
    }
    r = requests.post(f"{API}/users", json=payload, headers=admin_headers, timeout=30)
    assert r.status_code == 201, r.text
    user = r.json()
    yield {**user, "password": payload["password"]}
    requests.delete(f"{API}/users/{user['id']}", headers=admin_headers, timeout=30)


@pytest.fixture(scope="module")
def operator_headers(operator_gru):
    r = _login(operator_gru["email"], operator_gru["password"])
    assert r.status_code == 200, r.text
    return _hdr(r.json()["token"])


def _create_custody(headers, occurrence_type="cliente_ausente", region="São Paulo", suffix=None):
    suffix = suffix or uuid.uuid4().hex[:6]
    payload = {
        "shipment_code": f"TEST_ITER7_{suffix}",
        "client_name": f"TEST_Cust_{suffix}",
        "phone": "11999990000",
        "city": "São Paulo" if region == "São Paulo" else "Guarulhos",
        "state": "SP",
        "region": region,
        "occurrence_type": occurrence_type,
        "volume_current": 1,
        "volume_total": 1,
    }
    r = requests.post(f"{API}/custodies", json=payload, headers=headers, timeout=30)
    return r


# ---------- Auto-return occurrences ----------
@pytest.mark.parametrize("occ", ["caixa_postal", "ausente_3", "recusado", "mudou_se"])
def test_create_with_auto_return_occurrence_sets_status_immediately(admin_headers, occ):
    r = _create_custody(admin_headers, occurrence_type=occ)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "ready_for_return", f"{occ} should be ready_for_return"
    assert body.get("occurrence_type") == occ
    assert body.get("auto_return_by_occurrence") is True
    assert body.get("is_ready_for_return") is True


def test_create_with_non_auto_occurrence_stays_pending(admin_headers):
    r = _create_custody(admin_headers, occurrence_type="cliente_ausente")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "pending"
    assert body.get("auto_return_by_occurrence") is False


# ---------- PUT changes occurrence to auto-return ----------
def test_put_to_auto_return_occurrence_promotes_status(admin_headers):
    r = _create_custody(admin_headers, occurrence_type="cliente_ausente")
    assert r.status_code == 200
    cid = r.json()["id"]
    pr = requests.put(f"{API}/custodies/{cid}",
                      json={"occurrence_type": "caixa_postal"},
                      headers=admin_headers, timeout=30)
    assert pr.status_code == 200, pr.text
    body = pr.json()
    assert body["occurrence_type"] == "caixa_postal"
    assert body["status"] == "ready_for_return"
    assert body.get("auto_return_by_occurrence") is True


# ---------- /treatments endpoint ----------
def test_treatments_dedup_same_day(admin_headers):
    r = _create_custody(admin_headers, occurrence_type="cliente_ausente")
    assert r.status_code == 200
    cid = r.json()["id"]
    # call 3 times in the same day
    days_seen = []
    for _ in range(3):
        tr = requests.post(f"{API}/custodies/{cid}/treatments", headers=admin_headers, timeout=30)
        assert tr.status_code == 200, tr.text
        days_seen.append(tr.json().get("treatment_days"))
    # GET to verify
    g = requests.get(f"{API}/custodies/{cid}", headers=admin_headers, timeout=30)
    assert g.status_code == 200
    body = g.json()
    expected = 1 if _is_business_day_today() else 0
    assert body["treatment_days"] == expected, f"expected {expected} got {body['treatment_days']}"
    assert body["days_with_treatment"] == expected
    # legacy alias must also be present
    assert body["days_without_treatment"] == expected
    # all 3 calls return same treatment_days (deduplicated)
    assert len(set(days_seen)) == 1
    assert days_seen[0] == expected


def test_treatments_response_shape(admin_headers):
    r = _create_custody(admin_headers, occurrence_type="cliente_ausente")
    cid = r.json()["id"]
    tr = requests.post(f"{API}/custodies/{cid}/treatments", headers=admin_headers, timeout=30)
    assert tr.status_code == 200
    body = tr.json()
    for key in ("id", "treatment_days", "days_with_treatment", "days_without_treatment",
                "is_ready_for_return", "auto_return_by_occurrence"):
        assert key in body, f"missing key {key} in /treatments response"


def test_operator_cannot_treat_other_region(admin_headers, operator_headers):
    # admin creates SP custody
    r = _create_custody(admin_headers, occurrence_type="cliente_ausente", region="São Paulo")
    cid = r.json()["id"]
    tr = requests.post(f"{API}/custodies/{cid}/treatments", headers=operator_headers, timeout=30)
    assert tr.status_code == 403, tr.text


def test_operator_can_treat_own_region(admin_headers, operator_headers):
    r = _create_custody(operator_headers, occurrence_type="cliente_ausente", region="Guarulhos")
    assert r.status_code == 200, r.text
    cid = r.json()["id"]
    tr = requests.post(f"{API}/custodies/{cid}/treatments", headers=operator_headers, timeout=30)
    assert tr.status_code == 200, tr.text


# ---------- GET /custodies/{id} field shape ----------
def test_get_custody_returns_treatment_fields(admin_headers):
    r = _create_custody(admin_headers, occurrence_type="caixa_postal")
    cid = r.json()["id"]
    g = requests.get(f"{API}/custodies/{cid}", headers=admin_headers, timeout=30)
    assert g.status_code == 200
    body = g.json()
    for key in ("treatment_days", "days_with_treatment", "days_without_treatment",
                "is_ready_for_return", "auto_return_by_occurrence"):
        assert key in body, f"missing {key}"
    assert body["auto_return_by_occurrence"] is True
    assert body["is_ready_for_return"] is True


# ---------- ready_for_return filter ----------
def test_list_ready_for_return_includes_auto_occurrence(admin_headers):
    r = _create_custody(admin_headers, occurrence_type="caixa_postal")
    target_id = r.json()["id"]
    lst = requests.get(f"{API}/custodies?ready_for_return=true&limit=500",
                       headers=admin_headers, timeout=30)
    assert lst.status_code == 200, lst.text
    ids = {c["id"] for c in lst.json()}
    assert target_id in ids


# ---------- Stats / alerts / central-stats ----------
def test_stats_returns_near_and_ready(admin_headers):
    r = requests.get(f"{API}/custodies/stats", headers=admin_headers, timeout=30)
    assert r.status_code == 200, r.text
    body = r.json()
    for key in ("near_return", "ready_for_return", "pending"):
        assert key in body
    assert isinstance(body["ready_for_return"], int)


def test_central_stats_reflects_auto_return(admin_headers):
    # create a guaranteed auto-return custody in São Paulo
    _create_custody(admin_headers, occurrence_type="recusado", region="São Paulo")
    r = requests.get(f"{API}/custodies/central-stats?region=São Paulo",
                     headers=admin_headers, timeout=30)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["region"] == "São Paulo"
    assert body["ready_for_return"] >= 1


def test_alerts_message_uses_dias_uteis_de_tratativa(admin_headers):
    # ensure at least one auto-return custody so alerts list is non-empty
    _create_custody(admin_headers, occurrence_type="caixa_postal", region="São Paulo")
    r = requests.get(f"{API}/custodies/alerts", headers=admin_headers, timeout=30)
    assert r.status_code == 200, r.text
    alerts = r.json()
    assert isinstance(alerts, list) and len(alerts) >= 1
    # No legacy 'sem retorno' in any message
    for a in alerts:
        msg = a.get("message", "").lower()
        assert "sem retorno" not in msg, f"legacy phrase in {msg!r}"
        # must include treatment_days field
        assert "treatment_days" in a
        assert "days_with_treatment" in a


# ---------- CSV export header ----------
def test_csv_export_has_dias_com_tratativa_header(admin_headers):
    r = requests.get(f"{API}/custodies/export/csv", headers=admin_headers, timeout=30)
    assert r.status_code == 200, r.text
    text = r.content.decode("utf-8-sig")
    reader = csv.reader(io.StringIO(text))
    header = next(reader)
    assert "Dias com Tratativa" in header, header
    assert "Dias sem Tratativa" not in header, header
