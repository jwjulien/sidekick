import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)
admin_headers = {"Authorization": "Bearer dev-admin"}
stocker_headers = {"Authorization": "Bearer dev-stocker"}
viewer_headers = {"Authorization": "Bearer dev-viewer"}

def test_part_lists_crud_and_duplicate():
    # 1. Create Category and Part
    cat_res = client.post("/categories", json={"title": "List Test Category"}, headers=admin_headers)
    assert cat_res.status_code == 201
    cat_id = cat_res.json()["id"]

    part_res = client.post("/parts", json={
        "category_id": cat_id,
        "value": "10k Resistor",
        "number": "LIST-RES-10K",
        "package": "0805"
    }, headers=stocker_headers)
    assert part_res.status_code == 201
    part_id = part_res.json()["id"]

    # 2. Create Part List
    list_res = client.post("/lists", json={
        "name": "DigiKey Wishlist",
        "description": "Parts to order next week",
        "type": "Wishlist",
        "is_active": True
    }, headers=stocker_headers)
    assert list_res.status_code == 201
    list_data = list_res.json()
    list_id = list_data["id"]
    assert list_data["name"] == "DigiKey Wishlist"
    assert list_data["is_active"] is True

    # 3. Add Item to List
    item_res = client.post(f"/lists/{list_id}/items", json={
        "part_id": part_id,
        "quantity": 5.0,
        "notes": "Verify footprint"
    }, headers=stocker_headers)
    assert item_res.status_code == 201
    item_data = item_res.json()
    assert item_data["quantity"] == 5.0
    assert item_data["notes"] == "Verify footprint"
    item_id = item_data["id"]

    # 3b. Duplicate Add should return 409 Conflict
    dup_add_res = client.post(f"/lists/{list_id}/items", json={
        "part_id": part_id,
        "quantity": 2.0
    }, headers=stocker_headers)
    assert dup_add_res.status_code == 409
    assert dup_add_res.json()["detail"] == "Item already in list"

    # 4. Get List Details
    details_res = client.get(f"/lists/{list_id}", headers=viewer_headers)
    assert details_res.status_code == 200
    details = details_res.json()
    assert len(details["items"]) == 1
    assert details["items"][0]["part"]["number"] == "LIST-RES-10K"

    # 5. Update Item Quantity & Notes
    update_item_res = client.put(f"/lists/{list_id}/items/{item_id}", json={
        "quantity": 10.0,
        "notes": "Updated note: Order extra"
    }, headers=stocker_headers)
    assert update_item_res.status_code == 200
    assert update_item_res.json()["quantity"] == 10.0

    # 6. Duplicate List
    dup_res = client.post(f"/lists/{list_id}/duplicate", headers=stocker_headers)
    assert dup_res.status_code == 201
    dup_data = dup_res.json()
    assert dup_data["name"] == "Copy of DigiKey Wishlist"

    # Verify duplicated list has 1 item
    dup_details = client.get(f"/lists/{dup_data['id']}", headers=viewer_headers).json()
    assert len(dup_details["items"]) == 1
    assert dup_details["items"][0]["quantity"] == 10.0

    # 7. CSV Export
    csv_res = client.get(f"/lists/{list_id}/export", headers=viewer_headers)
    assert csv_res.status_code == 200
    assert "text/csv" in csv_res.headers["content-type"]
    csv_text = csv_res.text
    assert "LIST-RES-10K" in csv_text
    assert "10.0" in csv_text

    # 8. Delete List Item and List
    del_item_res = client.delete(f"/lists/{list_id}/items/{item_id}", headers=stocker_headers)
    assert del_item_res.status_code == 204

    del_list_res = client.delete(f"/lists/{list_id}", headers=stocker_headers)
    assert del_list_res.status_code == 204

    # Verify list is gone
    get_gone = client.get(f"/lists/{list_id}", headers=viewer_headers)
    assert get_gone.status_code == 404
