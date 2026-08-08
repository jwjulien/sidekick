import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)
admin_headers = {"Authorization": "Bearer dev-admin"}
viewer_headers = {"Authorization": "Bearer dev-viewer"}

def test_get_categories():
    response = client.get("/categories", headers=admin_headers)
    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_create_category():
    # Create category
    payload = {"title": "Test Category", "designator": "TC"}
    response = client.post("/categories", json=payload, headers=admin_headers)
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Test Category"
    assert data["designator"] == "TC"
    
    # Clean up
    cat_id = data["id"]
    delete_response = client.delete(f"/categories/{cat_id}", headers=admin_headers)
    assert delete_response.status_code == 204

def test_create_category_viewer_forbidden():
    payload = {"title": "Test Category 2"}
    response = client.post("/categories", json=payload, headers=viewer_headers)
    assert response.status_code == 403

def test_update_category():
    # Create category
    response = client.post("/categories", json={"title": "Update Me"}, headers=admin_headers)
    assert response.status_code == 201
    cat_id = response.json()["id"]

    # Update category
    update_payload = {"title": "Updated Title", "designator": "UPD"}
    update_response = client.put(f"/categories/{cat_id}", json=update_payload, headers=admin_headers)
    assert update_response.status_code == 200
    assert update_response.json()["title"] == "Updated Title"
    
    # Clean up
    client.delete(f"/categories/{cat_id}", headers=admin_headers)

def test_prevent_deletion_with_children():
    # Create parent
    parent_res = client.post("/categories", json={"title": "Parent"}, headers=admin_headers)
    parent_id = parent_res.json()["id"]
    
    # Create child
    child_res = client.post("/categories", json={"title": "Child", "parent_id": parent_id}, headers=admin_headers)
    child_id = child_res.json()["id"]
    
    # Attempt to delete parent
    del_parent_res = client.delete(f"/categories/{parent_id}", headers=admin_headers)
    assert del_parent_res.status_code == 400
    assert "subcategories" in del_parent_res.json()["detail"]
    
    # Clean up (must delete child first)
    client.delete(f"/categories/{child_id}", headers=admin_headers)
    client.delete(f"/categories/{parent_id}", headers=admin_headers)
