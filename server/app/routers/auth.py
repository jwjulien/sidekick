from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from .. import models, schemas, auth

router = APIRouter(prefix="/auth", tags=["authentication"])

@router.get("/me", response_model=schemas.UserOut)
def get_me(current_user: models.User = Depends(auth.get_current_user)):
    """
    Returns the currently authenticated user's database profile and roles.
    """
    return current_user

@router.get("/users", response_model=List[schemas.UserOut])
def get_all_users(
    db: Session = Depends(get_db),
    admin_user: models.User = Depends(auth.require_admin)
):
    """
    Administrators only: view all users registered locally.
    """
    return db.query(models.User).all()

@router.put("/users/{user_id}/role", response_model=schemas.UserOut)
def update_user_role(
    user_id: int,
    payload: schemas.UserUpdateRole,
    db: Session = Depends(get_db),
    admin_user: models.User = Depends(auth.require_admin)
):
    """
    Administrators only: assign/update a user's app-specific role.
    """
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
        
    role = payload.role.lower()
    if role not in ("admin", "designer", "stocker", "puller", "analyst", "viewer"):
        raise HTTPException(status_code=400, detail="Invalid role specified.")
        
    # Prevent lockouts: don't let current admin demote themselves
    if user.id == admin_user.id and role != "admin":
        raise HTTPException(status_code=400, detail="You cannot change your own admin role.")
        
    user.role = role
    db.commit()
    db.refresh(user)
    return user
