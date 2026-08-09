from typing import List, Optional, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status, Request, UploadFile, File, Form
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from pydantic import BaseModel
import json
from ..database import get_db
from .. import models, schemas, auth

router = APIRouter(prefix="/parts", tags=["parts"])

@router.get("", response_model=List[schemas.PartOut])
def get_parts(
    request: Request,
    q: Optional[str] = Query(None, description="Search term for part value, number, package, or notes"),
    category_id: Optional[int] = Query(None),
    location_id: Optional[int] = Query(None),
    low_stock: Optional[bool] = Query(None, description="Filter parts falling below alert threshold"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_analyst)
):
    """
    Get parts with optional search, category, location, dynamic JSON attribute filters, and low-stock filters.
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
        
    # Dynamic JSON Filtering
    for key, value in request.query_params.items():
        if key.startswith("attr_"):
            attr_key = key[5:] # Strip "attr_"
            # Use SQLite json_extract to filter
            query = query.filter(func.json_extract(models.Part.attributes, f"$.{attr_key}") == value)
            
    parts = query.all()
    
    # Calculate quantities and filter low stock
    result = []
    for p in parts:
        total_qty = sum(s.quantity for s in p.storage_records)
        p.total_quantity = total_qty
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
def create_part(
    payload: schemas.PartCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_stocker)
):
    """
    Create a new part component with dynamic JSON attributes.
    """
    # Enforce category exists
    category = db.query(models.Category).filter(models.Category.id == payload.category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found.")
        
    # Check uniqueness of manufacturer part number
    if payload.number:
        existing = db.query(models.Part).filter(models.Part.number == payload.number).first()
        if existing:
            raise HTTPException(status_code=400, detail="A component with this part number already exists.")
            
    db_part = models.Part(
        category_id=payload.category_id,
        value=payload.value,
        number=payload.number,
        package=payload.package or "0805",
        price=payload.price or 0.0,
        weight=payload.weight or 0.0,
        threshold=payload.threshold or 0,
        notes=payload.notes or "",
        attributes=payload.attributes or {}
    )
    db.add(db_part)
    db.commit()
    db.refresh(db_part)
    
    # Write audit log transaction
    db_tx = models.Transaction(
        part_id=db_part.id,
        user_id=current_user.id,
        action_type="create",
        quantity_change=0,
        notes="Component registered in catalog."
    )
    db.add(db_tx)
    db.commit()
    
    db_part.total_quantity = 0
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

@router.get("/{part_id}", response_model=schemas.PartDetailsOut)
def get_part(
    part_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_analyst)
):
    """
    Get full details of a part component.
    """
    part = db.query(models.Part).filter(models.Part.id == part_id).first()
    if not part:
        raise HTTPException(status_code=404, detail="Part component not found.")
        
    part.total_quantity = sum(s.quantity for s in part.storage_records)
    return part

@router.get("/{part_id}/images", response_model=List[schemas.ImageOut])
def get_part_images(
    part_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_analyst)
):
    """
    Get all images/photos for a part (excluding binary payload).
    """
    part = db.query(models.Part).filter(models.Part.id == part_id).first()
    if not part:
        raise HTTPException(status_code=404, detail="Part component not found.")
    return part.images

@router.post("/{part_id}/images", response_model=schemas.ImageOut, status_code=status.HTTP_201_CREATED)
async def upload_part_image(
    part_id: int,
    file: UploadFile = File(...),
    caption: Optional[str] = Form(None),
    notes: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_stocker)
):
    """
    Upload a picture attachment directly linked to the Part.
    """
    part = db.query(models.Part).filter(models.Part.id == part_id).first()
    if not part:
        raise HTTPException(status_code=404, detail="Part component not found.")
        
    import os
    safe_filename = os.path.basename(file.filename)
    if not safe_filename:
        raise HTTPException(status_code=400, detail="Invalid filename.")
        
    try:
        file_bytes = await file.read()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not read upload file: {str(e)}"
        )
        
    db_image = models.Image(
        part_id=part_id,
        caption=caption or safe_filename,
        notes=notes,
        content=file_bytes
    )
    db.add(db_image)
    
    db_tx = models.Transaction(
        part_id=part_id,
        user_id=current_user.id,
        action_type="edit",
        quantity_change=0,
        notes=f"Uploaded image: {caption or safe_filename}."
    )
    db.add(db_tx)
    db.commit()
    db.refresh(db_image)
    
    return db_image

class ImageUrlPayload(BaseModel):
    url: str
    caption: Optional[str] = None
    notes: Optional[str] = None

class DocumentUrlPayload(BaseModel):
    url: str
    label: Optional[str] = None

@router.post("/{part_id}/images/url", response_model=schemas.ImageOut, status_code=status.HTTP_201_CREATED)
async def download_part_image_url(
    part_id: int,
    payload: ImageUrlPayload,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_stocker)
):
    """
    Download an image from a remote URL and attach it to the Part.
    """
    part = db.query(models.Part).filter(models.Part.id == part_id).first()
    if not part:
        raise HTTPException(status_code=404, detail="Part component not found.")
        
    import urllib.request
    try:
        # Fetch file contents
        req = urllib.request.Request(
            payload.url, 
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
        )
        with urllib.request.urlopen(req, timeout=10) as response:
            file_bytes = response.read()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to download image from URL: {str(e)}"
        )
    default_caption = payload.caption or payload.url.split("/")[-1].split("?")[0] or "Downloaded Image"
        
    db_image = models.Image(
        part_id=part_id,
        caption=default_caption,
        notes=payload.notes,
        content=file_bytes
    )
    db.add(db_image)
    
    db_tx = models.Transaction(
        part_id=part_id,
        user_id=current_user.id,
        action_type="edit",
        quantity_change=0,
        notes=f"Downloaded and attached image from URL: {default_caption}."
    )
    db.add(db_tx)
    db.commit()
    db.refresh(db_image)
    
    return db_image

@router.post("/{part_id}/documents/url", response_model=schemas.DocumentOut, status_code=status.HTTP_201_CREATED)
async def download_part_document_url(
    part_id: int,
    payload: DocumentUrlPayload,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_stocker)
):
    """
    Download a document from a remote URL and attach it to the Part.
    """
    part = db.query(models.Part).filter(models.Part.id == part_id).first()
    if not part:
        raise HTTPException(status_code=404, detail="Part component not found.")
        
    import urllib.request
    from urllib.error import URLError, HTTPError
    
    try:
        req = urllib.request.Request(
            payload.url, 
            headers={'User-Agent': 'Mozilla/5.0'}
        )
        with urllib.request.urlopen(req, timeout=10) as response:
            file_bytes = response.read()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to download document from URL: {str(e)}"
        )
        
    # Attempt to extract a sensible filename
    filename = payload.url.split("/")[-1].split("?")[0]
    if not filename or "." not in filename:
        filename = "document.pdf"  # Fallback
        
    default_label = payload.label or filename
        
    db_document = models.Document(
        part_id=part_id,
        label=default_label,
        filename=filename,
        content=file_bytes
    )
    db.add(db_document)
    
    db_tx = models.Transaction(
        part_id=part_id,
        user_id=current_user.id,
        action_type="edit",
        quantity_change=0,
        notes=f"Downloaded and attached document from URL: {default_label}."
    )
    db.add(db_tx)
    db.commit()
    db.refresh(db_document)
    
    return db_document


@router.get("/{part_id}/documents", response_model=List[schemas.DocumentOut])
def get_part_documents(
    part_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_analyst)
):
    """
    Get all documents for a part (excluding heavy BLOB contents).
    """
    part = db.query(models.Part).filter(models.Part.id == part_id).first()
    if not part:
        raise HTTPException(status_code=404, detail="Part component not found.")
    return part.documents

from fastapi import UploadFile, File, Form
@router.post("/{part_id}/documents", response_model=schemas.DocumentOut, status_code=status.HTTP_201_CREATED)
async def upload_part_document(
    part_id: int,
    file: UploadFile = File(...),
    label: str = Form(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_stocker)
):
    """
    Upload a document datasheet/file directly linked to the Part.
    """
    part = db.query(models.Part).filter(models.Part.id == part_id).first()
    if not part:
        raise HTTPException(status_code=404, detail="Part component not found.")
    
    import os
    safe_filename = os.path.basename(file.filename)
    if not safe_filename:
        raise HTTPException(status_code=400, detail="Invalid filename.")
        
    try:
        file_bytes = await file.read()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not read upload file: {str(e)}"
        )
        
    db_document = models.Document(
        part_id=part_id,
        label=label,
        filename=safe_filename,
        content=file_bytes
    )
    db.add(db_document)
    
    # Audit log
    db_tx = models.Transaction(
        part_id=part_id,
        user_id=current_user.id,
        action_type="edit",
        quantity_change=0,
        notes=f"Uploaded document: {label} ({safe_filename})."
    )
    db.add(db_tx)
    db.commit()
    db.refresh(db_document)
    
    return db_document


@router.put("/{part_id}", response_model=schemas.PartOut)
def update_part(
    part_id: int,
    payload: schemas.PartUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_stocker)
):
    """
    Update part details.
    """
    db_part = db.query(models.Part).filter(models.Part.id == part_id).first()
    if not db_part:
        raise HTTPException(status_code=404, detail="Part component not found.")
        
    if payload.value is not None:
        db_part.value = payload.value
    if hasattr(payload, 'notes') and payload.notes is not None:
        db_part.notes = payload.notes
    if payload.number is not None:
        db_part.number = payload.number
    if hasattr(payload, 'threshold') and payload.threshold is not None:
        db_part.threshold = payload.threshold
    if payload.category_id is not None:
        db_part.category_id = payload.category_id
    if hasattr(payload, 'package') and payload.package is not None:
        db_part.package = payload.package
    if hasattr(payload, 'price') and payload.price is not None:
        db_part.price = payload.price
    if hasattr(payload, 'weight') and payload.weight is not None:
        db_part.weight = payload.weight
    if hasattr(payload, 'attributes') and payload.attributes is not None:
        db_part.attributes = payload.attributes
            
    db_tx = models.Transaction(
        part_id=part_id,
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

@router.post("/{part_id}/stock", response_model=schemas.PartOut)
def update_part_stock(
    part_id: int,
    payload: schemas.PartStockUpdate,
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
        if current_user.role not in ("admin", "stocker", "puller", "designer"):
            raise HTTPException(status_code=403, detail="Permissions required for check-out.")
    else:
        raise HTTPException(status_code=400, detail="Invalid action_type. Use check_in or check_out.")
        
    part = db.query(models.Part).filter(models.Part.id == part_id).first()
    if not part:
        raise HTTPException(status_code=404, detail="Part component not found.")
        
    # Verify location exists and is associated with this part, or associate it
    if payload.location_id:
        storage = db.query(models.Storage).filter(models.Storage.id == payload.location_id).first()
        if not storage:
            raise HTTPException(status_code=404, detail="Storage location not found.")
            
        if storage.part_id is None:
            storage.part_id = part.id
        elif storage.part_id != part.id:
            raise HTTPException(status_code=400, detail="This storage bin is already assigned to a different component.")
    else:
        # Auto-pick the primary storage location for this part, if any
        storage = db.query(models.Storage).filter(models.Storage.part_id == part.id).first()
        if not storage:
            # Create a virtual unsorted bin for this part
            storage = models.Storage(name=f"Unsorted {part.value}", part_id=part.id)
            db.add(storage)
            db.commit()
            db.refresh(storage)
            
    # Apply quantity
    if action == "check_in":
        storage.quantity += payload.quantity_change
    elif action == "check_out":
        if storage.quantity < payload.quantity_change:
            raise HTTPException(status_code=400, detail=f"Insufficient stock in bin. Available: {storage.quantity}")
        storage.quantity -= payload.quantity_change
        
    db.commit()
    
    # Audit log
    qty_signed = payload.quantity_change if action == "check_in" else -payload.quantity_change
    db_tx = models.Transaction(
        part_id=part.id,
        user_id=current_user.id,
        action_type=action,
        quantity_change=qty_signed,
        notes=payload.notes or f"{action.replace('_', ' ').title()} stock from UI."
    )
    db.add(db_tx)
    db.commit()
    
    part.total_quantity = sum(s.quantity for s in part.storage_records)
    return part

@router.delete("/{part_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_part(
    part_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_admin)
):
    """
    Delete a part component. Fails if there are dependent records like BOM links.
    """
    db_part = db.query(models.Part).filter(models.Part.id == part_id).first()
    if not db_part:
        raise HTTPException(status_code=404, detail="Part component not found.")
        
    # Check dependencies (like if it's used in a BOM)
    materials = db.query(models.Material).filter(models.Material.part_id == part_id).count()
    if materials > 0:
        raise HTTPException(status_code=400, detail="Cannot delete part: It is used in one or more Project BOMs.")
        
    # Also check if it's linked to suppliers
    products = db.query(models.Product).filter(models.Product.part_id == part_id).count()
    if products > 0:
        raise HTTPException(status_code=400, detail="Cannot delete part: It is linked to one or more Supplier Products.")
        
    db.delete(db_part)
    db.commit()
    return None

@router.get("/{part_id}/products", response_model=List[schemas.ProductOut])
def get_part_products(
    part_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_analyst)
):
    """
    Get all supplier products associated with a part. Requires Analyst role.
    """
    part = db.query(models.Part).filter(models.Part.id == part_id).first()
    if not part:
        raise HTTPException(status_code=404, detail="Part component not found.")
    return db.query(models.Product).filter(models.Product.part_id == part_id).all()
