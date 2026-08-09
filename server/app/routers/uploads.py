import os
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Response, status
from sqlalchemy.orm import Session
from ..database import get_db
from .. import models, schemas, auth

router = APIRouter(prefix="", tags=["documents_and_uploads"])

@router.get("/api/images/{id}/render")
def render_image(
    id: int,
    db: Session = Depends(get_db)
):
    """
    Returns the actual binary BLOB for rendering in browser.
    """
    img = db.query(models.Image).filter(models.Image.id == id).first()
    if not img:
        raise HTTPException(status_code=404, detail="Image not found.")
    
    # Simple media type detection
    media_type = "image/png"
    return Response(content=img.content, media_type=media_type)

@router.delete("/api/images/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_image(
    id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_stocker)
):
    """
    Delete an image from the database.
    """
    img = db.query(models.Image).filter(models.Image.id == id).first()
    if not img:
        raise HTTPException(status_code=404, detail="Image not found.")
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

