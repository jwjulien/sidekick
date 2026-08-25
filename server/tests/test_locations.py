import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)
admin_headers = {"Authorization": "Bearer dev-admin"}
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

