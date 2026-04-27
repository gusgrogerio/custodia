"""Backend tests for D1 Custódia - Region features (Iteration 4)"""
import os
import pytest
import requests
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://d1-custodia.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"email": "admin", "password": "123456789"}


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{API}/auth/login", json=ADMIN, timeout=30)
    assert r.status_code == 200, f"login failed: {r.text}"
    data = r.json()
    assert "token" in data and data["role"] == "admin"
    return data["token"]


@pytest.fixture(scope="module")
def headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ---- Auth ----
def test_login_invalid():
    r = requests.post(f"{API}/auth/login", json={"email": "admin", "password": "wrong"}, timeout=30)
    assert r.status_code == 401


def test_auth_me(headers):
    r = requests.get(f"{API}/auth/me", headers=headers, timeout=30)
    assert r.status_code == 200
    assert r.json()["email"] == "admin"


# ---- Custody creation with region ----
@pytest.fixture(scope="module")
def sp_custody(headers):
    payload = {
        "shipment_code": "TEST_SP_REM001",
        "client_name": "TEST_ClienteSP",
        "phone": "11999990001",
        "city": "São Paulo",
        "state": "SP",
        "region": "São Paulo",
        "occurrence_type": "cliente_ausente",
        "volume_current": 1,
        "volume_total": 2,
    }
    r = requests.post(f"{API}/custodies", json=payload, headers=headers, timeout=30)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["region"] == "São Paulo"
    assert d["city"] == "São Paulo" and d["state"] == "SP"
    assert d["box_number"].startswith(f"CX-{datetime.now(timezone.utc).strftime('%Y%m%d')}-")
    assert d["status"] == "pending"
    assert "last_treatment_at" in d
    return d


@pytest.fixture(scope="module")
def guarulhos_custody(headers):
    payload = {
        "shipment_code": "TEST_GRU_REM001",
        "client_name": "TEST_ClienteGRU",
        "phone": "11999990002",
        "city": "Guarulhos",
        "state": "SP",
        "region": "Guarulhos",
        "occurrence_type": "mudou_se",
    }
    r = requests.post(f"{API}/custodies", json=payload, headers=headers, timeout=30)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["region"] == "Guarulhos"
    return d


def test_create_sp(sp_custody):
    assert sp_custody["region"] == "São Paulo"


def test_create_guarulhos(guarulhos_custody):
    assert guarulhos_custody["region"] == "Guarulhos"


def test_get_custody_persistence(headers, sp_custody):
    r = requests.get(f"{API}/custodies/{sp_custody['id']}", headers=headers, timeout=30)
    assert r.status_code == 200
    d = r.json()
    assert d["region"] == "São Paulo"
    assert d["box_number"] == sp_custody["box_number"]
    assert "days_without_treatment" in d


# ---- Region filter on list ----
def test_list_filter_region_sp(headers, sp_custody, guarulhos_custody):
    r = requests.get(f"{API}/custodies?region=São Paulo&limit=500", headers=headers, timeout=30)
    assert r.status_code == 200
    items = r.json()
    assert all(c["region"] == "São Paulo" for c in items)
    assert any(c["id"] == sp_custody["id"] for c in items)
    # All required fields present
    sample = next(c for c in items if c["id"] == sp_custody["id"])
    for f in ["region", "city", "state", "box_number", "last_treatment_at", "volume_current", "volume_total"]:
        assert f in sample, f"missing {f}"


def test_list_filter_region_guarulhos(headers, guarulhos_custody):
    r = requests.get(f"{API}/custodies?region=Guarulhos&limit=500", headers=headers, timeout=30)
    assert r.status_code == 200
    items = r.json()
    assert all(c["region"] == "Guarulhos" for c in items)
    assert any(c["id"] == guarulhos_custody["id"] for c in items)


def test_list_search_query(headers, sp_custody):
    # search by shipment_code
    r = requests.get(f"{API}/custodies?search_query=TEST_SP_REM001&limit=10", headers=headers, timeout=30)
    assert r.status_code == 200
    items = r.json()
    assert any(c["id"] == sp_custody["id"] for c in items)

    # search by client_name partial
    r = requests.get(f"{API}/custodies?search_query=ClienteSP&limit=10", headers=headers, timeout=30)
    assert r.status_code == 200
    assert any(c["id"] == sp_custody["id"] for c in r.json())

    # search by box_number
    r = requests.get(f"{API}/custodies?search_query={sp_custody['box_number']}&limit=10", headers=headers, timeout=30)
    assert r.status_code == 200
    assert any(c["id"] == sp_custody["id"] for c in r.json())


# ---- Region stats endpoint ----
def test_region_stats(headers, sp_custody, guarulhos_custody):
    r = requests.get(f"{API}/custodies/region-stats", headers=headers, timeout=30)
    assert r.status_code == 200
    d = r.json()
    assert "São Paulo" in d and "Guarulhos" in d
    for region in ["São Paulo", "Guarulhos"]:
        s = d[region]
        for f in ["total", "near_return", "ready_for_return", "has_alert", "alert_type"]:
            assert f in s, f"missing {f} in {region}"
        assert isinstance(s["total"], int)
        assert s["total"] >= 1  # we just created one in each
    assert d["São Paulo"]["alert_type"] in [None, "red", "yellow"]


# ---- Days calculation (indicator flags) ----
def test_treatment_flags(headers, sp_custody):
    r = requests.get(f"{API}/custodies/{sp_custody['id']}", headers=headers, timeout=30)
    d = r.json()
    # Just created -> 0 days, not near return, not ready for return
    assert d["days_without_treatment"] == 0
    assert d["is_near_return"] is False
    assert d["is_ready_for_return"] is False
    assert d["alert_type"] is None


# ---- Label / QR ----
def test_label_endpoint(headers, sp_custody):
    r = requests.get(f"{API}/custodies/{sp_custody['id']}/label", headers=headers, timeout=30)
    assert r.status_code == 200
    d = r.json()
    assert d["box_number"] == sp_custody["box_number"]
    assert d["qr_data"] == sp_custody["box_number"]
    assert d["volume"] == "1/2"


# ---- Central stats ----
def test_central_stats(headers):
    r = requests.get(f"{API}/custodies/central-stats", headers=headers, timeout=30)
    assert r.status_code == 200
    d = r.json()
    for f in ["total", "awaiting_return", "near_return", "ready_for_return", "finalized", "no_photos"]:
        assert f in d


# ---- Unauthorized ----
def test_unauthenticated_list():
    r = requests.get(f"{API}/custodies", timeout=30)
    assert r.status_code == 401


# ---- Cleanup ----
def test_zz_cleanup(headers, sp_custody, guarulhos_custody):
    # Not exposing DELETE endpoint in API, so just mark them resolved to keep data clean
    for cid in [sp_custody["id"], guarulhos_custody["id"]]:
        r = requests.patch(f"{API}/custodies/{cid}", json={"status": "resolved"}, headers=headers, timeout=30)
        assert r.status_code == 200
