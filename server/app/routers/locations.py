from typing import List, Optional
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import text, func
from ..database import get_db
from .. import models, schemas, auth
from .audit import log_audit_event

router = APIRouter(prefix="/locations", tags=["locations"])

@router.get("", response_model=List[schemas.StorageOut])
def get_locations(
    flat: bool = Query(True, description="Return flat list vs nested top-level elements"),
    part_id: Optional[str] = Query(None, description="Filter locations holding specific part ID"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_analyst)
):
    """
    Get storage locations list. If flat=True (default), returns all entries.
    If flat=False, returns only top-level root locations.
    """
    query = db.query(models.Storage)
    if part_id is not None:
        clean_pid = part_id.strip()
        if not clean_pid or clean_pid.lower() in ("undefined", "null", "none"):
            return []
        query = query.filter(models.Storage.part_id == clean_pid)

    if flat:
        return query.order_by(models.Storage.name).all()
    else:
        return query.filter(models.Storage.parent_id == None).order_by(models.Storage.name).all()

@router.post("", response_model=schemas.StorageOut, status_code=status.HTTP_201_CREATED)
def create_location(
    payload: schemas.StorageCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_designer)
):
    """
    Create a storage location. Can specify a parent_id to build hierarchy. Designers and Admins only.
    """
    if payload.parent_id:
        parent = db.query(models.Storage).filter(models.Storage.id == payload.parent_id).first()
        if not parent:
            raise HTTPException(
                status_code=400,
                detail=f"Parent storage location with ID {payload.parent_id} does not exist."
            )
            
    db_storage = models.Storage(
        name=payload.name,
        parent_id=payload.parent_id,
        index=payload.index,
        dimensions=payload.dimensions,
        span=payload.span,
        label_scheme=payload.label_scheme,
        part_id=payload.part_id,
        quantity=payload.quantity,
        description=payload.description
    )
    db.add(db_storage)
    db.commit()
    db.refresh(db_storage)
    return db_storage


@router.get("/audit", response_model=List[schemas.AuditLocationItemOut])
def get_audit_route(
    days_stale: int = Query(180, ge=0, description="Minimum days since last counted to consider location stale"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_analyst)
):
    """
    Query stale storage locations requiring a cycle count audit.
    Calculates physically optimized audit route by concatenating location lineage paths via SQLite Recursive CTE
    and ordering by path ASC so sibling containers are physically grouped together.
    """
    cutoff_date = datetime.utcnow() - timedelta(days=days_stale)
    
    raw_query = text("""
        WITH RECURSIVE storage_path(id, name, parent_id, path) AS (
            SELECT id, name, parent_id, name AS path
            FROM storage
            WHERE parent_id IS NULL
            UNION ALL
            SELECT s.id, s.name, s.parent_id, sp.path || ' / ' || s.name
            FROM storage s
            JOIN storage_path sp ON s.parent_id = sp.id
        )
        SELECT 
            sp.id, 
            s.name, 
            s.parent_id, 
            sp.path, 
            s.part_id, 
            s.quantity, 
            s.last_counted,
            p.value AS part_name, 
            p.number AS part_number, 
            p.weight AS unit_weight
        FROM storage_path sp
        JOIN storage s ON sp.id = s.id
        LEFT JOIN parts p ON s.part_id = p.id
        WHERE (s.part_id IS NOT NULL OR s.quantity > 0)
          AND (s.last_counted IS NULL OR s.last_counted < :cutoff_date)
        ORDER BY sp.path ASC
    """)
    
    result = db.execute(raw_query, {"cutoff_date": cutoff_date}).mappings().all()
    
    items = []
    for row in result:
        last_counted_dt = None
        if row["last_counted"]:
            if isinstance(row["last_counted"], str):
                try:
                    last_counted_dt = datetime.fromisoformat(row["last_counted"].replace("Z", ""))
                except ValueError:
                    last_counted_dt = None
            elif isinstance(row["last_counted"], datetime):
                last_counted_dt = row["last_counted"]

        items.append(schemas.AuditLocationItemOut(
            id=str(row["id"]),
            name=row["name"],
            parent_id=str(row["parent_id"]) if row["parent_id"] else None,
            path=row["path"],
            part_id=str(row["part_id"]) if row["part_id"] else None,
            part_name=row["part_name"],
            part_number=row["part_number"],
            unit_weight=row["unit_weight"],
            quantity=row["quantity"] or 0,
            last_counted=last_counted_dt
        ))
    return items


@router.get("/stale-count", response_model=schemas.AuditStaleCountOut)
def get_stale_location_count(
    days_stale: int = Query(180, ge=0),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_any_user)
):
    """
    Get the count of stale inventory locations for navigation badges.
    """
    cutoff_date = datetime.utcnow() - timedelta(days=days_stale)
    count = db.query(func.count(models.Storage.id)).filter(
        (models.Storage.part_id.isnot(None)) | (models.Storage.quantity > 0),
        (models.Storage.last_counted.is_(None)) | (models.Storage.last_counted < cutoff_date)
    ).scalar() or 0
    
    return schemas.AuditStaleCountOut(stale_count=count, days_stale=days_stale)


@router.get("/{location_id}", response_model=schemas.StorageDetailsOut)
def get_location_details(
    location_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_analyst)
):
    """
    Get details of a storage location including direct sub-locations.
    """
    storage = db.query(models.Storage).filter(models.Storage.id == location_id).first()
    if not storage:
        raise HTTPException(status_code=404, detail="Storage location not found.")
    return storage

@router.delete("/{location_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_location(
    location_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_designer)
):
    """
    Delete storage location. Enforces strict deletion safety: blocked if children or parts exist.
    """
    storage = db.query(models.Storage).filter(models.Storage.id == location_id).first()
    if not storage:
        raise HTTPException(status_code=404, detail="Storage location not found.")
    
    # Check if there are any child locations
    has_children = db.query(models.Storage).filter(models.Storage.parent_id == location_id).first() is not None
    if has_children:
        raise HTTPException(status_code=400, detail="Cannot delete a location that contains child locations.")
        
    if storage.part_id is not None and (storage.quantity or 0) > 0:
        raise HTTPException(status_code=400, detail="Cannot delete a location that contains active part stock (quantity > 0).")
        
    db.delete(storage)
    db.commit()
    return

class LayoutPayload(BaseModel):
    dimensions: Optional[List[int]] = None

@router.put("/{location_id}/layout", response_model=schemas.StorageOut)
def update_layout(
    location_id: str,
    payload: LayoutPayload,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_designer)
):
    """
    Update layout dimensions. Validates that children fit within new bounds.
    """
    storage = db.query(models.Storage).filter(models.Storage.id == location_id).first()
    if not storage:
        raise HTTPException(status_code=404, detail="Storage location not found.")
        
    children = db.query(models.Storage).filter(models.Storage.parent_id == location_id).all()
    
    # Validate children constraints
    if payload.dimensions:
        if len(payload.dimensions) == 1:
            max_idx = payload.dimensions[0]
            for child in children:
                span_len = child.span[0] if child.span else 1
                if child.index + span_len > max_idx:
                    raise HTTPException(status_code=400, detail="Cannot resize: child item out of bounds.")
        elif len(payload.dimensions) == 2:
            cols, rows = payload.dimensions
            max_cap = cols * rows
            for child in children:
                if child.index >= max_cap:
                    raise HTTPException(status_code=400, detail="Cannot resize: child item out of bounds.")
                
    storage.dimensions = payload.dimensions
    db.commit()
    db.refresh(storage)
    return storage

class ReorderItem(BaseModel):
    id: str
    index: int

class ReorderPayload(BaseModel):
    items: List[ReorderItem]

@router.put("/reorder", status_code=status.HTTP_204_NO_CONTENT)
def reorder_locations(
    payload: ReorderPayload,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_designer)
):
    """
    Bulk update indices for sibling nodes after a flat-list drag-sort.
    """
    for item in payload.items:
        db.query(models.Storage).filter(models.Storage.id == item.id).update({"index": item.index})
    db.commit()
    return

class SlotPayload(BaseModel):
    index: int
    span: Optional[List[int]] = None

@router.put("/{location_id}/slot", response_model=schemas.StorageOut)
def update_slot(
    location_id: str,
    payload: SlotPayload,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_designer)
):
    """
    Update a child's index and span within its parent's geometry.
    """
    storage = db.query(models.Storage).filter(models.Storage.id == location_id).first()
    if not storage:
        raise HTTPException(status_code=404, detail="Storage location not found.")
        
    storage.index = payload.index
    if payload.span is not None:
        storage.span = payload.span
        
    db.commit()
    db.refresh(storage)
    return storage

class LocationLinkPayload(BaseModel):
    part_id: Optional[str] = None
    parent_id: Optional[str] = None
    set_parent: bool = False
    index: Optional[int] = None
    name: Optional[str] = None
    description: Optional[str] = None
    label_scheme: Optional[str] = None
    last_tare_id: Optional[str] = None
    set_last_tare: bool = False

@router.patch("/{location_id}", response_model=schemas.StorageOut)
def patch_location(
    location_id: str,
    payload: LocationLinkPayload,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_stocker)
):
    """
    Partial update for a storage location. Used to assign or unassign a part_id, name, or last_tare_id.
    """
    storage = db.query(models.Storage).filter(models.Storage.id == location_id).first()
    if not storage:
        raise HTTPException(status_code=404, detail="Storage location not found.")

    if payload.part_id is not None:
        # Verify the part exists
        part = db.query(models.Part).filter(models.Part.id == payload.part_id).first()
        if not part:
            raise HTTPException(status_code=404, detail="Part not found.")

        if storage.part_id is None or storage.part_id == payload.part_id:
            storage.part_id = payload.part_id
        else:
            # If target location already has a part assigned (PartOrig), split it into 2 child leaf sub-locations:
            # Sub-location 1: PartOrig (with existing stock quantity)
            # Sub-location 2: PartNew (with 0 quantity)
            existing_part = db.query(models.Part).filter(models.Part.id == storage.part_id).first()
            orig_name = existing_part.value if existing_part else "Original Part"
            
            orig_sub_bin = models.Storage(
                name=orig_name,
                parent_id=storage.id,
                part_id=storage.part_id,
                quantity=storage.quantity or 0,
                description=f"Auto-split sub-location for {orig_name}"
            )
            db.add(orig_sub_bin)

            # Clear parent container part_id and quantity so it remains a clean parent container node
            storage.part_id = None
            storage.quantity = 0

            # Sub-location 2 for new part
            new_sub_bin = models.Storage(
                name=f"{part.value}",
                parent_id=storage.id,
                part_id=part.id,
                quantity=0,
                description=f"Assigned part {part.value} ({part.number})"
            )
            db.add(new_sub_bin)

    if payload.name is not None:
        storage.name = payload.name
    if payload.description is not None:
        storage.description = payload.description
    if payload.label_scheme is not None:
        storage.label_scheme = payload.label_scheme

    if payload.set_last_tare or "last_tare_id" in payload.model_dump(exclude_unset=True):
        if payload.last_tare_id is not None:
            tare = db.query(models.TareWeight).filter(models.TareWeight.id == payload.last_tare_id).first()
            if not tare:
                raise HTTPException(status_code=404, detail="Specified tare weight not found.")
            storage.last_tare_id = payload.last_tare_id
        else:
            storage.last_tare_id = None

    if payload.set_parent:
        if payload.parent_id is not None:
            # Verify new parent exists and does not have an affiliated part
            new_parent = db.query(models.Storage).filter(models.Storage.id == payload.parent_id).first()
            if not new_parent:
                raise HTTPException(status_code=404, detail="Target parent location not found.")
            if new_parent.part_id is not None:
                raise HTTPException(status_code=400, detail="Cannot move location into a node that has an affiliated part.")
            
            # Check for cyclical dependency (can't move into a descendant)
            def check_cycle(curr_id, target_id):
                if curr_id == target_id:
                    return True
                parent = db.query(models.Storage).filter(models.Storage.id == curr_id).first()
                if not parent or not parent.parent_id:
                    return False
                return check_cycle(parent.parent_id, target_id)
                
            if check_cycle(payload.parent_id, location_id):
                raise HTTPException(status_code=400, detail="Cannot move location into its own descendant.")
            
            # Calculate new index
            if payload.index is not None:
                storage.index = payload.index
            else:
                existing_children = db.query(models.Storage).filter(models.Storage.parent_id == payload.parent_id).all()
                max_idx = max([c.index for c in existing_children], default=-1)
                storage.index = max_idx + 1
            storage.parent_id = payload.parent_id
        else:
            # Move to root
            if payload.index is not None:
                storage.index = payload.index
            else:
                existing_roots = db.query(models.Storage).filter(models.Storage.parent_id == None).all()
                max_idx = max([c.index for c in existing_roots], default=-1)
                storage.index = max_idx + 1
            storage.parent_id = None
    db.commit()
    db.refresh(storage)
    return storage

@router.post("/{location_id}/collapse", response_model=schemas.StorageOut)
def collapse_location_to_parent(
    location_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_stocker)
):
    """
    Collapse an intermediate leaf location node into its parent container:
    1. Promotes the assigned part and stock quantity to the parent location.
    2. Removes the intermediate child location node.
    Requires location_id to be a leaf node and the sole child of its parent.
    """
    child = db.query(models.Storage).filter(models.Storage.id == location_id).first()
    if not child:
        raise HTTPException(status_code=404, detail="Storage location not found.")

    if not child.parent_id:
        raise HTTPException(status_code=400, detail="Cannot collapse a root location.")

    parent = db.query(models.Storage).filter(models.Storage.id == child.parent_id).first()
    if not parent:
        raise HTTPException(status_code=404, detail="Parent storage location not found.")

    has_sub_children = db.query(models.Storage).filter(models.Storage.parent_id == location_id).first() is not None
    if has_sub_children:
        raise HTTPException(status_code=400, detail="Cannot collapse a location that contains sub-locations.")

    siblings = db.query(models.Storage).filter(models.Storage.parent_id == child.parent_id).all()
    if len(siblings) > 1:
        raise HTTPException(status_code=400, detail="Cannot collapse a location that has sibling locations under the same parent.")

    if not child.part_id:
        raise HTTPException(status_code=400, detail="Location has no part assigned to promote.")

    part_id = child.part_id
    transferred_qty = child.quantity or 0
    child_name = child.name
    parent_name = parent.name
    prev_parent_qty = parent.quantity or 0

    # 1. Update parent location
    parent.part_id = part_id
    parent.quantity = prev_parent_qty + transferred_qty

    # 2. Re-link foreign key references from child to parent before deletion
    db.query(models.AuditLog).filter(models.AuditLog.location_id == child.id).update({"location_id": parent.id})

    # 3. Delete intermediate child location
    db.delete(child)

    # 3. Create transaction record and audit log
    if current_user:
        db_tx = models.Transaction(
            part_id=part_id,
            user_id=current_user.id,
            action_type="count",
            quantity_change=transferred_qty,
            notes=f"Promoted {transferred_qty} units from collapsed location '{child_name}' into '{parent_name}'."
        )
        db.add(db_tx)

        log_audit_event(
            db=db,
            entity_type="storage_location",
            entity_id=parent.id,
            action_type="count_update",
            user_id=current_user.id,
            part_id=part_id,
            location_id=parent.id,
            reason_code="location_collapse",
            quantity_change=float(transferred_qty),
            previous_state={"quantity": prev_parent_qty, "name": parent_name},
            new_state={"quantity": parent.quantity, "name": parent_name},
            method="manual",
            notes=f"Collapsed intermediate location '{child_name}' into '{parent_name}'.",
            commit=False
        )

    # 4. Commit all changes atomically
    db.commit()
    db.refresh(parent)
    return parent

@router.put("/{location_id}/touch", response_model=schemas.StorageOut)
def touch_location(
    location_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_analyst)
):
    """
    Confirm count: stamps last_counted = NOW without changing quantity.
    Implements the low-friction cycle count confirmation from feature 027.
    """
    storage = db.query(models.Storage).filter(models.Storage.id == location_id).first()
    if not storage:
        raise HTTPException(status_code=404, detail="Storage location not found.")
    storage.last_counted = datetime.utcnow()
    db.commit()
    db.refresh(storage)
    return storage

class CountPayload(BaseModel):
    quantity: int
    last_tare_id: Optional[str] = None
    set_last_tare: bool = False
    reason_code: Optional[str] = None
    method: Optional[str] = "manual"
    notes: Optional[str] = None

@router.put("/{location_id}/count", response_model=schemas.StorageOut)
def count_location(
    location_id: str,
    payload: CountPayload,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_stocker)
):
    """
    Set an exact quantity for a storage location and stamp last_counted = NOW.
    Optionally updates last_tare_id reference.
    Used by the StockController component and ScaleModal.
    """
    storage = db.query(models.Storage).filter(models.Storage.id == location_id).first()
    if not storage:
        raise HTTPException(status_code=404, detail="Storage location not found.")
    if payload.quantity < 0:
        raise HTTPException(status_code=400, detail="Quantity cannot be negative.")
    
    prev_qty = float(storage.quantity or 0)
    storage.quantity = payload.quantity
    storage.last_counted = datetime.utcnow()

    if payload.set_last_tare or "last_tare_id" in payload.model_dump(exclude_unset=True):
        if payload.last_tare_id is not None:
            tare = db.query(models.TareWeight).filter(models.TareWeight.id == payload.last_tare_id).first()
            if not tare:
                raise HTTPException(status_code=404, detail="Specified tare weight not found.")
            storage.last_tare_id = payload.last_tare_id
        else:
            storage.last_tare_id = None

    # Write audit transaction for the owning part
    if storage.part_id:
        db_tx = models.Transaction(
            part_id=storage.part_id,
            user_id=current_user.id,
            action_type="count",
            quantity_change=payload.quantity,
            notes=payload.notes or f"Count confirmed at '{storage.name}'."
        )
        db.add(db_tx)

    log_audit_event(
        db=db,
        entity_type="storage_location",
        entity_id=storage.id,
        action_type="count_update",
        user_id=current_user.id,
        part_id=storage.part_id,
        location_id=storage.id,
        reason_code=payload.reason_code or "cycle_count_adjustment",
        quantity_change=float(payload.quantity) - prev_qty,
        previous_state={"quantity": prev_qty, "name": storage.name},
        new_state={"quantity": payload.quantity, "name": storage.name},
        method=payload.method or "manual",
        notes=payload.notes or f"Count updated for '{storage.name}'."
    )

    db.commit()
    db.refresh(storage)
    return storage



class AssignPartPayload(BaseModel):
    part_id: str
    location_id: str
    quantity: Optional[int] = 0
    notes: Optional[str] = None


class BulkAssignPartsPayload(BaseModel):
    part_ids: List[str]
    location_id: str
    quantity: Optional[int] = 0
    notes: Optional[str] = None


@router.post("/assign", response_model=schemas.StorageOut, status_code=status.HTTP_200_OK)
def assign_part_location(
    payload: AssignPartPayload,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_stocker)
):
    """
    Transactionally assigns a homeless part component to a target physical storage location.
    Logs an audit Transaction record.
    """
    part = db.query(models.Part).filter(models.Part.id == payload.part_id).first()
    if not part:
        raise HTTPException(status_code=404, detail="Part component not found.")

    storage = db.query(models.Storage).filter(models.Storage.id == payload.location_id).first()
    if not storage:
        raise HTTPException(status_code=404, detail="Target storage location not found.")

    if storage.part_id is None or storage.part_id == part.id:
        storage.part_id = part.id
        if payload.quantity is not None and payload.quantity >= 0:
            storage.quantity = payload.quantity
        target_storage = storage
    else:
        # If target location already has a part assigned (PartOrig), split it into 2 child leaf sub-locations:
        # Sub-location 1: PartOrig (with existing stock quantity)
        # Sub-location 2: PartNew (with new quantity)
        existing_part = db.query(models.Part).filter(models.Part.id == storage.part_id).first()
        orig_name = existing_part.value if existing_part else "Original Part"
        
        orig_sub_bin = models.Storage(
            name=orig_name,
            parent_id=storage.id,
            part_id=storage.part_id,
            quantity=storage.quantity or 0,
            description=f"Auto-split sub-location for {orig_name}"
        )
        db.add(orig_sub_bin)

        # Clear parent container part_id and quantity so it remains a clean parent container node
        storage.part_id = None
        storage.quantity = 0

        # Sub-location 2 for new part
        new_sub_bin = models.Storage(
            name=f"{part.value}",
            parent_id=storage.id,
            part_id=part.id,
            quantity=payload.quantity or 0,
            description=f"Assigned part {part.value} ({part.number})"
        )
        db.add(new_sub_bin)
        db.commit()
        db.refresh(new_sub_bin)
        target_storage = new_sub_bin

    db_tx = models.Transaction(
        part_id=part.id,
        user_id=current_user.id,
        action_type="assign_location",
        quantity_change=target_storage.quantity,
        notes=payload.notes or f"Assigned location '{target_storage.name}' to part {part.value}."
    )
    db.add(db_tx)
    db.commit()
    db.refresh(target_storage)

    return target_storage


@router.post("/bulk-assign", status_code=status.HTTP_200_OK)
def bulk_assign_parts_location(
    payload: BulkAssignPartsPayload,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_stocker)
):
    """
    Transactionally assigns multiple selected parts to a target storage location or container.
    """
    location = db.query(models.Storage).filter(models.Storage.id == payload.location_id).first()
    if not location:
        raise HTTPException(status_code=404, detail="Target storage location not found.")

    assigned_count = 0

    # If target container already has a part assigned (PartOrig), split PartOrig into a sub-location first
    if location.part_id is not None:
        existing_part = db.query(models.Part).filter(models.Part.id == location.part_id).first()
        orig_name = existing_part.value if existing_part else "Original Part"
        orig_sub_bin = models.Storage(
            name=orig_name,
            parent_id=location.id,
            part_id=location.part_id,
            quantity=location.quantity or 0,
            description=f"Auto-split sub-location for {orig_name}"
        )
        db.add(orig_sub_bin)
        location.part_id = None
        location.quantity = 0

    for part_id in payload.part_ids:
        part = db.query(models.Part).filter(models.Part.id == part_id).first()
        if not part:
            continue

        sub_bin = models.Storage(
            name=f"{part.value}",
            parent_id=location.id,
            part_id=part.id,
            quantity=payload.quantity or (part.threshold or 0),
            description=f"Batch assigned to '{location.name}'"
        )
        db.add(sub_bin)
        db.flush()
        target_storage = sub_bin

        db_tx = models.Transaction(
            part_id=part.id,
            user_id=current_user.id,
            action_type="assign_location",
            quantity_change=target_storage.quantity,
            notes=payload.notes or f"Batch assigned to container '{location.name}'."
        )
        db.add(db_tx)
        assigned_count += 1

    db.commit()
    return {"status": "success", "assigned_count": assigned_count, "location_id": location.id}


