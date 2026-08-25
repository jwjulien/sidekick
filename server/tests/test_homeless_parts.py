import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)
admin_headers = {"Authorization": "Bearer dev-admin"}
stocker_headers = {"Authorization": "Bearer dev-stocker"}
analyst_headers = {"Authorization": "Bearer dev-analyst"}

def test_homeless_parts_workflow():
    # 1. Create Category
    cat_res = client.post("/categories", json={"title": "Homeless Test Cat", "designator": "HTC"}, headers=admin_headers)
    assert cat_res.status_code == 201
    cat_id = cat_res.json()["id"]

    # 2. Create Unassigned Part (Homeless)
    part_payload = {
        "category_id": cat_id,
        "value": "100k Resistor",
        "number": "HOM-RES-100K",
        "package": "0603",
        "threshold": 50,
        "notes": "Test homeless part"
    }
    part_res = client.post("/parts", json=part_payload, headers=stocker_headers)
    assert part_res.status_code == 201
    part_id = part_res.json()["id"]

    # 3. Check Homeless Parts List & Count
    count_res = client.get("/parts/homeless/count", headers=analyst_headers)
    assert count_res.status_code == 200
    initial_count = count_res.json()["count"]
    assert initial_count >= 1

    list_res = client.get("/parts/homeless", headers=analyst_headers)
    assert list_res.status_code == 200
    homeless_list = list_res.json()
    assert any(p["id"] == part_id for p in homeless_list)

    # 4. Create target storage location
    loc_payload = {
        "name": "Homeless Test Bin A",
        "description": "Destination bin for homeless triage"
    }
    loc_res = client.post("/locations", json=loc_payload, headers=admin_headers)
    assert loc_res.status_code == 201
    loc_id = loc_res.json()["id"]

    # 5. Assign Part to Location via POST /locations/assign
    assign_payload = {
        "part_id": part_id,
        "location_id": loc_id,
        "quantity": 120,
        "notes": "Assigned during triage unit test"
    }
    assign_res = client.post("/locations/assign", json=assign_payload, headers=stocker_headers)
    assert assign_res.status_code == 200
    assigned_storage = assign_res.json()
    assert assigned_storage["part_id"] == part_id
    assert assigned_storage["quantity"] == 120

    # 6. Verify Part is no longer homeless
    count_after = client.get("/parts/homeless/count", headers=analyst_headers)
    assert count_after.json()["count"] == initial_count - 1

    list_after = client.get("/parts/homeless", headers=analyst_headers)
    assert not any(p["id"] == part_id for p in list_after.json())

    # 7. Test Bulk Assignment
    # Create 2 new homeless parts
    part2 = client.post("/parts", json={"category_id": cat_id, "value": "22p Cap", "number": "HOM-CAP-22P"}, headers=stocker_headers).json()
    part3 = client.post("/parts", json={"category_id": cat_id, "value": "47uF Cap", "number": "HOM-CAP-47U"}, headers=stocker_headers).json()

    bulk_payload = {
        "part_ids": [part2["id"], part3["id"]],
        "location_id": loc_id,
        "quantity": 10
    }
    bulk_res = client.post("/locations/bulk-assign", json=bulk_payload, headers=stocker_headers)
    assert bulk_res.status_code == 200
    assert bulk_res.json()["assigned_count"] == 2

    # Clean up
    client.delete(f"/locations/{loc_id}", headers=admin_headers)
