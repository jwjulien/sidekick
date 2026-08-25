from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import desc, func
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
import csv
import io

from ..database import get_db
from .. import models, schemas, auth

router = APIRouter(
    prefix="/audit",
    tags=["audit"]
)

def log_audit_event(
    db: Session,
    entity_type: str,
    entity_id: str,
    action_type: str,
    user_id: Optional[str] = None,
    part_id: Optional[str] = None,
    location_id: Optional[str] = None,
    project_id: Optional[str] = None,
    reason_code: Optional[str] = None,
    quantity_change: float = 0.0,
    previous_state: Optional[dict] = None,
    new_state: Optional[dict] = None,
    method: str = "manual",
    notes: Optional[str] = None
) -> models.AuditLog:
    """
    Centralized service function to append an immutable AuditLog record to the SQLite ledger.
    """
    log_entry = models.AuditLog(
        entity_type=entity_type,
        entity_id=str(entity_id),
        action_type=action_type,
        user_id=user_id,
        part_id=part_id,
        location_id=location_id,
        project_id=project_id,
        reason_code=reason_code,
        quantity_change=quantity_change,
        previous_state=previous_state,
        new_state=new_state,
        method=method,
        notes=notes,
        created_at=datetime.utcnow()
    )
    db.add(log_entry)
    db.commit()
    db.refresh(log_entry)
    return log_entry

def _enrich_log_out(log: models.AuditLog, db: Session) -> schemas.AuditLogOut:
    """
    Enriches an AuditLog record with human-readable entity titles for client display.
    """
    log_dict = {
        "id": log.id,
        "part_id": log.part_id,
        "location_id": log.location_id,
        "project_id": log.project_id,
        "user_id": log.user_id,
        "entity_type": log.entity_type,
        "entity_id": log.entity_id,
        "action_type": log.action_type,
        "reason_code": log.reason_code,
        "quantity_change": log.quantity_change,
        "previous_state": log.previous_state,
        "new_state": log.new_state,
        "method": log.method,
        "notes": log.notes,
        "created_at": log.created_at,
        "part_name": None,
        "part_number": None,
        "location_name": None,
        "project_name": None,
        "user_name": None,
    }

    if log.part:
        log_dict["part_name"] = log.part.value
        log_dict["part_number"] = log.part.number
    elif log.part_id:
        part = db.query(models.Part).filter(models.Part.id == log.part_id).first()
        if part:
            log_dict["part_name"] = part.value
            log_dict["part_number"] = part.number

    if log.location:
        log_dict["location_name"] = log.location.name
    elif log.location_id:
        loc = db.query(models.Storage).filter(models.Storage.id == log.location_id).first()
        if loc:
            log_dict["location_name"] = loc.name

    if log.project:
        log_dict["project_name"] = log.project.title
    elif log.project_id:
        prj = db.query(models.Project).filter(models.Project.id == log.project_id).first()
        if prj:
            log_dict["project_name"] = prj.title

    if log.user:
        log_dict["user_name"] = log.user.username or log.user.email or "System User"
    elif log.user_id:
        u = db.query(models.User).filter(models.User.id == log.user_id).first()
        if u:
            log_dict["user_name"] = u.username or u.email or "System User"

    return schemas.AuditLogOut(**log_dict)

@router.get("/logs", response_model=List[schemas.AuditLogOut])
def get_audit_logs(
    entity_type: Optional[str] = Query(None),
    action_type: Optional[str] = Query(None),
    reason_code: Optional[str] = Query(None),
    method: Optional[str] = Query(None),
    part_id: Optional[str] = Query(None),
    location_id: Optional[str] = Query(None),
    project_id: Optional[str] = Query(None),
    user_id: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_any_user)
):
    """
    Fetch paginated, filtered audit logs from the immutable event ledger.
    """
    query = db.query(models.AuditLog)

    if entity_type:
        query = query.filter(models.AuditLog.entity_type == entity_type)
    if action_type:
        query = query.filter(models.AuditLog.action_type == action_type)
    if reason_code:
        query = query.filter(models.AuditLog.reason_code == reason_code)
    if method:
        query = query.filter(models.AuditLog.method == method)
    if part_id:
        query = query.filter(models.AuditLog.part_id == part_id)
    if location_id:
        query = query.filter(models.AuditLog.location_id == location_id)
    if project_id:
        query = query.filter(models.AuditLog.project_id == project_id)
    if user_id:
        query = query.filter(models.AuditLog.user_id == user_id)

    if start_date:
        try:
            dt_start = datetime.fromisoformat(start_date.replace("Z", ""))
            query = query.filter(models.AuditLog.created_at >= dt_start)
        except ValueError:
            pass

    if end_date:
        try:
            dt_end = datetime.fromisoformat(end_date.replace("Z", ""))
            query = query.filter(models.AuditLog.created_at <= dt_end)
        except ValueError:
            pass

    if search:
        search_pattern = f"%{search}%"
        query = query.outerjoin(models.Part, models.AuditLog.part_id == models.Part.id)\
                     .outerjoin(models.Storage, models.AuditLog.location_id == models.Storage.id)\
                     .outerjoin(models.User, models.AuditLog.user_id == models.User.id)\
                     .filter(
                         (models.AuditLog.notes.ilike(search_pattern)) |
                         (models.Part.value.ilike(search_pattern)) |
                         (models.Part.number.ilike(search_pattern)) |
                         (models.Storage.name.ilike(search_pattern)) |
                         (models.User.username.ilike(search_pattern))
                     )

    offset = (page - 1) * limit
    logs = query.order_by(desc(models.AuditLog.created_at)).offset(offset).limit(limit).all()

    return [_enrich_log_out(log, db) for log in logs]

@router.get("/stats", response_model=schemas.AuditLogStatsOut)
def get_audit_stats(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_any_user)
):
    """
    Get aggregated audit log metrics for the top dashboard banner.
    """
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)

    total_30d = db.query(func.count(models.AuditLog.id)).filter(
        models.AuditLog.created_at >= thirty_days_ago
    ).scalar() or 0

    discrepancies_30d = db.query(func.count(models.AuditLog.id)).filter(
        models.AuditLog.created_at >= thirty_days_ago,
        (models.AuditLog.reason_code == "cycle_count_adjustment") | 
        (models.AuditLog.reason_code == "scrap_damage") |
        (models.AuditLog.action_type == "discrepancy_flagged")
    ).scalar() or 0

    scale_reconciliations_30d = db.query(func.count(models.AuditLog.id)).filter(
        models.AuditLog.created_at >= thirty_days_ago,
        models.AuditLog.method == "scale"
    ).scalar() or 0

    # Reason breakdown
    reasons = db.query(models.AuditLog.reason_code, func.count(models.AuditLog.id)).filter(
        models.AuditLog.created_at >= thirty_days_ago,
        models.AuditLog.reason_code.isnot(None)
    ).group_by(models.AuditLog.reason_code).all()
    reason_breakdown = {r[0]: r[1] for r in reasons if r[0]}

    # Action breakdown
    actions = db.query(models.AuditLog.action_type, func.count(models.AuditLog.id)).filter(
        models.AuditLog.created_at >= thirty_days_ago
    ).group_by(models.AuditLog.action_type).all()
    action_breakdown = {a[0]: a[1] for a in actions if a[0]}

    return schemas.AuditLogStatsOut(
        total_events_30d=total_30d,
        discrepancy_count_30d=discrepancies_30d,
        scale_reconciliations_30d=scale_reconciliations_30d,
        reason_breakdown=reason_breakdown,
        action_breakdown=action_breakdown
    )

@router.get("/export")
def export_audit_logs_csv(
    entity_type: Optional[str] = Query(None),
    action_type: Optional[str] = Query(None),
    reason_code: Optional[str] = Query(None),
    method: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_analyst)
):
    """
    Stream audit logs in CSV format for spreadsheet reporting and backup archives.
    """
    query = db.query(models.AuditLog)

    if entity_type:
        query = query.filter(models.AuditLog.entity_type == entity_type)
    if action_type:
        query = query.filter(models.AuditLog.action_type == action_type)
    if reason_code:
        query = query.filter(models.AuditLog.reason_code == reason_code)
    if method:
        query = query.filter(models.AuditLog.method == method)

    if search:
        search_pattern = f"%{search}%"
        query = query.outerjoin(models.Part, models.AuditLog.part_id == models.Part.id)\
                     .outerjoin(models.Storage, models.AuditLog.location_id == models.Storage.id)\
                     .filter(
                         (models.AuditLog.notes.ilike(search_pattern)) |
                         (models.Part.value.ilike(search_pattern)) |
                         (models.Part.number.ilike(search_pattern)) |
                         (models.Storage.name.ilike(search_pattern))
                     )

    logs = query.order_by(desc(models.AuditLog.created_at)).limit(5000).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Audit Log ID", "Timestamp (UTC)", "Entity Type", "Entity ID",
        "Action Type", "Reason Code", "Quantity Change", "Method",
        "User", "Part Number", "Part Name", "Location Name", "Notes"
    ])

    for log in logs:
        enriched = _enrich_log_out(log, db)
        writer.writerow([
            enriched.id,
            enriched.created_at.isoformat(),
            enriched.entity_type,
            enriched.entity_id,
            enriched.action_type,
            enriched.reason_code or "",
            enriched.quantity_change,
            enriched.method,
            enriched.user_name or "",
            enriched.part_number or "",
            enriched.part_name or "",
            enriched.location_name or "",
            enriched.notes or ""
        ])

    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode("utf-8")),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=sidekick_audit_export_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"}
    )

