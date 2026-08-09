import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)
admin_headers = {"Authorization": "Bearer dev-admin"}
stocker_headers = {"Authorization": "Bearer dev-stocker"}

def test_supplier_crud():
    # Create Supplier
    import uuid
    uid = str(uuid.uuid4())[:8]
    res = client.post("/suppliers", json={"name": f"DigiTest {uid}", "website": "https://test.com", "search": "https://test.com/?q="}, headers=admin_headers)
    assert res.status_code == 201
    supplier_id = res.json()["id"]
    
    # Update Supplier
    res = client.put(f"/suppliers/{supplier_id}", json={"name": "DigiTest Updated"}, headers=admin_headers)
    assert res.status_code == 200
    assert res.json()["name"] == "DigiTest Updated"
    
    # Delete Supplier
    res = client.delete(f"/suppliers/{supplier_id}", headers=admin_headers)
    assert res.status_code == 204

def test_delete_supplier_blocked_by_product():
    # Create Supplier
    import uuid
    uid = str(uuid.uuid4())[:8]
    sup_res = client.post("/suppliers", json={"name": f"Supplier Linked {uid}", "website": "https://test.com", "search": "https://test.com/?q="}, headers=admin_headers)
    sup_id = sup_res.json()["id"]
    
    # Create Part (Need a part to link to product)
    # We will assume a part already exists or create one if we can
    # Actually, we can create a category and a part
    cat_res = client.post("/categories", json={"title": f"Test Cat {uid}"}, headers=admin_headers)
    cat_id = cat_res.json()["id"]
    
    part_res = client.post("/parts", json={"category_id": cat_id, "value": "10k", "number": f"R-{uid}"}, headers=admin_headers)
    part_id = part_res.json()["id"]
    
    # Create Product Link
    prod_res = client.post("/products", json={"supplier_id": sup_id, "part_id": part_id, "sku": "123-ND"}, headers=stocker_headers)
    prod_id = prod_res.json()["id"]
    
    # Try deleting Supplier (should block)
    del_res = client.delete(f"/suppliers/{sup_id}", headers=admin_headers)
    assert del_res.status_code == 400
    
    # Clean up (delete product first, then supplier)
    client.delete(f"/products/{prod_id}", headers=stocker_headers)
    client.delete(f"/suppliers/{sup_id}", headers=admin_headers)
    client.delete(f"/items/{part_id}", headers=admin_headers)
    client.delete(f"/categories/{cat_id}", headers=admin_headers)
