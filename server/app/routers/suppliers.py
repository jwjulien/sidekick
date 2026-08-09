from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..database import get_db
from .. import models, schemas, auth

router = APIRouter(prefix="/suppliers", tags=["suppliers"])

@router.get("", response_model=List[schemas.SupplierOut])
def get_suppliers(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_analyst)
):
    """
    Get all suppliers. Requires Analyst role.
    """
    return db.query(models.Supplier).order_by(models.Supplier.name).all()

@router.post("", response_model=schemas.SupplierOut, status_code=status.HTTP_201_CREATED)
def create_supplier(
    payload: schemas.SupplierCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_designer)
):
    """
    Create a new supplier. Requires Designer role.
    """
    existing = db.query(models.Supplier).filter(models.Supplier.name == payload.name).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Supplier with name '{payload.name}' already exists."
        )
    
    db_supplier = models.Supplier(
        name=payload.name,
        website=payload.website,
        search=payload.search
    )
    db.add(db_supplier)
    db.commit()
    db.refresh(db_supplier)
    return db_supplier

@router.put("/{supplier_id}", response_model=schemas.SupplierOut)
def update_supplier(
    supplier_id: str,
    payload: schemas.SupplierUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_designer)
):
    """
    Update a supplier's details. Requires Designer role.
    """
    supplier = db.query(models.Supplier).filter(models.Supplier.id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found.")
        
    if payload.name is not None:
        # Check if name already exists
        existing = db.query(models.Supplier).filter(models.Supplier.name == payload.name, models.Supplier.id != supplier_id).first()
        if existing:
            raise HTTPException(status_code=400, detail=f"Supplier with name '{payload.name}' already exists.")
        supplier.name = payload.name
        
    if payload.website is not None:
        supplier.website = payload.website
        
    if payload.search is not None:
        supplier.search = payload.search
        
    db.commit()
    db.refresh(supplier)
    return supplier

@router.delete("/{supplier_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_supplier(
    supplier_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_designer)
):
    """
    Delete a supplier. Requires Designer role.
    """
    supplier = db.query(models.Supplier).filter(models.Supplier.id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found.")
        
    if db.query(models.Product).filter(models.Product.supplier_id == supplier_id).first():
        raise HTTPException(status_code=400, detail="Cannot delete a supplier that has linked component products. Unlink the products first.")
        
    db.delete(supplier)
    db.commit()
    return
