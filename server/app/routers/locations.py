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
    Delete storage location. If the location has children (sub-locations), it only clears the part linkage
    (part_id=None, quantity=0, last_counted=None) to preserve the hierarchy. Otherwise, deletes it.
    """
    storage = db.query(models.Storage).filter(models.Storage.id == location_id).first()
    if not storage:
        raise HTTPException(status_code=404, detail="Storage location not found.")
    
    # Check if there are any child locations in the tree hierarchy
    has_children = db.query(models.Storage).filter(models.Storage.parent_id == location_id).first() is not None
    if has_children:
        storage.part_id = None
        storage.quantity = 0
        storage.last_counted = None
    else:
        db.delete(storage)
        
    db.commit()
    return

class LocationLinkPayload(BaseModel):
    part_id: Optional[int] = None

@router.patch("/{location_id}", response_model=schemas.StorageOut)
def patch_location(
    location_id: str,
    payload: LocationLinkPayload,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_stocker)
):
    """
    Partial update for a storage location. Used to assign or unassign a part_id.
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

@router.put("/{location_id}/count", response_model=schemas.StorageOut)
def count_location(
    location_id: str,
    payload: CountPayload,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_stocker)
):
    """
    Set an exact quantity for a storage location and stamp last_counted = NOW.
    Used by the StockController component for +/- and inline edit adjustments.
    """
    storage = db.query(models.Storage).filter(models.Storage.id == location_id).first()
    if not storage:
        raise HTTPException(status_code=404, detail="Storage location not found.")
    if payload.quantity < 0:
        raise HTTPException(status_code=400, detail="Quantity cannot be negative.")
    storage.quantity = payload.quantity
    storage.last_counted = datetime.utcnow()

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
