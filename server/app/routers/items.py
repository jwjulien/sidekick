from typing import List, Optional, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_
from pydantic import BaseModel
import json
from ..database import get_db
from .. import models, schemas, auth

router = APIRouter(prefix="/items", tags=["items"])

# Compatibility payloads to support existing client code structure
class ItemCreateCompat(BaseModel):
    name: str
    description: Optional[str] = None
    sku: Optional[str] = None
    barcode: Optional[str] = None
    quantity: int = 0
    min_quantity_alert: Optional[int] = 0
    category_id: Optional[int] = None
    location_id: Optional[int] = None
    custom_values: List[Any] = []

class ItemUpdateCompat(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    sku: Optional[str] = None
    barcode: Optional[str] = None
    min_quantity_alert: Optional[int] = None
    category_id: Optional[int] = None
    location_id: Optional[int] = None

class ItemStockUpdateCompat(BaseModel):
    quantity_change: int
    action_type: str  # check_in, check_out
    notes: Optional[str] = None
    location_id: Optional[int] = None

@router.get("", response_model=List[schemas.PartOut])
def get_items(
    q: Optional[str] = Query(None, description="Search term for part value, number, package, or notes"),
    category_id: Optional[int] = Query(None),
    location_id: Optional[int] = Query(None),
    low_stock: Optional[bool] = Query(None, description="Filter parts falling below alert threshold"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_analyst)
):
    """
    Get parts/items with optional search, category, location, and low-stock filters.
    Requires Analyst role.
    """
    query = db.query(models.Part)
    
    if q:
        search_filter = or_(
            models.Part.value.ilike(f"%{q}%"),
            models.Part.number.ilike(f"%{q}%"),
            models.Part.package.ilike(f"%{q}%"),
            models.Part.notes.ilike(f"%{q}%")
        )
        query = query.filter(search_filter)
        
    if category_id:
        query = query.filter(models.Part.category_id == category_id)
        
    if location_id:
        # Filter parts that have storage records in this location (or child locations recursively)
        location_ids = [location_id]
        children = db.query(models.Storage).filter(models.Storage.parent_id == location_id).all()
        child_ids = [c.id for c in children]
        while child_ids:
            location_ids.extend(child_ids)
            next_children = db.query(models.Storage).filter(models.Storage.parent_id.in_(child_ids)).all()
            child_ids = [c.id for c in next_children]
            
        # Get parts mapped to storage locations
        query = query.join(models.Storage).filter(models.Storage.id.in_(location_ids))
        
    parts = query.all()
    
    # Calculate quantities and filter low stock
    result = []
    for p in parts:
        total_qty = sum(s.quantity for s in p.storage_records)
        p.total_quantity = total_qty
        
        # Category mapping for compatibility
        p.category = p.category
        
        if low_stock is not None:
            is_low = total_qty < p.threshold
            if low_stock and not is_low:
                continue
            if not low_stock and is_low:
                continue
        result.append(p)
        
    return result

@router.post("", response_model=schemas.PartOut, status_code=status.HTTP_201_CREATED)
def create_item(
    payload: ItemCreateCompat,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_stocker)
):
    """
    Create a new part component and assign its initial stock to a storage slot.
    """
    # Enforce category exists
    if not payload.category_id:
        raise HTTPException(status_code=400, detail="Category ID is required to create a part.")
    
    category = db.query(models.Category).filter(models.Category.id == payload.category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found.")
        
    # Check uniqueness of manufacturer part number
    if payload.sku:
        existing = db.query(models.Part).filter(models.Part.number == payload.sku).first()
        if existing:
            raise HTTPException(status_code=400, detail="A component with this part number (SKU) already exists.")
            
    # Serialize attributes (like barcode)
    attributes_dict = {"barcode": payload.barcode} if payload.barcode else {}
    attributes_bytes = json.dumps(attributes_dict).encode("utf-8")
    
    db_part = models.Part(
        category_id=payload.category_id,
        value=payload.name,
        number=payload.sku or "UNKNOWN",
        package="0805", # Default packages
        price=0.0,
        weight=0.0,
        threshold=payload.min_quantity_alert or 0,
        notes=payload.description or "",
        attributes=attributes_bytes
    )
    db.add(db_part)
    db.commit()
    db.refresh(db_part)
    
    # Associate initial quantity with storage location
    if payload.location_id:
        storage = db.query(models.Storage).filter(models.Storage.id == payload.location_id).first()
        if storage:
            if storage.part_id is None:
                storage.part_id = db_part.id
                storage.quantity = payload.quantity
            elif storage.part_id == db_part.id:
                storage.quantity += payload.quantity
            else:
                # Slot is occupied, create a sub-storage bin under it
                sub_storage = models.Storage(
                    parent_id=storage.id,
                    name=f"Bin for {db_part.value}",
                    part_id=db_part.id,
                    quantity=payload.quantity
                )
                db.add(sub_storage)
            db.commit()
            
    # Write audit log transaction
    db_tx = models.Transaction(
        part_id=db_part.id,
        user_id=current_user.id,
        action_type="create",
        quantity_change=payload.quantity,
        notes="Component registered in catalog."
    )
    db.add(db_tx)
    db.commit()
    
    db_part.total_quantity = payload.quantity
    return db_part

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

@router.get("/{item_id}", response_model=schemas.PartDetailsOut)
def get_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_analyst)
):
    """
    Get full details of a part component.
    """
    part = db.query(models.Part).filter(models.Part.id == item_id).first()
    if not part:
        raise HTTPException(status_code=404, detail="Part component not found.")
        
    part.total_quantity = sum(s.quantity for s in part.storage_records)
    
    # Try parsing attributes bytes to dict
    try:
        part.attributes_dict = json.loads(part.attributes.decode("utf-8"))
    except:
        part.attributes_dict = {}
        
    # Map attributes dict for details response
    part.attributes = part.attributes_dict
    
    # Combine images and documents into a single attachments list for the frontend
    attachments = []
    for img in part.images:
        attachments.append({
            "id": img.id,
            "filename": img.caption,
            "file_type": "image",
            "part_id": part.id,
            "created_on": img.created_on
        })
    for doc in part.documents:
        attachments.append({
            "id": -doc.id, # Negative IDs to distinguish document records from image records
            "filename": doc.filename,
            "file_type": "document",
            "part_id": part.id,
            "created_on": doc.created_on
        })
    part.attachments = attachments
    
    return part

@router.put("/{item_id}", response_model=schemas.PartOut)
def update_item(
    item_id: int,
    payload: ItemUpdateCompat,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_stocker)
):
    """
    Update part details.
    """
    db_part = db.query(models.Part).filter(models.Part.id == item_id).first()
    if not db_part:
        raise HTTPException(status_code=404, detail="Part component not found.")
        
    if payload.name:
        db_part.value = payload.name
    if payload.description is not None:
        db_part.notes = payload.description
    if payload.sku:
        db_part.number = payload.sku
    if payload.min_quantity_alert is not None:
        db_part.threshold = payload.min_quantity_alert
    if payload.category_id:
        db_part.category_id = payload.category_id
        
    if payload.barcode:
        try:
            attr = json.loads(db_part.attributes.decode("utf-8"))
        except:
            attr = {}
        attr["barcode"] = payload.barcode
        db_part.attributes = json.dumps(attr).encode("utf-8")
        
    # Relocate stock if location_id is changed
    if payload.location_id:
        # Move all storage records of this part to point under the new parent location_id
        for s in db_part.storage_records:
            s.parent_id = payload.location_id
            
    db_tx = models.Transaction(
        part_id=item_id,
        user_id=current_user.id,
        action_type="edit",
        quantity_change=0,
        notes="Component parameters updated."
    )
    db.add(db_tx)
    db.commit()
    db.refresh(db_part)
    
    db_part.total_quantity = sum(s.quantity for s in db_part.storage_records)
    return db_part

@router.post("/{item_id}/stock", response_model=schemas.PartOut)
def update_item_stock(
    item_id: int,
    payload: ItemStockUpdateCompat,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Check-in or check-out stock. Maps directly to storage bin quantities.
    """
    action = payload.action_type.lower()
    if action == "check_in":
        if current_user.role not in ("admin", "stocker"):
            raise HTTPException(status_code=403, detail="Stocker permissions required for check-in.")
    elif action == "check_out":
        if current_user.role not in ("admin", "puller"):
            raise HTTPException(status_code=403, detail="Puller permissions required for check-out.")
    else:
        raise HTTPException(status_code=400, detail="Invalid action_type.")
        
    db_part = db.query(models.Part).filter(models.Part.id == item_id).first()
    if not db_part:
        raise HTTPException(status_code=404, detail="Part component not found.")
        
    change = abs(payload.quantity_change)
    qty_change = change if action == "check_in" else -change
    
    # Resolve which storage slot to edit
    storage_slot = None
    if payload.location_id:
        storage_slot = db.query(models.Storage).filter(
            models.Storage.id == payload.location_id,
            models.Storage.part_id == item_id
        ).first()
        if not storage_slot and action == "check_in":
            # If not assigned yet, verify storage slot exists and assign
            target_storage = db.query(models.Storage).filter(models.Storage.id == payload.location_id).first()
            if target_storage:
                if target_storage.part_id is None:
                    target_storage.part_id = item_id
                    storage_slot = target_storage
                else:
                    # Slot is occupied, create a sub-bin
                    storage_slot = models.Storage(
                        parent_id=target_storage.id,
                        name=f"Bin for {db_part.value}",
                        part_id=item_id,
                        quantity=0
                    )
                    db.add(storage_slot)
                    db.commit()
                    db.refresh(storage_slot)
    
    # If no specific storage slot is resolved, fallback to the first available slot
    if not storage_slot:
        storage_slot = db.query(models.Storage).filter(models.Storage.part_id == item_id).first()
        
    if not storage_slot:
        if action == "check_out":
            raise HTTPException(status_code=400, detail="Cannot pull stock because this part has no stored inventory.")
        # Check-in: find any root storage location to create a bin
        root_storage = db.query(models.Storage).filter(models.Storage.parent_id == None).first()
        parent_id = root_storage.id if root_storage else None
        storage_slot = models.Storage(
            parent_id=parent_id,
            name=f"Auto slot for {db_part.value}",
            part_id=item_id,
            quantity=0
        )
        db.add(storage_slot)
        db.commit()
        db.refresh(storage_slot)
        
    # Execute check_out validation
    if action == "check_out" and storage_slot.quantity < change:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient stock in bin '{storage_slot.name}'. Current: {storage_slot.quantity}, Requested: {change}"
        )
        
    storage_slot.quantity += qty_change
    storage_slot.last_counted = datetime.utcnow()
    
    # Save transaction
    db_tx = models.Transaction(
        part_id=item_id,
        user_id=current_user.id,
        action_type=action,
        quantity_change=qty_change,
        notes=payload.notes or f"Stock updated via quick action."
    )
    db.add(db_tx)
    db.commit()
    db.refresh(db_part)
    
    db_part.total_quantity = sum(s.quantity for s in db_part.storage_records)
    return db_part

@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_admin)
):
    """
    Permanently delete a part from the database. Admins only.
    """
    db_part = db.query(models.Part).filter(models.Part.id == item_id).first()
    if not db_part:
        raise HTTPException(status_code=404, detail="Part component not found.")
    db.delete(db_part)
    db.commit()
    return
