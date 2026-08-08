import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)
admin_headers = {"Authorization": "Bearer dev-admin"}

def test_project_crud():
    # Create Project
    res = client.post("/projects", json={"title": "Test Proj", "description": "Desc"}, headers=admin_headers)
    assert res.status_code == 201
    proj_id = res.json()["id"]
    
    # Update Project
    res = client.put(f"/projects/{proj_id}", json={"title": "Updated Proj"}, headers=admin_headers)
    assert res.status_code == 200
    assert res.json()["title"] == "Updated Proj"
    
    # Delete Project
    res = client.delete(f"/projects/{proj_id}", headers=admin_headers)
    assert res.status_code == 204

def test_delete_project_blocked_by_assembly():
    # Create Project
    proj_res = client.post("/projects", json={"title": "Proj With Assem", "description": ""}, headers=admin_headers)
    proj_id = proj_res.json()["id"]
    
    # Create Assembly
    assem_res = client.post("/projects/assemblies", json={"project_id": proj_id, "name": "Assem 1"}, headers=admin_headers)
    assem_id = assem_res.json()["id"]
    
    # Try deleting Project (should block)
    del_res = client.delete(f"/projects/{proj_id}", headers=admin_headers)
    assert del_res.status_code == 400
    
    # Clean up (delete assembly first, then project)
    client.delete(f"/projects/assemblies/{assem_id}", headers=admin_headers)
    client.delete(f"/projects/{proj_id}", headers=admin_headers)

def test_assembly_update():
    # Create Project
    proj_res = client.post("/projects", json={"title": "Proj 2", "description": ""}, headers=admin_headers)
    proj_id = proj_res.json()["id"]
    
    # Create Assembly
    assem_res = client.post("/projects/assemblies", json={"project_id": proj_id, "name": "Assem 1"}, headers=admin_headers)
    assem_id = assem_res.json()["id"]
    
    # Update Assembly
    upd_res = client.put(f"/projects/assemblies/{assem_id}", json={"name": "Assem Updated"}, headers=admin_headers)
    assert upd_res.status_code == 200
    assert upd_res.json()["name"] == "Assem Updated"
    
    # Clean up
    client.delete(f"/projects/assemblies/{assem_id}", headers=admin_headers)
    client.delete(f"/projects/{proj_id}", headers=admin_headers)
