import os
import shutil
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from ..database import get_db
from .. import models, schemas, auth

router = APIRouter(prefix="/uploads", tags=["uploads"])

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
UPLOAD_DIR = os.path.join(BASE_DIR, "data", "uploads")

# Create folder on module import
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/item/{item_id}", response_model=schemas.AttachmentOut, status_code=status.HTTP_201_CREATED)
def upload_item_file(
    item_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_stocker)  # Stocker or Admin can upload
):
    """
    Upload an attachment (photo, datasheet, drawings) for an inventory item.
    Saves the file to local server storage and creates an attachment record.
    """
    item = db.query(models.Item).filter(models.Item.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found.")
        
    # Standardize filename and resolve path
    safe_filename = os.path.basename(file.filename)
    if not safe_filename:
        raise HTTPException(status_code=400, detail="Invalid filename.")
        
    # Group uploads under item-specific folders
    item_folder = os.path.join(UPLOAD_DIR, str(item_id))
    os.makedirs(item_folder, exist_ok=True)
    
    file_path = os.path.join(item_folder, safe_filename)
    relative_path = f"uploads/{item_id}/{safe_filename}"
    
    try:
        # Save file to disk
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not save file to disk: {str(e)}"
        )
        
    # Check if image or document
    content_type = file.content_type or ""
    file_type = "image" if content_type.startswith("image/") else "document"
    
    db_attachment = models.Attachment(
        item_id=item_id,
        filename=safe_filename,
        file_type=file_type,
        file_path=relative_path,
        uploaded_by_id=current_user.id
    )
    db.add(db_attachment)
    
    # Also log an edit transaction on the item
    db_tx = models.Transaction(
        item_id=item_id,
        user_id=current_user.id,
        action_type="edit",
        quantity_change=0,
        notes=f"Uploaded attachment: {safe_filename}."
    )
    db.add(db_tx)
    
    db.commit()
    db.refresh(db_attachment)
    return db_attachment

@router.get("/file/{item_id}/{filename}")
def serve_file(
    item_id: int,
    filename: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_analyst)
):
    """
    Serve uploaded documents or images from disk.
    Requires at least Analyst permissions.
    """
    # Build exact physical path
    physical_path = os.path.join(UPLOAD_DIR, str(item_id), os.path.basename(filename))
    if not os.path.exists(physical_path):
        raise HTTPException(status_code=404, detail="File not found on server.")
        
    return FileResponse(physical_path)

@router.delete("/{attachment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_attachment(
    attachment_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_stocker)
):
    """
    Delete an attachment. Deletes the database record and removes the physical file.
    """
    attachment = db.query(models.Attachment).filter(models.Attachment.id == attachment_id).first()
    if not attachment:
        raise HTTPException(status_code=404, detail="Attachment not found.")
        
    # Resolve physical path
    parts = attachment.file_path.split("/")
    if len(parts) >= 3:
        physical_path = os.path.join(UPLOAD_DIR, parts[1], parts[2])
        if os.path.exists(physical_path):
            try:
                os.remove(physical_path)
            except Exception as e:
                print(f"Failed to delete physical file {physical_path}: {e}")
                
    db.delete(attachment)
    db.commit()
    return
