from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_
from ..database import get_db
from .. import models, schemas, auth

router = APIRouter(prefix="/items", tags=["items"])

@router.get("", response_model=List[schemas.ItemOut])
def get_items(
    q: Optional[str] = Query(None, description="Search term for item name, SKU, or barcode"),
    category_id: Optional[int] = Query(None),
    location_id: Optional[int] = Query(None),
    low_stock: Optional[bool] = Query(None, description="Filter items falling below min_quantity_alert"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_analyst)
):
    """
    Get items with optional search, category, location, and low-stock filters.
    Requires at least Analyst permissions.
    """
    query = db.query(models.Item)
    
    if q:
        search_filter = or_(
            models.Item.name.ilike(f"%{q}%"),
            models.Item.description.ilike(f"%{q}%"),
            models.Item.sku.ilike(f"%{q}%"),
            models.Item.barcode.ilike(f"%{q}%")
        )
        query = query.filter(search_filter)
        
    if category_id:
        query = query.filter(models.Item.category_id == category_id)
        
    if location_id:
        # Include items in child locations recursively
        location_ids = [location_id]
        # Query child locations
        children = db.query(models.Location).filter(models.Location.parent_id == location_id).all()
        child_ids = [c.id for c in children]
        while child_ids:
            location_ids.extend(child_ids)
            next_children = db.query(models.Location).filter(models.Location.parent_id.in_(child_ids)).all()
            child_ids = [c.id for c in next_children]
            
        query = query.filter(models.Item.location_id.in_(location_ids))
        
    if low_stock is not None:
        if low_stock:
            query = query.filter(models.Item.quantity < models.Item.min_quantity_alert)
            
    return query.all()

@router.post("", response_model=schemas.ItemOut, status_code=status.HTTP_201_CREATED)
def create_item(
    item_payload: schemas.ItemCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_stocker)  # Stocker/Admin can create items
):
    """
    Create a new inventory item and log a 'create' transaction.
    """
    # Check if SKU is unique if provided
    if item_payload.sku:
        existing = db.query(models.Item).filter(models.Item.sku == item_payload.sku).first()
        if existing:
            raise HTTPException(status_code=400, detail="An item with this SKU already exists.")
            
    # Create item
    db_item = models.Item(
        name=item_payload.name,
        description=item_payload.description,
        sku=item_payload.sku,
        barcode=item_payload.barcode,
        quantity=item_payload.quantity,
        min_quantity_alert=item_payload.min_quantity_alert,
        category_id=item_payload.category_id,
        location_id=item_payload.location_id
    )
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    
    # Save custom values
    for val in item_payload.custom_values:
        # Verify custom field exists
        field = db.query(models.CustomField).filter(models.CustomField.id == val.custom_field_id).first()
        if field:
            db_val = models.CustomFieldValue(
                item_id=db_item.id,
                custom_field_id=val.custom_field_id,
                value=val.value
            )
            db.add(db_val)
            
    # Write audit log transaction
    db_tx = models.Transaction(
        item_id=db_item.id,
        user_id=current_user.id,
        action_type="create",
        quantity_change=db_item.quantity,
        notes="Initial item creation."
    )
    db.add(db_tx)
    db.commit()
    db.refresh(db_item)
    
    return db_item

@router.get("/transactions", response_model=List[schemas.TransactionOut])
def get_recent_transactions(
    limit: int = Query(25),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_analyst)
):
    """
    Get recent transaction logs globally for the audit log dashboard.
    """
    return db.query(models.Transaction).order_by(models.Transaction.created_at.desc()).limit(limit).all()

@router.get("/{item_id}", response_model=schemas.ItemDetailsOut)
def get_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_analyst)
):
    """
    Get full details of an item including custom fields, attachment metadata, and logs.
    """
    item = db.query(models.Item).filter(models.Item.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found.")
    return item

@router.put("/{item_id}", response_model=schemas.ItemOut)
def update_item(
    item_id: int,
    payload: schemas.ItemUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_stocker)  # Stockers can edit item details
):
    """
    Update item details. If custom fields are provided, updates them as well.
    Logs an 'edit' transaction.
    """
    db_item = db.query(models.Item).filter(models.Item.id == item_id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Item not found.")
        
    # Track update history if quantity changes directly
    qty_changed = False
    old_qty = db_item.quantity
    
    update_data = payload.model_dump(exclude_unset=True)
    custom_vals = update_data.pop("custom_values", None)
    
    for key, value in update_data.items():
        if key == "sku" and value != db_item.sku:
            # Check SKU uniqueness
            existing = db.query(models.Item).filter(models.Item.sku == value).first()
            if existing:
                raise HTTPException(status_code=400, detail="SKU is already in use by another item.")
        if key == "quantity" and value != old_qty:
            qty_changed = True
            
        setattr(db_item, key, value)
        
    # Update custom fields if supplied
    if custom_vals is not None:
        # Delete old custom values and write new ones
        db.query(models.CustomFieldValue).filter(models.CustomFieldValue.item_id == item_id).delete()
        for val in custom_vals:
            db_val = models.CustomFieldValue(
                item_id=item_id,
                custom_field_id=val.custom_field_id,
                value=val.value
            )
            db.add(db_val)
            
    # Write audit log transaction
    notes = "Details modified."
    if qty_changed:
        notes += f" Quantity direct override from {old_qty} to {db_item.quantity}."
        
    db_tx = models.Transaction(
        item_id=item_id,
        user_id=current_user.id,
        action_type="edit",
        quantity_change=(db_item.quantity - old_qty) if qty_changed else 0,
        notes=notes
    )
    db.add(db_tx)
    db.commit()
    db.refresh(db_item)
    return db_item

@router.post("/{item_id}/stock", response_model=schemas.ItemOut)
def update_item_stock(
    item_id: int,
    payload: schemas.ItemStockUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Direct inventory action check_in (Stocker only) or check_out (Puller only).
    Decrements or increments quantities and logs transaction history.
    """
    # Enforce granular action permissions
    action = payload.action_type.lower()
    if action == "check_in":
        # Requires stocker permissions
        if current_user.role not in ("admin", "stocker"):
            raise HTTPException(
                status_code=403,
                detail=f"Role '{current_user.role}' is not permitted to perform check-in operations. Stocker role required."
            )
    elif action == "check_out":
        # Requires puller permissions
        if current_user.role not in ("admin", "puller"):
            raise HTTPException(
                status_code=403,
                detail=f"Role '{current_user.role}' is not permitted to perform check-out/pull operations. Puller role required."
            )
    else:
        raise HTTPException(status_code=400, detail="Invalid action_type. Choose: check_in or check_out.")
        
    db_item = db.query(models.Item).filter(models.Item.id == item_id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Item not found.")
        
    change = abs(payload.quantity_change)
    if action == "check_in":
        db_item.quantity += change
        qty_change = change
    else:
        # Check-out
        if db_item.quantity < change:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient inventory stock. Current: {db_item.quantity}, Requested: {change}"
            )
        db_item.quantity -= change
        qty_change = -change
        
    # Save transaction record
    db_tx = models.Transaction(
        item_id=item_id,
        user_id=current_user.id,
        action_type=action,
        quantity_change=qty_change,
        notes=payload.notes or f"Stock updated via quick action."
    )
    db.add(db_tx)
    db.commit()
    db.refresh(db_item)
    return db_item

@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_admin)  # Admins only can hard-delete items
):
    """
    Permanently delete an item from the database. Admins only.
    """
    db_item = db.query(models.Item).filter(models.Item.id == item_id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Item not found.")
    db.delete(db_item)
    db.commit()
    return
