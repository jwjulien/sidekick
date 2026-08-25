import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)
admin_headers = {"Authorization": "Bearer dev-admin"}
stocker_headers = {"Authorization": "Bearer dev-stocker"}
analyst_headers = {"Authorization": "Bearer dev-analyst"}

def test_parts_browser_query_filtering():
    # 1. Create Category
    cat_res = client.post("/categories", json={"title": "Browser Test Cat", "designator": "BTC"}, headers=admin_headers)
    assert cat_res.status_code == 201
    cat_id = cat_res.json()["id"]

    # 2. Create Parts (one low stock, one normal)
    p1 = client.post("/parts", json={
        "category_id": cat_id,
        "value": "1k Resistor",
        "number": "BROWSER-RES-1K",
        "package": "0805",
        "threshold": 100,
        "notes": "Low stock test item"
    }, headers=stocker_headers).json()

    p2 = client.post("/parts", json={
        "category_id": cat_id,
        "value": "100nF Cap",
        "number": "BROWSER-CAP-100N",
        "package": "0603",
        "threshold": 10,
        "notes": "High stock test item"
    }, headers=stocker_headers).json()

    # 3. Test Search Filter
    res_search = client.get("/parts?search=BROWSER-RES", headers=analyst_headers)
    assert res_search.status_code == 200
    search_data = res_search.json()
    assert any(p["id"] == p1["id"] for p in search_data)
    assert not any(p["id"] == p2["id"] for p in search_data)

    # 4. Test Category Filter
    res_cat = client.get(f"/parts?category_id={cat_id}", headers=analyst_headers)
    assert res_cat.status_code == 200
    cat_data = res_cat.json()
    assert len(cat_data) >= 2

    # 5. Test Unassigned Filter
    res_unassigned = client.get("/parts?is_unassigned=true", headers=analyst_headers)
    assert res_unassigned.status_code == 200
    unassigned_data = res_unassigned.json()
    assert any(p["id"] == p1["id"] for p in unassigned_data)

    # 6. Test Sorting
    res_sort = client.get("/parts?sort_by=number&sort_order=asc", headers=analyst_headers)
    assert res_sort.status_code == 200

    # Clean up created parts
    client.delete(f"/parts/{p1['id']}", headers=admin_headers)
    client.delete(f"/parts/{p2['id']}", headers=admin_headers)
