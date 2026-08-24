import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)
admin_headers = {"Authorization": "Bearer dev-admin"}
stocker_headers = {"Authorization": "Bearer dev-stocker"}
viewer_headers = {"Authorization": "Bearer dev-viewer"}

def test_tare_weights_crud_and_location_association():
    # 1. Create Tare Weight
    create_payload = {
        "name": "Small Blue Bin",
        "weight": 25.5
    }
    res = client.post("/tare-weights", json=create_payload, headers=admin_headers)
    assert res.status_code == 201
    tare_data = res.json()
    tare_id = tare_data["id"]
    assert tare_data["name"] == "Small Blue Bin"
    assert tare_data["weight"] == 25.5

    try:
        # 2. List Tare Weights
        list_res = client.get("/tare-weights", headers=admin_headers)
        assert list_res.status_code == 200
        tares = list_res.json()
        assert any(t["id"] == tare_id for t in tares)

        # 3. Update Tare Weight
        update_payload = {
            "name": "Small Blue Drawer Bin",
            "weight": 26.0
        }
        put_res = client.put(f"/tare-weights/{tare_id}", json=update_payload, headers=admin_headers)
        assert put_res.status_code == 200
        updated = put_res.json()
        assert updated["name"] == "Small Blue Drawer Bin"
        assert updated["weight"] == 26.0

        # 4. Create a Location to test linking
        loc_res = client.post("/locations", json={"name": "Test Bin Drawer"}, headers=admin_headers)
        assert loc_res.status_code == 201
        loc_id = loc_res.json()["id"]

        try:
            # 5. Count location and set last_tare_id
            count_res = client.put(
                f"/locations/{loc_id}/count",
                json={"quantity": 100, "last_tare_id": tare_id},
                headers=stocker_headers
            )
            assert count_res.status_code == 200
            loc_data = count_res.json()
            assert loc_data["last_tare_id"] == tare_id
            assert loc_data["last_tare"] is not None
            assert loc_data["last_tare"]["id"] == tare_id
            assert loc_data["last_tare"]["name"] == "Small Blue Drawer Bin"

            # 6. Clear tare (set to null)
            count_clear_res = client.put(
                f"/locations/{loc_id}/count",
                json={"quantity": 100, "last_tare_id": None, "set_last_tare": True},
                headers=stocker_headers
            )
            assert count_clear_res.status_code == 200
            loc_cleared = count_clear_res.json()
            assert loc_cleared["last_tare_id"] is None
            assert loc_cleared["last_tare"] is None

        finally:
            client.delete(f"/locations/{loc_id}", headers=admin_headers)

    finally:
        # Delete Tare Weight
        del_res = client.delete(f"/tare-weights/{tare_id}", headers=admin_headers)
        assert del_res.status_code == 204
