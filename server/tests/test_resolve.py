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

def test_resolve_hierarchical_path_and_ancestor_fallback():
    # 1. Create hierarchy: Rack ResolvTree -> Shelf One -> Bin 42
    rack_res = client.post("/locations", json={"name": "Rack ResolvTree", "description": "Top rack"}, headers=admin_headers)
    assert rack_res.status_code == 201
    rack = rack_res.json()

    shelf_res = client.post("/locations", json={"name": "Shelf One", "parent_id": rack["id"]}, headers=admin_headers)
    assert shelf_res.status_code == 201
    shelf = shelf_res.json()

    bin_res = client.post("/locations", json={"name": "Bin 42", "parent_id": shelf["id"]}, headers=admin_headers)
    assert bin_res.status_code == 201
    bin_node = bin_res.json()

    # 2. Test exact hierarchical path matching with underscores
    res_exact = client.get("/resolve/fuse://location/Rack_ResolvTree/Shelf_One/Bin_42", headers=admin_headers)
    assert res_exact.status_code == 200
    d_exact = res_exact.json()
    assert d_exact["entity_type"] == "location"
    assert d_exact["entity_id"] == bin_node["id"]
    assert d_exact["match_type"] == "exact"
    assert d_exact["fallback_ancestor"] is None
    assert d_exact["breadcrumb"] == "Rack ResolvTree > Shelf One > Bin 42"

    # 3. Test leaf missing -> fallback to immediate ancestor (Shelf One)
    res_fallback_leaf = client.get("/resolve/fuse://location/Rack_ResolvTree/Shelf_One/Bin_Deleted", headers=admin_headers)
    assert res_fallback_leaf.status_code == 200
    d_fallback_leaf = res_fallback_leaf.json()
    assert d_fallback_leaf["entity_type"] == "location"
    assert d_fallback_leaf["entity_id"] == shelf["id"]
    assert d_fallback_leaf["match_type"] == "ancestor_fallback"
    assert d_fallback_leaf["fallback_ancestor"] == "Shelf One"
    assert d_fallback_leaf["breadcrumb"] == "Rack ResolvTree > Shelf One"

    # 4. Test intermediate missing -> fallback to root (Rack ResolvTree)
    res_fallback_root = client.get("/resolve/location/Rack_ResolvTree/NonExistent_Shelf/Any_Bin", headers=admin_headers)
    assert res_fallback_root.status_code == 200
    d_fallback_root = res_fallback_root.json()
    assert d_fallback_root["entity_type"] == "location"
    assert d_fallback_root["entity_id"] == rack["id"]
    assert d_fallback_root["match_type"] == "ancestor_fallback"
    assert d_fallback_root["fallback_ancestor"] == "Rack ResolvTree"
    assert d_fallback_root["breadcrumb"] == "Rack ResolvTree"

    # 5. Test completely unknown path -> 404
    res_unknown = client.get("/resolve/location/Ghost_Rack/Shelf_1", headers=admin_headers)
    assert res_unknown.status_code == 404

