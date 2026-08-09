import os
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Response, status
from sqlalchemy.orm import Session
from ..database import get_db
from .. import models, schemas, auth

router = APIRouter(prefix="", tags=["documents_and_uploads"])

@router.post("/uploads/item/{item_id}", response_model=schemas.AttachmentOut, status_code=status.HTTP_201_CREATED)
async def upload_item_file(
    item_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_stocker)
):
    """
    Upload an image attachment for an inventory part component.
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
        
    db_attachment = models.Image(
        part_id=item_id,
        caption=safe_filename,
        content=file_bytes
    )
    db.add(db_attachment)
    
    db_tx = models.Transaction(
        part_id=item_id,
        user_id=current_user.id,
        action_type="edit",
        quantity_change=0,
        notes=f"Uploaded photo: {safe_filename}."
    )
    db.add(db_tx)
    db.commit()
    db.refresh(db_attachment)
    
    return schemas.AttachmentOut(
        id=db_attachment.id,
        filename=safe_filename,
        file_type="image",
        part_id=item_id,
        created_on=db_attachment.created_on
    )

@router.get("/uploads/file/{item_id}/{filename}")
def serve_file(
    item_id: int,
    filename: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_analyst)
):
    """
    Serve uploaded images from the database.
    """
    img = db.query(models.Image).filter(
        models.Image.part_id == item_id,
        models.Image.caption == filename
    ).first()
    if img:
        media_type = "image/png"
        if filename.lower().endswith(".jpg") or filename.lower().endswith(".jpeg"):
            media_type = "image/jpeg"
        elif filename.lower().endswith(".gif"):
            media_type = "image/gif"
        return Response(content=img.content, media_type=media_type)

    raise HTTPException(status_code=404, detail="File not found in database.")

@router.delete("/uploads/{attachment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_attachment(
    attachment_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_stocker)
):
    """
    Delete an image attachment.
    """
    img = db.query(models.Image).filter(models.Image.id == attachment_id).first()
    if not img:
        raise HTTPException(status_code=404, detail="Image attachment not found.")
    db.delete(img)
    db.commit()
    return

# --- Clean Document Routes ---

@router.get("/api/documents/{id}/download")
def download_document(
    id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_analyst)
):
    """
    Returns the actual file BLOB with appropriate content type headers.
    """
    doc = db.query(models.Document).filter(models.Document.id == id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")
        
    media_type = "application/octet-stream"
    if doc.filename.lower().endswith(".pdf"):
        media_type = "application/pdf"
        
    from fastapi.responses import Response
    return Response(
        content=doc.content,
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename={doc.filename}"}
    )

@router.delete("/api/documents/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(
    id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_stocker)
):
    """
    Removes the document from the database.
    """
    doc = db.query(models.Document).filter(models.Document.id == id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")
    db.delete(doc)
    db.commit()
    return

