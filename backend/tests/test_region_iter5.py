"""Backend tests - Iteration 5
Focus: region filter on /custodies/stats, /custodies/alerts, /custodies/central-stats,
/custodies/export/csv, region validation on POST /custodies, and total isolation
between regions.
"""
import os
import io
import csv
import pytest
import requests

BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL", "https://d1-custodia.preview.emergentagent.com"
).rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"email": "admin", "password": "123456789"}


# ---------- fixtures ----------
@pytest.fixture(scope="module")
def headers():
    r = requests.post(f"{API}/auth/login", json=ADMIN, timeout=30)
    assert r.status_code == 200, r.text
    token = r.json()["token"]
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def created(headers):
    """Create a SP and a Guarulhos custody for isolation tests."""
    payloads = [
        {
            "shipment_code": "TEST_ITER5_SP_A",
            "client_name": "TEST_Iter5_SP",
            "phone": "11900000001",
            "city": "São Paulo",
            "state": "SP",
            "region": "São Paulo",
            "occurrence_type": "cliente_ausente",
            "volume_current": 1,
            "volume_total": 1,
        },
        {
            "shipment_code": "TEST_ITER5_GRU_A",
            "client_name": "TEST_Iter5_GRU",
            "phone": "11900000002",
            "city": "Guarulhos",
            "state": "SP",
            "region": "Guarulhos",
            "occurrence_type": "mudou_se",
            "volume_current": 1,
            "volume_total": 1,
        },
    ]
    out = []
    for p in payloads:
        r = requests.post(f"{API}/custodies", json=p, headers=headers, timeout=30)
        assert r.status_code == 200, r.text
        out.append(r.json())
    yield out
    # cleanup
    for c in out:
        requests.patch(
            f"{API}/custodies/{c['id']}",
            json={"status": "resolved"},
            headers=headers,
            timeout=30,
        )


# ---------- POST /custodies validation ----------
def test_post_invalid_region_returns_400(headers):
    payload = {
        "shipment_code": "TEST_ITER5_BAD_REGION",
        "client_name": "TEST_BadRegion",
        "phone": "11900000099",
        "city": "Campinas",
        "state": "SP",
        "region": "Campinas",  # invalid
        "occurrence_type": "cliente_ausente",
        "volume_current": 1,
        "volume_total": 1,
    }
    r = requests.post(f"{API}/custodies", json=payload, headers=headers, timeout=30)
    assert r.status_code == 400, r.text
    detail = r.json().get("detail", "")
    assert "região" in detail.lower() or "regiao" in detail.lower() or "invalid" in detail.lower(), detail


def test_post_empty_region_returns_400(headers):
    payload = {
        "shipment_code": "TEST_ITER5_EMPTY_REGION",
        "client_name": "TEST_Empty",
        "phone": "11900000098",
        "city": "São Paulo",
        "state": "SP",
        "region": "",
        "occurrence_type": "cliente_ausente",
        "volume_current": 1,
        "volume_total": 1,
    }
    r = requests.post(f"{API}/custodies", json=payload, headers=headers, timeout=30)
    assert r.status_code == 400, r.text


def test_post_valid_regions_accepted(created):
    # both are created via fixture
    assert any(c["region"] == "São Paulo" for c in created)
    assert any(c["region"] == "Guarulhos" for c in created)


# ---------- /custodies/stats with region ----------
def test_stats_by_region_isolation(headers, created):
    rs_sp = requests.get(f"{API}/custodies/stats?region=São Paulo", headers=headers, timeout=30)
    rs_gru = requests.get(f"{API}/custodies/stats?region=Guarulhos", headers=headers, timeout=30)
    rs_all = requests.get(f"{API}/custodies/stats", headers=headers, timeout=30)

    assert rs_sp.status_code == 200
    assert rs_gru.status_code == 200
    assert rs_all.status_code == 200

    sp = rs_sp.json()
    gru = rs_gru.json()
    allg = rs_all.json()

    # echoes back the region
    assert sp["region"] == "São Paulo"
    assert gru["region"] == "Guarulhos"
    assert allg.get("region") in (None, "")

    # all carry total_today
    for d in (sp, gru, allg):
        assert "total_today" in d
        assert "pending" in d
        assert "resolved" in d
        assert "near_return" in d
        assert "ready_for_return" in d

    # global pending should be >= each region's pending
    assert allg["pending"] >= sp["pending"]
    assert allg["pending"] >= gru["pending"]


# ---------- /custodies/central-stats with region ----------
def test_central_stats_by_region(headers, created):
    rs_sp = requests.get(f"{API}/custodies/central-stats?region=São Paulo", headers=headers, timeout=30)
    rs_gru = requests.get(f"{API}/custodies/central-stats?region=Guarulhos", headers=headers, timeout=30)
    rs_all = requests.get(f"{API}/custodies/central-stats", headers=headers, timeout=30)

    assert rs_sp.status_code == 200
    assert rs_gru.status_code == 200
    assert rs_all.status_code == 200

    sp = rs_sp.json()
    gru = rs_gru.json()
    allg = rs_all.json()
    for d in (sp, gru, allg):
        for f in ["total", "awaiting_return", "near_return", "ready_for_return", "finalized", "no_photos"]:
            assert f in d, f"missing {f}"

    # totals add up: sum of regions <= global (since other regions/legacy may exist)
    assert allg["total"] >= sp["total"] + gru["total"] - 1  # allow off-by-one for race
    assert sp["region"] == "São Paulo"
    assert gru["region"] == "Guarulhos"


# ---------- /custodies/alerts with region ----------
def test_alerts_by_region(headers, created):
    for region in ("São Paulo", "Guarulhos"):
        r = requests.get(f"{API}/custodies/alerts?region={region}", headers=headers, timeout=30)
        assert r.status_code == 200
        body = r.json()
        # Backend may return list directly or {"alerts": [...]}
        alerts = body if isinstance(body, list) else body.get("alerts", [])
        # Each alert (if any) must NOT belong to the other region.
        # Alerts only carry custody_id, so we re-fetch to ensure region match.
        for a in alerts[:5]:
            cid = a.get("custody_id")
            if cid:
                cr = requests.get(f"{API}/custodies/{cid}", headers=headers, timeout=30)
                if cr.status_code == 200:
                    assert cr.json()["region"] == region, f"alert leak between regions! {cid}"


# ---------- /custodies/export/csv with region ----------
def test_csv_export_by_region(headers, created):
    for region in ("São Paulo", "Guarulhos"):
        r = requests.get(
            f"{API}/custodies/export/csv?region={region}",
            headers={"Authorization": headers["Authorization"]},
            timeout=60,
        )
        assert r.status_code == 200, r.text[:200]
        # Content-Type should be CSV-ish
        ct = r.headers.get("content-type", "")
        assert "csv" in ct.lower() or "text" in ct.lower(), ct
        text = r.text
        # parse CSV
        reader = csv.reader(io.StringIO(text))
        rows = list(reader)
        assert len(rows) >= 1, "CSV empty"
        header = [h.strip().lower() for h in rows[0]]
        # detect region column
        try:
            r_idx = next(i for i, h in enumerate(header) if "regi" in h)
        except StopIteration:
            pytest.skip(f"CSV has no region column: {header}")
        # every data row's region cell should equal target region
        for row in rows[1:]:
            if len(row) > r_idx and row[r_idx].strip():
                assert row[r_idx].strip() == region, (
                    f"CSV leak: expected only {region} but got {row[r_idx]} | header={header}"
                )


# ---------- /custodies?region=X regression ----------
def test_list_filter_regression(headers, created):
    for region in ("São Paulo", "Guarulhos"):
        r = requests.get(f"{API}/custodies?region={region}&limit=500", headers=headers, timeout=30)
        assert r.status_code == 200
        items = r.json()
        # full isolation
        assert all(c["region"] == region for c in items), \
            f"region leak in /custodies?region={region}"


# ---------- MongoDB region index verification (via behavior) ----------
def test_indexes_endpoint_or_smoke(headers):
    # just hit list with a region filter and ensure timely response
    import time
    t0 = time.time()
    r = requests.get(f"{API}/custodies?region=São Paulo&limit=100", headers=headers, timeout=30)
    elapsed = time.time() - t0
    assert r.status_code == 200
    assert elapsed < 10, f"region filter too slow ({elapsed}s) - index may be missing"
