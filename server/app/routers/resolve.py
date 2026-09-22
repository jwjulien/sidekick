import re
import urllib.parse
from typing import Optional, List, Tuple
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session
from ..database import get_db
from .. import models, auth
from ..schemas import ResolveResponse

router = APIRouter(prefix="/resolve", tags=["resolution"])

def get_location_breadcrumb(storage: models.Storage, db: Session) -> str:
    """
    Recursively builds a human-readable hierarchical breadcrumb path for a storage location.
    e.g. "Main Cabinet > Shelf 2 > Drawer 1 > Bin A1"
    """
    path_nodes = [storage.name]
    current = storage
    visited = {current.id}
    
    # Traverse parent pointers up to root node
    while current.parent_id and current.parent_id not in visited:
        visited.add(current.parent_id)
        parent = db.query(models.Storage).filter(models.Storage.id == current.parent_id).first()
        if not parent:
            break
        path_nodes.append(parent.name)
        current = parent

    path_nodes.reverse()
    return " > ".join(path_nodes)

def parse_payload_identifier(raw_payload: str) -> tuple[Optional[str], Optional[str]]:
    """
    Extracts (entity_hint, identifier_or_path) from a raw payload string.
    Supports fuse:// URIs, location/..., part/..., and raw strings.
    """
    if not raw_payload:
        return None, None

    cleaned = urllib.parse.unquote(raw_payload).strip()

    # Handle fuse:// scheme
    if cleaned.lower().startswith("fuse://"):
        without_scheme = re.sub(r"^fuse://", "", cleaned, flags=re.IGNORECASE)
        target_id = None
        hint = None
        
        without_query = without_scheme.split("?")[0]
        parts = [p for p in without_query.split("/") if p]
        
        if parts:
            first = parts[0].lower()
            if first in ["location", "locations"]:
                hint = "location"
                target_id = "/".join(parts[1:]) if len(parts) > 1 else None
            elif first in ["part", "parts"]:
                hint = "part"
                target_id = "/".join(parts[1:]) if len(parts) > 1 else None
            elif first in ["resolve"]:
                hint = None
                target_id = "/".join(parts[1:]) if len(parts) > 1 else None
            else:
                hint = None
                target_id = "/".join(parts)

        # Fallback to query parameter if target_id is empty
        if not target_id and "?" in without_scheme:
            query_part = without_scheme.split("?", 1)[1]
            for kv in query_part.split("&"):
                if "=" in kv:
                    k, v = kv.split("=", 1)
                    if k.lower() in ["id", "location", "part", "resolve", "q"]:
                        target_id = v
                        if k.lower() in ["location", "locations"]:
                            hint = "location"
                        elif k.lower() in ["part", "parts"]:
                            hint = "part"
                        break

        return hint, target_id or (parts[0] if parts and len(parts) == 1 else None)

    # Handle location/... or /location/... without fuse://
    cleaned_slash = cleaned.lstrip("/")
    if cleaned_slash.lower().startswith("location/"):
        return "location", cleaned_slash[len("location/"):]
    if cleaned_slash.lower().startswith("part/"):
        return "part", cleaned_slash[len("part/"):]

    return None, cleaned

def name_matches(node_name: str, seg: str) -> bool:
    if not node_name or not seg:
        return False
    nn = node_name.strip().lower()
    s = seg.strip().lower()
    if nn == s:
        return True
    if nn == s.replace("_", " "):
        return True
    if nn.replace("_", " ") == s.replace("_", " "):
        return True
    return False

def resolve_hierarchical_location_path(
    path_str: str,
    db: Session
) -> Optional[tuple[models.Storage, str, Optional[str]]]:
    """
    Attempts to resolve a hierarchical path (e.g. 'Rack_A/Shelf_1/Bin_2' or 'Rack A > Shelf 1 > Bin 2').
    Traverses from candidate root nodes matching segment 0.
    If a leaf or subsequent segment is missing, recursively returns the deepest surviving ancestor.
    Returns (matched_storage, match_type, fallback_ancestor_name) or None if no root matches.
    """
    if not path_str:
        return None

    # Normalize path separators
    norm = path_str.replace(" > ", "/").replace(">", "/")
    segments = [s.strip() for s in norm.split("/") if s.strip()]
    if not segments:
        return None

    # Find candidate roots matching segments[0]
    root_candidates = db.query(models.Storage).filter(models.Storage.parent_id == None).all()
    matching_roots = [r for r in root_candidates if name_matches(r.name, segments[0])]

    # If no root node matches, search all nodes matching segments[0] (in case query started mid-tree)
    if not matching_roots:
        all_nodes = db.query(models.Storage).all()
        matching_roots = [n for n in all_nodes if name_matches(n.name, segments[0])]

    if not matching_roots:
        return None

    best_match = None
    best_depth = 0

    for candidate in matching_roots:
        current = candidate
        depth = 1
        for seg in segments[1:]:
            children = db.query(models.Storage).filter(models.Storage.parent_id == current.id).all()
            matched_child = next((c for c in children if name_matches(c.name, seg)), None)
            if matched_child:
                current = matched_child
                depth += 1
            else:
                break

        if depth > best_depth:
            best_depth = depth
            best_match = current

    if not best_match:
        return None

    if best_depth == len(segments):
        return (best_match, "exact", None)
    else:
        return (best_match, "ancestor_fallback", best_match.name)

@router.get("", response_model=ResolveResponse)
@router.get("/{payload:path}", response_model=ResolveResponse)
def resolve_scanned_payload(
    payload: Optional[str] = None,
    q: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_analyst)
):
    """
    Lightning-fast entity resolver endpoint for barcodes, DataMatrix labels, and NFC NDEF records.
    Parses 'fuse://' URIs, raw UUIDs, or hierarchical paths, returning entity details,
    hierarchical breadcrumbs, target routes, and ancestor fallbacks if leaf nodes are missing.
    """
    raw_input = q or payload
    if not raw_input:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing payload or query parameter for entity resolution."
        )

    unquoted = urllib.parse.unquote(raw_input).strip()
    hint, target_id = parse_payload_identifier(unquoted)

    # 1. Attempt direct UUID / ID lookup on Storage
    if target_id and hint in [None, "location"]:
        storage = db.query(models.Storage).filter(func.lower(models.Storage.id) == target_id.lower()).first()
        if storage:
            breadcrumb = get_location_breadcrumb(storage, db)
            return ResolveResponse(
                entity_type="location",
                entity_id=storage.id,
                id=storage.id,
                display_name=storage.name,
                breadcrumb=breadcrumb,
                target_route=f"/storage?location={storage.id}",
                route=f"/storage?location={storage.id}",
                match_type="exact",
                requested_query=raw_input,
                fallback_ancestor=None
            )

    # 2. Attempt direct UUID / ID lookup on Part
    if target_id and hint in [None, "part", "parts"]:
        part = db.query(models.Part).filter(func.lower(models.Part.id) == target_id.lower()).first()
        if part:
            part_name = f"{part.number} ({part.value})"
            return ResolveResponse(
                entity_type="part",
                entity_id=part.id,
                id=part.id,
                display_name=part_name,
                breadcrumb=f"Part: {part_name}",
                target_route=f"/parts/{part.id}",
                route=f"/parts/{part.id}",
                match_type="exact",
                requested_query=raw_input,
                fallback_ancestor=None
            )

    # 3. Attempt hierarchical location path resolution with recursive ancestor fallback
    query_for_path = target_id or unquoted
    if hint in [None, "location"]:
        path_res = resolve_hierarchical_location_path(query_for_path, db)
        if path_res:
            matched_storage, match_type, fallback_ancestor = path_res
            breadcrumb = get_location_breadcrumb(matched_storage, db)
            return ResolveResponse(
                entity_type="location",
                entity_id=matched_storage.id,
                id=matched_storage.id,
                display_name=matched_storage.name,
                breadcrumb=breadcrumb,
                target_route=f"/storage?location={matched_storage.id}",
                route=f"/storage?location={matched_storage.id}",
                match_type=match_type,
                requested_query=raw_input,
                fallback_ancestor=fallback_ancestor
            )

    # 4. Fallback search by string match on Storage.id
    storage_fallback = db.query(models.Storage).filter(func.lower(models.Storage.id) == unquoted.lower()).first()
    if storage_fallback:
        breadcrumb = get_location_breadcrumb(storage_fallback, db)
        return ResolveResponse(
            entity_type="location",
            entity_id=storage_fallback.id,
            id=storage_fallback.id,
            display_name=storage_fallback.name,
            breadcrumb=breadcrumb,
            target_route=f"/storage?location={storage_fallback.id}",
            route=f"/storage?location={storage_fallback.id}",
            match_type="exact",
            requested_query=raw_input,
            fallback_ancestor=None
        )

    # 5. Fallback search by string match on Part.id or Part.number
    part_fallback = db.query(models.Part).filter(
        (func.lower(models.Part.id) == unquoted.lower()) |
        (func.lower(models.Part.number) == unquoted.lower())
    ).first()
    if part_fallback:
        part_name = f"{part_fallback.number} ({part_fallback.value})"
        return ResolveResponse(
            entity_type="part",
            entity_id=part_fallback.id,
            id=part_fallback.id,
            display_name=part_name,
            breadcrumb=f"Part: {part_name}",
            target_route=f"/parts/{part_fallback.id}",
            route=f"/parts/{part_fallback.id}",
            match_type="exact",
            requested_query=raw_input,
            fallback_ancestor=None
        )

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"No storage location or part found matching payload: '{unquoted}'"
    )
