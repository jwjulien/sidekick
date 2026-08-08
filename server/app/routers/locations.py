from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query, status
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
    location_id: int,
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
    location_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_designer)
):
    """
    Delete storage location. Automatically cascades deletion to sub-locations. Designers and Admins only.
    """
    storage = db.query(models.Storage).filter(models.Storage.id == location_id).first()
    if not storage:
        raise HTTPException(status_code=404, detail="Storage location not found.")
    db.delete(storage)
    db.commit()
    return
