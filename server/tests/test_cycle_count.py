import pytest
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)
admin_headers = {"Authorization": "Bearer dev-admin"}
stocker_headers = {"Authorization": "Bearer dev-stocker"}

def test_cycle_count_route_and_stale_count():
    # 1. Setup category & parts
    cat_res = client.post("/categories", json={"title": "Cycle Count Cat", "designator": "CCC"}, headers=admin_headers)
    cat_id = cat_res.json()["id"]

    p1_res = client.post("/parts", json={"category_id": cat_id, "value": "Resistor 100k", "number": "RES-100K"}, headers=stocker_headers)
    p1_id = p1_res.json()["id"]

    p2_res = client.post("/parts", json={"category_id": cat_id, "value": "Capacitor 10uF", "number": "CAP-10U"}, headers=stocker_headers)
    p2_id = p2_res.json()["id"]

    # 2. Setup storage hierarchy (Rack -> Drawer -> Bins)
    rack_res = client.post("/locations", json={"name": "Rack Alpha"}, headers=admin_headers)
    rack_id = rack_res.json()["id"]

    drawer_res = client.post("/locations", json={"name": "Drawer 2", "parent_id": rack_id}, headers=admin_headers)
    drawer_id = drawer_res.json()["id"]

    # Bin B (Name starts with B, should sort after Bin A physically)
    bin_b_res = client.post("/locations", json={"name": "Bin B", "parent_id": drawer_id, "part_id": p2_id, "quantity": 42}, headers=admin_headers)
    bin_b_id = bin_b_res.json()["id"]

    # Bin A (Name starts with A, should sort before Bin B)
    bin_a_res = client.post("/locations", json={"name": "Bin A", "parent_id": drawer_id, "part_id": p1_id, "quantity": 100}, headers=admin_headers)
    bin_a_id = bin_a_res.json()["id"]

    try:
        # 3. Check stale count API
        stale_res = client.get("/locations/stale-count?days_stale=30", headers=admin_headers)
        assert stale_res.status_code == 200
        stale_data = stale_res.json()
        assert stale_data["stale_count"] >= 2

        # 4. Fetch audit route (CTE path query)
        audit_res = client.get("/locations/audit?days_stale=30", headers=admin_headers)
        assert audit_res.status_code == 200
        items = audit_res.json()
        
        # Verify Bin A and Bin B are in items and sorted hierarchically
        bin_a_item = next((i for i in items if i["id"] == bin_a_id), None)
        bin_b_item = next((i for i in items if i["id"] == bin_b_id), None)

        assert bin_a_item is not None
        assert bin_b_item is not None

        assert bin_a_item["path"] == "Rack Alpha / Drawer 2 / Bin A"
        assert bin_b_item["path"] == "Rack Alpha / Drawer 2 / Bin B"
        assert bin_a_item["part_name"] == "Resistor 100k"
        assert bin_b_item["part_name"] == "Capacitor 10uF"

        # Index check: Bin A should precede Bin B due to ORDER BY path ASC
        idx_a = items.index(bin_a_item)
        idx_b = items.index(bin_b_item)
        assert idx_a < idx_b

        # 5. Confirm count on Bin A via PUT /locations/{id}/count
        count_res = client.put(f"/locations/{bin_a_id}/count", json={"quantity": 105, "reason_code": "cycle_count_adjustment", "notes": "Audit count"}, headers=stocker_headers)
        assert count_res.status_code == 200
        assert count_res.json()["quantity"] == 105
        assert count_res.json()["last_counted"] is not None

        # Confirm touch on Bin B via PUT /locations/{id}/touch
        touch_res = client.put(f"/locations/{bin_b_id}/touch", headers=admin_headers)
        assert touch_res.status_code == 200
        assert touch_res.json()["last_counted"] is not None

        # 6. Verify Bin A and Bin B are no longer in audit route for days_stale=30
        audit_after = client.get("/locations/audit?days_stale=30", headers=admin_headers).json()
        assert not any(i["id"] == bin_a_id for i in audit_after)
        assert not any(i["id"] == bin_b_id for i in audit_after)

    finally:
        # Cleanup
        client.delete(f"/locations/{bin_a_id}", headers=admin_headers)
        client.delete(f"/locations/{bin_b_id}", headers=admin_headers)
        client.delete(f"/locations/{drawer_id}", headers=admin_headers)
        client.delete(f"/locations/{rack_id}", headers=admin_headers)
