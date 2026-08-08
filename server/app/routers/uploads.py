import os
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Response, status
from sqlalchemy.orm import Session
from ..database import get_db
from .. import models, schemas, auth

router = APIRouter(prefix="/uploads", tags=["uploads"])

@router.post("/item/{item_id}", response_model=schemas.AttachmentOut, status_code=status.HTTP_201_CREATED)
async def upload_item_file(
    item_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_stocker)  # Stocker or Admin can upload
):
    """
    Upload an attachment (photo, datasheet, drawings) for an inventory part component.
    Saves the file directly into the database as a BLOB (Image or Document).
    """
    part = db.query(models.Part).filter(models.Part.id == item_id).first()
    if not part:
        raise HTTPException(status_code=404, detail="Part component not found.")
        
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
        
    content_type = file.content_type or ""
    is_image = content_type.startswith("image/")
    
    if is_image:
        db_attachment = models.Image(
            part_id=item_id,
            caption=safe_filename,
            content=file_bytes
        )
        db.add(db_attachment)
        db.commit()
        db.refresh(db_attachment)
        
        # Unique ID mapping for frontend compatibility
        attach_id = db_attachment.id
        file_type = "image"
    else:
        db_attachment = models.Document(
            part_id=item_id,
            label=safe_filename,
            filename=safe_filename,
            content=file_bytes
        )
        db.add(db_attachment)
        db.commit()
        db.refresh(db_attachment)
        
        # Unique ID mapping for frontend compatibility (negative)
        attach_id = -db_attachment.id
        file_type = "document"
        
    # Also log an edit transaction on the part
    db_tx = models.Transaction(
        part_id=item_id,
        user_id=current_user.id,
        action_type="edit",
        quantity_change=0,
        notes=f"Uploaded attachment: {safe_filename}."
    )
    db.add(db_tx)
    db.commit()
    
    return schemas.AttachmentOut(
        id=attach_id,
        filename=safe_filename,
        file_type=file_type,
        part_id=item_id,
        created_on=db_attachment.created_on
    )

@router.get("/file/{item_id}/{filename}")
def serve_file(
    item_id: int,
    filename: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_analyst)
):
    """
    Serve uploaded documents or images from the database.
    Requires at least Analyst permissions.
    """
    # Try images first
    img = db.query(models.Image).filter(
        models.Image.part_id == item_id,
        models.Image.caption == filename
    ).first()
    if img:
        # Guess media type
        media_type = "image/png"
        if filename.lower().endswith(".jpg") or filename.lower().endswith(".jpeg"):
            media_type = "image/jpeg"
        elif filename.lower().endswith(".gif"):
            media_type = "image/gif"
        return Response(content=img.content, media_type=media_type)

    # Try documents next
    doc = db.query(models.Document).filter(
        models.Document.part_id == item_id,
        models.Document.filename == filename
    ).first()
    if doc:
        media_type = "application/octet-stream"
        if filename.lower().endswith(".pdf"):
            media_type = "application/pdf"
        return Response(content=doc.content, media_type=media_type)

    raise HTTPException(status_code=404, detail="File not found in database.")

@router.delete("/{attachment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_attachment(
    attachment_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_stocker)
):
    """
    Delete an attachment (image or document) from the database by its mapped ID.
    """
    if attachment_id > 0:
        img = db.query(models.Image).filter(models.Image.id == attachment_id).first()
        if not img:
            raise HTTPException(status_code=404, detail="Image attachment not found.")
        db.delete(img)
    else:
        doc = db.query(models.Document).filter(models.Document.id == -attachment_id).first()
        if not doc:
            raise HTTPException(status_code=404, detail="Document attachment not found.")
        db.delete(doc)
        
    db.commit()
    return
