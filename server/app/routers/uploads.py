import os
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Response, status
from sqlalchemy.orm import Session
from ..database import get_db
from .. import models, schemas, auth

router = APIRouter(prefix="", tags=["documents_and_uploads"])

@router.get("/api/images/{id}/render")
def render_image(
    id: str,
    db: Session = Depends(get_db)
):
    """
    Returns the actual binary BLOB for rendering in browser.
    """
    img = db.query(models.Image).filter(models.Image.id == id).first()
    if not img:
        raise HTTPException(status_code=404, detail="Image not found.")
    
    # Dynamic media type detection based on magic bytes & caption extension fallback
    media_type = "image/png"
    if img.content:
        header = img.content[:12]
        if header.startswith(b'\xff\xd8\xff'):
            media_type = "image/jpeg"
        elif header.startswith(b'\x89PNG\r\n\x1a\n'):
            media_type = "image/png"
        elif header.startswith(b'GIF8'):
            media_type = "image/gif"
        elif header.startswith(b'RIFF') and b'WEBP' in header:
            media_type = "image/webp"
        elif b'<svg' in header.lower():
            media_type = "image/svg+xml"
        elif img.caption:
            cap = img.caption.lower()
            if cap.endswith(".jpg") or cap.endswith(".jpeg"):
                media_type = "image/jpeg"
            elif cap.endswith(".webp"):
                media_type = "image/webp"
            elif cap.endswith(".gif"):
                media_type = "image/gif"
            elif cap.endswith(".svg"):
                media_type = "image/svg+xml"
    return Response(content=img.content, media_type=media_type)

@router.delete("/api/images/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_image(
    id: str,
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
    id: str,
    inline: bool = False,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_analyst)
):
    """
    Returns the actual file BLOB with appropriate content type headers.
    """
    doc = db.query(models.Document).filter(models.Document.id == id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")
        
    import mimetypes
    guessed_type, _ = mimetypes.guess_type(doc.filename)
    media_type = guessed_type or "application/octet-stream"
        
    from fastapi.responses import Response
    disposition = "inline" if inline else "attachment"
    return Response(
        content=doc.content,
        media_type=media_type,
        headers={"Content-Disposition": f'{disposition}; filename="{doc.filename}"'}
    )

@router.delete("/api/documents/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(
    id: str,
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

