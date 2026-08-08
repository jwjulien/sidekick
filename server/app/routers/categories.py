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
    Get list of all categories. Accessible by any authenticated user with Analyst or above.
    """
    return db.query(models.Category).order_by(models.Category.title).all()

@router.post("", response_model=schemas.CategoryOut, status_code=status.HTTP_201_CREATED)
def create_category(
    payload: schemas.CategoryCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_designer)
):
    """
    Create a new category. Designers and Admins only.
    """
    existing = db.query(models.Category).filter(models.Category.title == payload.title).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Category with title '{payload.title}' already exists."
        )
    
    if payload.parent_id:
        parent = db.query(models.Category).filter(models.Category.id == payload.parent_id).first()
        if not parent:
            raise HTTPException(
                status_code=400,
                detail=f"Parent category with ID {payload.parent_id} does not exist."
            )
            
    db_category = models.Category(
        title=payload.title,
        parent_id=payload.parent_id,
        designator=payload.designator
    )
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
    Get a single category with its child categories.
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
