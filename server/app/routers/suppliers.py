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
    supplier_id: int,
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
    supplier_id: int,
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

# --- Products/Catalog Links ---

@router.post("/products", response_model=schemas.ProductOut, status_code=status.HTTP_201_CREATED)
def link_supplier_product(
    payload: schemas.ProductCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_stocker)
):
    """
    Link a Part component to a Supplier with their distributor part number.
    Requires Stocker role.
    """
    # Verify supplier exists
    supplier = db.query(models.Supplier).filter(models.Supplier.id == payload.supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found.")
    
    # Verify part exists
    part = db.query(models.Part).filter(models.Part.id == payload.part_id).first()
    if not part:
        raise HTTPException(status_code=404, detail="Part component not found.")
        
    db_product = models.Product(
        supplier_id=payload.supplier_id,
        part_id=payload.part_id,
        number=payload.number
    )
    db.add(db_product)
    db.commit()
    db.refresh(db_product)
    return db_product

@router.delete("/products/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def unlink_supplier_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_stocker)
):
    """
    Unlink/Delete a supplier product code mapping from a component.
    Requires Stocker role.
    """
    product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product catalog link not found.")
    db.delete(product)
    db.commit()
    return
