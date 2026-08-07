from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from ..database import get_db
from .. import models, schemas, auth

router = APIRouter(prefix="/locations", tags=["locations"])

@router.get("", response_model=List[schemas.LocationOut])
def get_locations(
    flat: bool = Query(True, description="Return flat list vs nested top-level elements"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_analyst)
):
    """
    Get locations list. If flat=True (default), returns all entries.
    If flat=False, returns only top-level root locations (allowing client recursion).
    """
    if flat:
        return db.query(models.Location).all()
    else:
        return db.query(models.Location).filter(models.Location.parent_id == None).all()

@router.post("", response_model=schemas.LocationOut, status_code=status.HTTP_201_CREATED)
def create_location(
    location: schemas.LocationCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_designer)
):
    """
    Create a storage location. Can specify a parent_id to build hierarchy. Designers and Admins only.
    """
    if location.parent_id:
        parent = db.query(models.Location).filter(models.Location.id == location.parent_id).first()
        if not parent:
            raise HTTPException(
                status_code=400,
                detail=f"Parent location with ID {location.parent_id} does not exist."
            )
            
    db_location = models.Location(
        name=location.name,
        description=location.description,
        parent_id=location.parent_id
    )
    db.add(db_location)
    db.commit()
    db.refresh(db_location)
    return db_location

@router.get("/{location_id}", response_model=schemas.LocationDetailsOut)
def get_location_details(
    location_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_analyst)
):
    """
    Get details of a location including direct child locations.
    """
    location = db.query(models.Location).filter(models.Location.id == location_id).first()
    if not location:
        raise HTTPException(status_code=404, detail="Location not found.")
    return location

@router.delete("/{location_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_location(
    location_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_designer)
):
    """
    Delete location. Automatically cascades deletion to sub-locations. Designers and Admins only.
    """
    location = db.query(models.Location).filter(models.Location.id == location_id).first()
    if not location:
        raise HTTPException(status_code=404, detail="Location not found.")
    db.delete(location)
    db.commit()
    return
