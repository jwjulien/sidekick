import pytest
from app.database import get_db
from app.models import AuditLog, Part, Storage
from app.routers.audit import log_audit_event

admin_headers = {"Authorization": "Bearer dev-admin"}

def test_log_audit_event(client):
    db = next(get_db())
    
    # Log test event directly
    entry = log_audit_event(
        db=db,
        entity_type="part",
        entity_id="test_part_123",
        action_type="create",
        reason_code="initial_stocking",
        quantity_change=50.0,
        previous_state={"quantity": 0},
        new_state={"quantity": 50},
        method="manual",
        notes="UnitTest part creation"
    )
    
    assert entry.id is not None
    assert entry.entity_type == "part"
    assert entry.action_type == "create"
    assert entry.reason_code == "initial_stocking"
    assert entry.quantity_change == 50.0

def test_get_audit_logs(client):
    response = client.get("/audit/logs", headers=admin_headers)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1

def test_get_audit_stats(client):
    response = client.get("/audit/stats", headers=admin_headers)
    assert response.status_code == 200
    data = response.json()
    assert "total_events_30d" in data
    assert "discrepancy_count_30d" in data
    assert "scale_reconciliations_30d" in data

def test_export_audit_csv(client):
    response = client.get("/audit/export", headers=admin_headers)
    assert response.status_code == 200
    assert "text/csv" in response.headers.get("content-type", "")
    assert "Audit Log ID" in response.text
