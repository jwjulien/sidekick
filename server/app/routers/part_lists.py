import csv
import io
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload
from ..database import get_db
from .. import models, schemas, auth

router = APIRouter(prefix="/lists", tags=["part_lists"])

@router.get("", response_model=List[schemas.PartListOut])
def get_part_lists(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_any_user)
):
    """
    Get all part lists with item counts.
    """
    lists = db.query(models.PartList).order_by(models.PartList.modified_on.desc()).all()
    result = []
    for l in lists:
        out = schemas.PartListOut(
            id=l.id,
            name=l.name,
            description=l.description,
            type=l.type,
            is_active=l.is_active,
            created_on=l.created_on,
            modified_on=l.modified_on,
            item_count=len(l.items)
        )
        result.append(out)
    return result

@router.post("", response_model=schemas.PartListOut, status_code=status.HTTP_201_CREATED)
def create_part_list(
    payload: schemas.PartListCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_stocker)
):
    """
    Create a new part list.
    """
    if payload.is_active:
        # Deactivate all other lists
        db.query(models.PartList).update({"is_active": False})

    new_list = models.PartList(
        name=payload.name,
        description=payload.description,
        type=payload.type or "General",
        is_active=payload.is_active or False
    )
    db.add(new_list)
    db.commit()
    db.refresh(new_list)
    
    return schemas.PartListOut(
        id=new_list.id,
        name=new_list.name,
        description=new_list.description,
        type=new_list.type,
        is_active=new_list.is_active,
        created_on=new_list.created_on,
        modified_on=new_list.modified_on,
        item_count=0
    )

@router.get("/{list_id}", response_model=schemas.PartListDetailsOut)
def get_part_list_details(
    list_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_any_user)
):
    """
    Get detailed view of a single part list with items and part details.
    """
    part_list = db.query(models.PartList).options(
        joinedload(models.PartList.items).joinedload(models.PartListItem.part)
    ).filter(models.PartList.id == list_id).first()

    if not part_list:
        raise HTTPException(status_code=404, detail="Part list not found.")

    items_out = []
    for item in part_list.items:
        part_out = None
        if item.part:
            storages = db.query(models.Storage).filter(models.Storage.part_id == item.part_id).all()
            total_qty = sum(s.quantity for s in storages)
            locs_data = [
                {
                    "id": s.id,
                    "name": s.name,
                    "quantity": s.quantity,
                    "last_counted": s.last_counted.isoformat() if s.last_counted else None
                }
                for s in storages
            ]
            part_out = schemas.PartOut.model_validate(item.part)
            part_out.total_quantity = total_qty
            part_out.locations = locs_data

        items_out.append(
            schemas.PartListItemOut(
                id=item.id,
                list_id=item.list_id,
                part_id=item.part_id,
                quantity=item.quantity,
                notes=item.notes or "",
                created_on=item.created_on,
                modified_on=item.modified_on,
                part=part_out
            )
        )

    return schemas.PartListDetailsOut(
        id=part_list.id,
        name=part_list.name,
        description=part_list.description,
        type=part_list.type,
        is_active=part_list.is_active,
        created_on=part_list.created_on,
        modified_on=part_list.modified_on,
        item_count=len(part_list.items),
        items=items_out
    )

@router.put("/{list_id}", response_model=schemas.PartListOut)
def update_part_list(
    list_id: str,
    payload: schemas.PartListUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_stocker)
):
    """
    Update part list metadata (name, description, type, is_active).
    """
    part_list = db.query(models.PartList).filter(models.PartList.id == list_id).first()
    if not part_list:
        raise HTTPException(status_code=404, detail="Part list not found.")

    if payload.is_active is True:
        db.query(models.PartList).update({"is_active": False})
        part_list.is_active = True
    elif payload.is_active is False:
        part_list.is_active = False

    if payload.name is not None:
        part_list.name = payload.name
    if payload.description is not None:
        part_list.description = payload.description
    if payload.type is not None:
        part_list.type = payload.type

    db.commit()
    db.refresh(part_list)

    return schemas.PartListOut(
        id=part_list.id,
        name=part_list.name,
        description=part_list.description,
        type=part_list.type,
        is_active=part_list.is_active,
        created_on=part_list.created_on,
        modified_on=part_list.modified_on,
        item_count=len(part_list.items)
    )

@router.post("/{list_id}/duplicate", response_model=schemas.PartListOut, status_code=status.HTTP_201_CREATED)
def duplicate_part_list(
    list_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_stocker)
):
    """
    Duplicate a part list and all of its items.
    """
    original = db.query(models.PartList).options(
        joinedload(models.PartList.items)
    ).filter(models.PartList.id == list_id).first()
    if not original:
        raise HTTPException(status_code=404, detail="Part list not found.")

    new_list = models.PartList(
        name=f"Copy of {original.name}",
        description=original.description,
        type=original.type,
        is_active=False
    )
    db.add(new_list)
    db.flush()

    for item in original.items:
        new_item = models.PartListItem(
            list_id=new_list.id,
            part_id=item.part_id,
            quantity=item.quantity,
            notes=item.notes
        )
        db.add(new_item)

    db.commit()
    db.refresh(new_list)

    return schemas.PartListOut(
        id=new_list.id,
        name=new_list.name,
        description=new_list.description,
        type=new_list.type,
        is_active=new_list.is_active,
        created_on=new_list.created_on,
        modified_on=new_list.modified_on,
        item_count=len(new_list.items)
    )

@router.delete("/{list_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_part_list(
    list_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_stocker)
):
    """
    Delete a part list and all its items.
    """
    part_list = db.query(models.PartList).filter(models.PartList.id == list_id).first()
    if not part_list:
        raise HTTPException(status_code=404, detail="Part list not found.")
    
    db.delete(part_list)
    db.commit()
    return None

@router.post("/{list_id}/items", response_model=schemas.PartListItemOut, status_code=status.HTTP_201_CREATED)
def add_item_to_list(
    list_id: str,
    payload: schemas.PartListItemCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_stocker)
):
    """
    Add a part to a list. If part already exists in list, increments quantity.
    """
    part_list = db.query(models.PartList).filter(models.PartList.id == list_id).first()
    if not part_list:
        raise HTTPException(status_code=404, detail="Part list not found.")

    part = db.query(models.Part).filter(models.Part.id == payload.part_id).first()
    if not part:
        raise HTTPException(status_code=404, detail="Part not found.")

    existing_item = db.query(models.PartListItem).filter(
        models.PartListItem.list_id == list_id,
        models.PartListItem.part_id == payload.part_id
    ).first()

    if existing_item:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Item already in list"
        )

    new_item = models.PartListItem(
        list_id=list_id,
        part_id=payload.part_id,
        quantity=payload.quantity,
        notes=payload.notes or ""
    )
    db.add(new_item)
    db.commit()
    db.refresh(new_item)
    item_obj = new_item

    # Update modified_on timestamp of list
    part_list.modified_on = models.datetime.utcnow()
    db.commit()

    return schemas.PartListItemOut(
        id=item_obj.id,
        list_id=item_obj.list_id,
        part_id=item_obj.part_id,
        quantity=item_obj.quantity,
        notes=item_obj.notes or "",
        created_on=item_obj.created_on,
        modified_on=item_obj.modified_on,
        part=schemas.PartOut.model_validate(item_obj.part)
    )

@router.put("/{list_id}/items/{item_id}", response_model=schemas.PartListItemOut)
def update_list_item(
    list_id: str,
    item_id: str,
    payload: schemas.PartListItemUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_stocker)
):
    """
    Update quantity or notes for a list item.
    """
    item = db.query(models.PartListItem).filter(
        models.PartListItem.id == item_id,
        models.PartListItem.list_id == list_id
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Part list item not found.")

    if payload.quantity is not None:
        item.quantity = max(0.0, payload.quantity)
    if payload.notes is not None:
        item.notes = payload.notes

    db.commit()
    db.refresh(item)

    return schemas.PartListItemOut(
        id=item.id,
        list_id=item.list_id,
        part_id=item.part_id,
        quantity=item.quantity,
        notes=item.notes or "",
        created_on=item.created_on,
        modified_on=item.modified_on,
        part=schemas.PartOut.model_validate(item.part)
    )

@router.delete("/{list_id}/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_list_item(
    list_id: str,
    item_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_stocker)
):
    """
    Remove an item from a part list.
    """
    item = db.query(models.PartListItem).filter(
        models.PartListItem.id == item_id,
        models.PartListItem.list_id == list_id
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Part list item not found.")

    db.delete(item)
    db.commit()
    return None

@router.get("/{list_id}/export")
def export_part_list_csv(
    list_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_any_user)
):
    """
    Export a part list to CSV format.
    """
    part_list = db.query(models.PartList).options(
        joinedload(models.PartList.items).joinedload(models.PartListItem.part)
    ).filter(models.PartList.id == list_id).first()

    if not part_list:
        raise HTTPException(status_code=404, detail="Part list not found.")

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Part Value", "MPN / Part Number", "Package", "Required Quantity", "Notes", "Category"])

    for item in part_list.items:
        p = item.part
        val = p.value if p else ""
        num = p.number if p else ""
        pkg = p.package if p else ""
        cat = p.category.title if (p and p.category) else ""
        writer.writerow([val, num, pkg, item.quantity, item.notes or "", cat])

    output.seek(0)
    filename = f"part_list_{part_list.name.replace(' ', '_').lower()}.csv"
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode("utf-8")),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
