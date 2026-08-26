import re
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from ..database import get_db
from .. import models, auth

router = APIRouter(prefix="/resolve", tags=["resolution"])

class ResolveResponse(BaseModel):
    entity_type: str  # "location" | "part"
    entity_id: str
    display_name: str
    breadcrumb: str
    target_route: str

def get_location_breadcrumb(storage: models.Storage, db: Session) -> str:
    """
    Recursively builds a human-readable hierarchical breadcrumb path for a storage location.
    e.g. "Main Cabinet > Shelf 2 > Drawer 1 > Bin A1"
    """
    path_nodes = [storage.name]
    current = storage
    
    # Traverse parent pointers up to root node
    while current.parent_id:
        parent = db.query(models.Storage).filter(models.Storage.id == current.parent_id).first()
        if not parent:
            break
        path_nodes.append(parent.name)
        current = parent

    path_nodes.reverse()
    return " > ".join(path_nodes)

def parse_payload_identifier(raw_payload: str) -> tuple[Optional[str], Optional[str]]:
    """
    Extracts (entity_hint, identifier) from a raw payload string.
    Supports fuse:// URIs, query parameters, and raw UUID strings.
    """
    if not raw_payload:
        return None, None

    cleaned = raw_payload.strip()

    # Handle fuse:// scheme
    if cleaned.lower().startsWith("fuse://") if hasattr(cleaned, "startsWith") else cleaned.lower().startswith("fuse://"):
        without_scheme = re.sub(r"^fuse://", "", cleaned, flags=re.IGNORECASE)
        parts = without_scheme.split("?")[0].split("/")
        parts = [p for p in parts if p]
        
        hint = parts[0].lower() if parts else None
        target_id = parts[1] if len(parts) > 1 else None

        # Handle query string fallback e.g. fuse://storage?location=xxx
        if not target_id and "?" in without_scheme:
            query_part = without_scheme.split("?", 1)[1]
            for kv in query_part.split("&"):
                if "=" in kv:
                    k, v = kv.split("=", 1)
                    if k.lower() in ["id", "location", "part", "resolve"]:
                        target_id = v
                        if k.lower() in ["location", "part"]:
                            hint = k.lower()
                        break

        return hint, target_id or (parts[0] if parts and len(parts) == 1 else None)

    # Fallback to raw ID/UUID
    return None, cleaned

@router.get("/{payload:path}", response_model=ResolveResponse)
def resolve_scanned_payload(
    payload: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_analyst)
):
    """
    Lightning-fast entity resolver endpoint for barcodes, DataMatrix labels, and NFC NDEF records.
    Parses 'fuse://' URIs or raw UUIDs and returns entity details, hierarchical breadcrumbs, and target routes.
    """
    hint, target_id = parse_payload_identifier(payload)

    # Attempt resolution by location ID first if hint is location/storage or no hint
    if target_id:
        if hint in [None, "location", "storage"]:
            storage = db.query(models.Storage).filter(models.Storage.id == target_id).first()
            if storage:
                breadcrumb = get_location_breadcrumb(storage, db)
                return ResolveResponse(
                    entity_type="location",
                    entity_id=storage.id,
                    display_name=storage.name,
                    breadcrumb=breadcrumb,
                    target_route=f"/storage?location={storage.id}"
                )

        if hint in [None, "part", "parts"]:
            part = db.query(models.Part).filter(models.Part.id == target_id).first()
            if part:
                part_name = f"{part.number} ({part.value})"
                return ResolveResponse(
                    entity_type="part",
                    entity_id=part.id,
                    display_name=part_name,
                    breadcrumb=f"Part: {part_name}",
                    target_route=f"/parts/{part.id}"
                )

    # Fallback search if hint did not match: check Storage then Part using the raw payload as string
    storage_fallback = db.query(models.Storage).filter(models.Storage.id == payload).first()
    if storage_fallback:
        breadcrumb = get_location_breadcrumb(storage_fallback, db)
        return ResolveResponse(
            entity_type="location",
            entity_id=storage_fallback.id,
            display_name=storage_fallback.name,
            breadcrumb=breadcrumb,
            target_route=f"/storage?location={storage_fallback.id}"
        )

    part_fallback = db.query(models.Part).filter(models.Part.id == payload).first()
    if part_fallback:
        part_name = f"{part_fallback.number} ({part_fallback.value})"
        return ResolveResponse(
            entity_type="part",
            entity_id=part_fallback.id,
            display_name=part_name,
            breadcrumb=f"Part: {part_name}",
            target_route=f"/parts/{part_fallback.id}"
        )

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"No storage location or part found matching payload: '{payload}'"
    )
