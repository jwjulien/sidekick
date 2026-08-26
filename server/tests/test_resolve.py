import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)
admin_headers = {"Authorization": "Bearer dev-admin"}

def test_resolve_location_by_uuid_and_deeplink():
    # 1. Create parent cabinet location
    parent_res = client.post("/locations", json={"name": "Cabinet X", "description": "Test cabinet"}, headers=admin_headers)
    assert parent_res.status_code == 201
    parent = parent_res.json()

    # 2. Create child drawer location
    child_res = client.post("/locations", json={"name": "Drawer 2", "parent_id": parent["id"], "description": "Test drawer"}, headers=admin_headers)
    assert child_res.status_code == 201
    child = child_res.json()

    # 3. Test resolution by raw UUID
    res1 = client.get(f"/resolve/{child['id']}", headers=admin_headers)
    assert res1.status_code == 200
    data1 = res1.json()
    assert data1["entity_type"] == "location"
    assert data1["entity_id"] == child["id"]
    assert data1["breadcrumb"] == "Cabinet X > Drawer 2"
    assert data1["target_route"] == f"/storage?location={child['id']}"

    # 4. Test resolution by fuse:// location deep link
    res2 = client.get(f"/resolve/fuse://location/{child['id']}", headers=admin_headers)
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2["entity_type"] == "location"
    assert data2["entity_id"] == child["id"]
    assert data2["breadcrumb"] == "Cabinet X > Drawer 2"

def test_resolve_part_by_uuid_and_deeplink():
    # Create category first
    cat_res = client.post("/categories", json={"title": "Resistors", "designator": "R"}, headers=admin_headers)
    assert cat_res.status_code == 201
    cat_id = cat_res.json()["id"]

    # Create part
    part_payload = {
        "category_id": cat_id,
        "number": "RES-10K-NFC-TEST",
        "value": "10k 0805",
        "package": "0805"
    }
    part_res = client.post("/parts", json=part_payload, headers=admin_headers)
    assert part_res.status_code == 201
    part = part_res.json()

    # Test fuse://part/{id} resolution
    res = client.get(f"/resolve/fuse://part/{part['id']}", headers=admin_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["entity_type"] == "part"
    assert data["entity_id"] == part["id"]
    assert data["target_route"] == f"/parts/{part['id']}"

def test_resolve_missing_entity_returns_404():
    res = client.get("/resolve/fuse://location/non-existent-uuid-9999", headers=admin_headers)
    assert res.status_code == 404
