from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from ..database import get_db
from .. import models, schemas, auth

router = APIRouter(prefix="/locations", tags=["locations"])

@router.get("", response_model=List[schemas.StorageOut])
def get_locations(
    flat: bool = Query(True, description="Return flat list vs nested top-level elements"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_analyst)
):
    """
    Get storage locations list. If flat=True (default), returns all entries.
    If flat=False, returns only top-level root locations.
    """
    if flat:
        return db.query(models.Storage).order_by(models.Storage.name).all()
    else:
        return db.query(models.Storage).filter(models.Storage.parent_id == None).order_by(models.Storage.name).all()

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
        
    if storage.part_id is not None:
        raise HTTPException(status_code=400, detail="Cannot delete a location that has a part assigned.")
        
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
        storage.part_id = payload.part_id

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
            notes=f"Count confirmed at '{storage.name}'."
        )
        db.add(db_tx)

    db.commit()
    db.refresh(storage)
    return storage
