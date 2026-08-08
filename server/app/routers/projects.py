from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..database import get_db
from .. import models, schemas, auth

router = APIRouter(prefix="/projects", tags=["projects"])

@router.get("", response_model=List[schemas.ProjectOut])
def get_projects(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_analyst)
):
    """
    Get all projects. Requires Analyst role.
    """
    return db.query(models.Project).order_by(models.Project.title).all()

@router.post("", response_model=schemas.ProjectOut, status_code=status.HTTP_201_CREATED)
def create_project(
    payload: schemas.ProjectCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_designer)
):
    """
    Create a new project. Requires Designer role.
    """
    existing = db.query(models.Project).filter(models.Project.title == payload.title).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Project with title '{payload.title}' already exists."
        )
    
    db_project = models.Project(
        title=payload.title,
        description=payload.description
    )
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    return db_project

@router.get("/{project_id}", response_model=schemas.ProjectDetailsOut)
def get_project_details(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_analyst)
):
    """
    Get a project's detailed view (including revisions). Requires Analyst role.
    """
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")
    return project

@router.put("/{project_id}", response_model=schemas.ProjectOut)
def update_project(
    project_id: int,
    payload: schemas.ProjectUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_designer)
):
    """
    Update a project's details. Requires Designer role.
    """
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")
        
    if payload.title is not None:
        # Check if title already exists
        existing = db.query(models.Project).filter(models.Project.title == payload.title, models.Project.id != project_id).first()
        if existing:
            raise HTTPException(status_code=400, detail=f"Project with title '{payload.title}' already exists.")
        project.title = payload.title
        
    if payload.description is not None:
        project.description = payload.description
        
    db.commit()
    db.refresh(project)
    return project

@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_designer)
):
    """
    Delete a project. Requires Designer role.
    """
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")
        
    if db.query(models.Assembly).filter(models.Assembly.project_id == project_id).first():
        raise HTTPException(status_code=400, detail="Cannot delete a project that has assemblies. Delete the assemblies first.")
        
    db.delete(project)
    db.commit()
    return

# --- Assemblies ---

@router.post("/assemblies", response_model=schemas.AssemblyOut, status_code=status.HTTP_201_CREATED)
def create_assembly(
    payload: schemas.AssemblyCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_designer)
):
    """
    Create a new assembly. Requires Designer role.
    """
    project = db.query(models.Project).filter(models.Project.id == payload.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")
        
    db_assembly = models.Assembly(
        project_id=payload.project_id,
        name=payload.name
    )
    db.add(db_assembly)
    db.commit()
    db.refresh(db_assembly)
    return db_assembly

@router.put("/assemblies/{assembly_id}", response_model=schemas.AssemblyOut)
def update_assembly(
    assembly_id: int,
    payload: schemas.AssemblyUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_designer)
):
    """
    Update an assembly's details. Requires Designer role.
    """
    assembly = db.query(models.Assembly).filter(models.Assembly.id == assembly_id).first()
    if not assembly:
        raise HTTPException(status_code=404, detail="Assembly not found.")
        
    if payload.name is not None:
        assembly.name = payload.name
        
    db.commit()
    db.refresh(assembly)
    return assembly

@router.delete("/assemblies/{assembly_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_assembly(
    assembly_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_designer)
):
    """
    Delete an assembly. Requires Designer role.
    """
    assembly = db.query(models.Assembly).filter(models.Assembly.id == assembly_id).first()
    if not assembly:
        raise HTTPException(status_code=404, detail="Assembly not found.")
        
    if db.query(models.Revision).filter(models.Revision.assembly_id == assembly_id).first():
        raise HTTPException(status_code=400, detail="Cannot delete an assembly that has revisions. Delete the revisions first.")
        
    db.delete(assembly)
    db.commit()
    return

# --- Revisions ---

@router.post("/revisions", response_model=schemas.RevisionOut, status_code=status.HTTP_201_CREATED)
def create_revision(
    payload: schemas.RevisionCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_designer)
):
    """
    Create a new PCB assembly revision. Requires Designer role.
    """
    assembly = db.query(models.Assembly).filter(models.Assembly.id == payload.assembly_id).first()
    if not assembly:
        raise HTTPException(status_code=404, detail="Assembly not found.")
        
    db_revision = models.Revision(
        assembly_id=payload.assembly_id,
        version=payload.version,
        date=payload.date
    )
    db.add(db_revision)
    db.commit()
    db.refresh(db_revision)
    return db_revision

@router.put("/revisions/{revision_id}", response_model=schemas.RevisionOut)
def update_revision(
    revision_id: int,
    payload: schemas.RevisionUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_designer)
):
    """
    Update a revision's details. Requires Designer role.
    """
    revision = db.query(models.Revision).filter(models.Revision.id == revision_id).first()
    if not revision:
        raise HTTPException(status_code=404, detail="Revision not found.")
        
    if payload.version is not None:
        revision.version = payload.version
        
    if payload.date is not None:
        revision.date = payload.date
        
    db.commit()
    db.refresh(revision)
    return revision

@router.delete("/revisions/{revision_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_revision(
    revision_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_designer)
):
    """
    Delete a revision. Requires Designer role.
    """
    revision = db.query(models.Revision).filter(models.Revision.id == revision_id).first()
    if not revision:
        raise HTTPException(status_code=404, detail="Revision not found.")
        
    if db.query(models.Material).filter(models.Material.revision_id == revision_id).first():
        raise HTTPException(status_code=400, detail="Cannot delete a revision that has BOM materials attached. Delete the materials first.")
        
    db.delete(revision)
    db.commit()
    return

# --- Bill of Materials (BOM) Links ---

@router.post("/materials", response_model=schemas.MaterialOut, status_code=status.HTTP_201_CREATED)
def add_material_to_revision(
    payload: schemas.MaterialCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_designer)
):
    """
    Add a component part (BOM line) with its reference designator to a specific revision.
    Requires Designer role.
    """
    # Verify revision
    revision = db.query(models.Revision).filter(models.Revision.id == payload.revision_id).first()
    if not revision:
        raise HTTPException(status_code=404, detail="Project revision not found.")
        
    # Verify part
    part = db.query(models.Part).filter(models.Part.id == payload.part_id).first()
    if not part:
        raise HTTPException(status_code=404, detail="Part component not found.")
        
    db_material = models.Material(
        revision_id=payload.revision_id,
        part_id=payload.part_id,
        designator=payload.designator
    )
    db.add(db_material)
    db.commit()
    db.refresh(db_material)
    return db_material

@router.delete("/materials/{material_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_material_from_revision(
    material_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_designer)
):
    """
    Delete a component part (BOM line) from a PCB revision.
    Requires Designer role.
    """
    material = db.query(models.Material).filter(models.Material.id == material_id).first()
    if not material:
        raise HTTPException(status_code=404, detail="BOM item not found.")
    db.delete(material)
    db.commit()
    return
