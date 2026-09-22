import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)
admin_headers = {"Authorization": "Bearer dev-admin"}
stocker_headers = {"Authorization": "Bearer dev-stocker"}
viewer_headers = {"Authorization": "Bearer dev-viewer"}

def test_2d_storage_grid_direct_children():
    # 1. Create 2D Grid Storage Root
    grid_payload = {
        "name": "Test 2D Grid",
        "description": "5x5 Component Tray",
        "dimensions": [5, 5],
        "label_scheme": "ALPHA_NUMERIC"
    }
    res = client.post("/locations", json=grid_payload, headers=admin_headers)
    assert res.status_code == 201
    grid = res.json()
    grid_id = grid["id"]
    assert grid["dimensions"] == [5, 5]

    try:
        # 2. Create direct child cell under 2D Grid at row 1, col 2 (flat_index = 1*5 + 2 = 7)
        cell_payload = {
            "name": "Bin B3",
            "parent_id": grid_id,
            "index": 7,
            "description": "Slot B3"
        }
        cell_res = client.post("/locations", json=cell_payload, headers=admin_headers)
        assert cell_res.status_code == 201
        cell = cell_res.json()
        cell_id = cell["id"]
        
        # Verify cell is a DIRECT child of the 2D grid root
        assert cell["parent_id"] == grid_id
        assert cell["index"] == 7

        # 3. Test layout resizing bounds check
        # Attempt to shrink grid to 2x2 (max capacity = 4), cell index 7 should fail
        resize_res = client.put(f"/locations/{grid_id}/layout", json={"dimensions": [2, 2]}, headers=admin_headers)
        assert resize_res.status_code == 400
        assert "child item out of bounds" in resize_res.json()["detail"]

        # Expand grid to 10x10 (valid)
        resize_valid = client.put(f"/locations/{grid_id}/layout", json={"dimensions": [10, 10]}, headers=admin_headers)
        assert resize_valid.status_code == 200
        assert resize_valid.json()["dimensions"] == [10, 10]

        # 4. Attempt to delete 2D grid while it contains direct child cell (should fail)
        del_res = client.delete(f"/locations/{grid_id}", headers=admin_headers)
        assert del_res.status_code == 400
        assert "Cannot delete" in del_res.json()["detail"]

        # Clean up cell first
        del_cell = client.delete(f"/locations/{cell_id}", headers=admin_headers)
        assert del_cell.status_code == 204

    finally:
        # Clean up grid
        client.delete(f"/locations/{grid_id}", headers=admin_headers)

def test_delete_location_zero_quantity_part():
    # Create category and part
    cat_res = client.post("/categories", json={"title": "Delete Test Cat", "designator": "DTC"}, headers=admin_headers)
    cat_id = cat_res.json()["id"]

    part_res = client.post("/parts", json={"category_id": cat_id, "value": "Test Part Del", "number": "TP-DEL-01"}, headers={"Authorization": "Bearer dev-stocker"})
    part_id = part_res.json()["id"]

    # Create location with assigned part and quantity = 10
    loc_res = client.post("/locations", json={"name": "Zero Qty Del Bin", "part_id": part_id, "quantity": 10}, headers=admin_headers)
    loc_id = loc_res.json()["id"]

    # Deleting while quantity > 0 should fail with 400
    del_fail = client.delete(f"/locations/{loc_id}", headers=admin_headers)
    assert del_fail.status_code == 400
    assert "active part stock" in del_fail.json()["detail"]

    # Set quantity to 0
    count_res = client.put(f"/locations/{loc_id}/count", json={"quantity": 0}, headers={"Authorization": "Bearer dev-stocker"})
    assert count_res.status_code == 200

    # Deleting while quantity == 0 should succeed with 204
    del_ok = client.delete(f"/locations/{loc_id}", headers=admin_headers)
    assert del_ok.status_code == 204

def test_collapse_location_to_parent():
    # 1. Create parent location (Grandparent / Drawer)
    parent_res = client.post("/locations", json={"name": "Parent Drawer"}, headers=admin_headers)
    assert parent_res.status_code == 201
    parent_id = parent_res.json()["id"]

    # 2. Create category and part
    cat_res = client.post("/categories", json={"title": "Collapse Cat", "designator": "CC"}, headers=admin_headers)
    cat_id = cat_res.json()["id"]

    part_res = client.post("/parts", json={"category_id": cat_id, "value": "10k Res", "number": "RES-10K"}, headers=admin_headers)
    part_id = part_res.json()["id"]

    # 3. Create child location under parent with assigned part and quantity = 25
    child_res = client.post("/locations", json={"name": "Divider A", "parent_id": parent_id, "part_id": part_id, "quantity": 25}, headers=admin_headers)
    assert child_res.status_code == 201
    child_id = child_res.json()["id"]

    # 4. Perform collapse via POST /locations/{child_id}/collapse
    collapse_res = client.post(f"/locations/{child_id}/collapse", headers=admin_headers)
    assert collapse_res.status_code == 200
    updated_parent = collapse_res.json()
    assert updated_parent["id"] == parent_id
    assert updated_parent["part_id"] == part_id
    assert updated_parent["quantity"] == 25

    # Verify child location was deleted
    get_child = client.get(f"/locations/{child_id}", headers=admin_headers)
    assert get_child.status_code == 404

def test_assign_part_to_occupied_location_splits_into_leaves():
    # 1. Create category and two parts
    cat_res = client.post("/categories", json={"title": "Split Cat", "designator": "SC"}, headers=admin_headers)
    cat_id = cat_res.json()["id"]

    part1_res = client.post("/parts", json={"category_id": cat_id, "value": "100uF Cap", "number": "CAP-100U"}, headers=admin_headers)
    part1_id = part1_res.json()["id"]

    part2_res = client.post("/parts", json={"category_id": cat_id, "value": "220uF Cap", "number": "CAP-220U"}, headers=admin_headers)
    part2_id = part2_res.json()["id"]

    # 2. Create location L with part1 assigned and quantity = 50
    loc_res = client.post("/locations", json={"name": "Bin 1", "part_id": part1_id, "quantity": 50}, headers=admin_headers)
    assert loc_res.status_code == 201
    loc_id = loc_res.json()["id"]
    assert loc_res.json()["part_id"] == part1_id
    assert loc_res.json()["quantity"] == 50

    # 3. Assign part2 to the occupied location L
    assign_res = client.post("/locations/assign", json={"location_id": loc_id, "part_id": part2_id, "quantity": 15}, headers=admin_headers)
    assert assign_res.status_code == 200
    target = assign_res.json()

    # Target storage should be a new sub-bin created under loc_id
    assert target["parent_id"] == loc_id
    assert target["part_id"] == part2_id
    assert target["quantity"] == 15

    # Parent location loc_id should now have part_id = None and quantity = 0
    parent_check = client.get(f"/locations/{loc_id}", headers=admin_headers).json()
    assert parent_check["part_id"] is None
    assert parent_check["quantity"] == 0

    # Fetch all children of loc_id to verify both sub-locations exist as leaves
    all_locs = client.get("/locations?flat=true", headers=admin_headers).json()
    children = [l for l in all_locs if l.get("parent_id") == loc_id]
    assert len(children) == 2

    # Check child 1 (Original Part)
    orig_child = next(c for c in children if c["part_id"] == part1_id)
    assert orig_child["name"] == "100uF Cap"
    assert orig_child["quantity"] == 50

    # Check child 2 (New Part)
    new_child = next(c for c in children if c["part_id"] == part2_id)
    assert new_child["name"] == "220uF Cap"
    assert new_child["quantity"] == 15


def test_storage_lifecycle_timestamps():
    # 1. Setup category & part
    cat = client.post("/categories", json={"title": "Timestamp Test Cat", "designator": "TTC"}, headers=admin_headers).json()
    part = client.post("/parts", json={"category_id": cat["id"], "value": "1k Resistor", "number": "RES-1K"}, headers=stocker_headers).json()

    # 2. Create location with part and stock
    loc_res = client.post("/locations", json={"name": "Lifecycle Bin", "part_id": part["id"], "quantity": 50}, headers=admin_headers)
    assert loc_res.status_code == 201
    loc_data = loc_res.json()
    loc_id = loc_data["id"]

    assert loc_data["first_added"] is not None
    assert loc_data["last_stocked"] is not None
    assert loc_data["last_used"] is None
    assert loc_data["last_counted"] is None

    # 3. Touch location: updates last_counted only
    touch_res = client.put(f"/locations/{loc_id}/touch", headers=admin_headers)
    assert touch_res.status_code == 200
    touch_data = touch_res.json()
    assert touch_data["last_counted"] is not None
    assert touch_data["last_used"] is None

    # 4. Count up (positive delta: 50 -> 75): updates last_stocked & last_counted
    count_up = client.put(f"/locations/{loc_id}/count", json={"quantity": 75}, headers=stocker_headers).json()
    assert count_up["quantity"] == 75
    assert count_up["last_stocked"] is not None

    # 5. Count down (negative delta: 75 -> 60): updates last_used & last_counted
    count_down = client.put(f"/locations/{loc_id}/count", json={"quantity": 60}, headers=stocker_headers).json()
    assert count_down["quantity"] == 60
    assert count_down["last_used"] is not None



