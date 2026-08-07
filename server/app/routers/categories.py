from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..database import get_db
from .. import models, schemas, auth

router = APIRouter(prefix="/categories", tags=["categories"])

@router.get("", response_model=List[schemas.CategoryOut])
def get_categories(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_analyst)
):
    """
    Get list of all categories. Accessible by any authenticated user.
    """
    return db.query(models.Category).all()

@router.post("", response_model=schemas.CategoryOut, status_code=status.HTTP_201_CREATED)
def create_category(
    category: schemas.CategoryCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_designer)
):
    """
    Create a new category. Designers and Admins only.
    """
    existing = db.query(models.Category).filter(models.Category.name == category.name).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Category with name '{category.name}' already exists."
        )
    
    db_category = models.Category(name=category.name, description=category.description)
    db.add(db_category)
    db.commit()
    db.refresh(db_category)
    return db_category

@router.get("/{category_id}", response_model=schemas.CategoryDetailsOut)
def get_category_details(
    category_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_analyst)
):
    """
    Get a single category with its defined custom fields.
    """
    category = db.query(models.Category).filter(models.Category.id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found.")
    return category

@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(
    category_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_designer)
):
    """
    Delete a category. Designers and Admins only.
    """
    category = db.query(models.Category).filter(models.Category.id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found.")
    db.delete(category)
    db.commit()
    return

# ---------------- Custom Fields Scoped to Category ----------------

@router.post("/{category_id}/fields", response_model=schemas.CustomFieldOut, status_code=status.HTTP_201_CREATED)
def add_custom_field(
    category_id: int,
    field: schemas.CustomFieldCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_designer)
):
    """
    Add a custom property field description to a category (e.g. Expiration Date, Serial No).
    """
    category = db.query(models.Category).filter(models.Category.id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found.")
        
    db_field = models.CustomField(
        name=field.name,
        field_type=field.field_type.lower(),
        category_id=category_id
    )
    if db_field.field_type not in ("text", "number", "date", "boolean"):
        raise HTTPException(status_code=400, detail="Invalid custom field type. Choose: text, number, date, boolean.")
        
    db.add(db_field)
    db.commit()
    db.refresh(db_field)
    return db_field

@router.delete("/fields/{field_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_custom_field(
    field_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_designer)
):
    """
    Remove a custom property definition. Designers and Admins only.
    """
    field = db.query(models.CustomField).filter(models.CustomField.id == field_id).first()
    if not field:
        raise HTTPException(status_code=404, detail="Custom field definition not found.")
    db.delete(field)
    db.commit()
    return
