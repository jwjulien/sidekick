from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..database import get_db
from .. import models, schemas, auth

router = APIRouter(prefix="/tare-weights", tags=["tare-weights"])

@router.get("", response_model=List[schemas.TareWeightOut])
def get_tare_weights(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_analyst)
):
    """
    Get all registered tare weights. Requires Analyst role.
    """
    return db.query(models.TareWeight).order_by(models.TareWeight.name).all()

@router.post("", response_model=schemas.TareWeightOut, status_code=status.HTTP_201_CREATED)
def create_tare_weight(
    payload: schemas.TareWeightCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_designer)
):
    """
    Create a new tare weight item (e.g. empty bin, tray, drawer weight). Requires Designer role.
    """
    if payload.weight < 0:
        raise HTTPException(
            status_code=400,
            detail="Tare weight cannot be negative."
        )

    db_tare = models.TareWeight(
        name=payload.name,
        weight=payload.weight
    )
    db.add(db_tare)
    db.commit()
    db.refresh(db_tare)
    return db_tare

@router.get("/{tare_id}", response_model=schemas.TareWeightOut)
def get_tare_weight_details(
    tare_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_analyst)
):
    """
    Get details for a single tare weight item. Requires Analyst role.
    """
    tare = db.query(models.TareWeight).filter(models.TareWeight.id == tare_id).first()
    if not tare:
        raise HTTPException(status_code=404, detail="Tare weight not found.")
    return tare

@router.put("/{tare_id}", response_model=schemas.TareWeightOut)
def update_tare_weight(
    tare_id: str,
    payload: schemas.TareWeightUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_designer)
):
    """
    Update details for a tare weight item. Requires Designer role.
    """
    tare = db.query(models.TareWeight).filter(models.TareWeight.id == tare_id).first()
    if not tare:
        raise HTTPException(status_code=404, detail="Tare weight not found.")

    if payload.name is not None:
        tare.name = payload.name
    if payload.weight is not None:
        if payload.weight < 0:
            raise HTTPException(status_code=400, detail="Tare weight cannot be negative.")
        tare.weight = payload.weight

    db.commit()
    db.refresh(tare)
    return tare

@router.delete("/{tare_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tare_weight(
    tare_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_designer)
):
    """
    Delete a tare weight item. Requires Designer role.
    """
    tare = db.query(models.TareWeight).filter(models.TareWeight.id == tare_id).first()
    if not tare:
        raise HTTPException(status_code=404, detail="Tare weight not found.")

    db.delete(tare)
    db.commit()
    return
