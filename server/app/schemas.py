from datetime import datetime, date
from typing import List, Optional, Any, Dict
from pydantic import BaseModel, ConfigDict

# ----------------- User Schemas -----------------
class UserBase(BaseModel):
    email: Optional[str] = None
    username: Optional[str] = None

class UserUpdateRole(BaseModel):
    role: str  # admin, designer, stocker, puller, analyst, viewer

class UserOut(UserBase):
    id: int
    oidc_sub: str
    role: str
    created_at: datetime
    last_login: datetime

    model_config = ConfigDict(from_attributes=True)

# ----------------- Category Schemas -----------------
class CategoryBase(BaseModel):
    title: str
    parent_id: Optional[int] = None
    designator: Optional[str] = None

class CategoryCreate(CategoryBase):
    pass

class CategoryUpdate(BaseModel):
    title: Optional[str] = None
    parent_id: Optional[int] = None
    designator: Optional[str] = None

class CategoryOut(CategoryBase):
    id: int
    created_on: datetime
    modified_on: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

# ----------------- Part Schemas -----------------
class PartBase(BaseModel):
    category_id: int
    value: str
    number: str
    package: Optional[str] = None
    price: Optional[float] = None
    weight: Optional[float] = None
    threshold: int = 0
    notes: str = ""

class PartCreate(PartBase):
    attributes: Optional[Dict[str, Any]] = {}

class PartUpdate(BaseModel):
    category_id: Optional[int] = None
    value: Optional[str] = None
    number: Optional[str] = None
    package: Optional[str] = None
    price: Optional[float] = None
    weight: Optional[float] = None
    threshold: Optional[int] = None
    notes: Optional[str] = None
    attributes: Optional[Dict[str, Any]] = None

class PartOut(PartBase):
    id: int
    created_on: datetime
    modified_on: Optional[datetime] = None
    total_quantity: int = 0
    category: Optional[CategoryOut] = None

    model_config = ConfigDict(from_attributes=True)

# ----------------- Supplier Schemas -----------------
class SupplierBase(BaseModel):
    name: str
    website: str
    search: str

class SupplierCreate(SupplierBase):
    pass

class SupplierOut(SupplierBase):
    id: int
    created_on: datetime
    modified_on: Optional[datetime] = None

# ----------------- Product (Supplier Link) Schemas -----------------
class ProductBase(BaseModel):
    supplier_id: int
    part_id: int
    number: str

class ProductCreate(ProductBase):
    pass

class ProductOut(ProductBase):
    id: int
    created_on: datetime
    modified_on: Optional[datetime] = None
    supplier: Optional[SupplierOut] = None

    model_config = ConfigDict(from_attributes=True)

# ----------------- Project Schemas -----------------
class ProjectBase(BaseModel):
    title: str
    description: str

class ProjectCreate(ProjectBase):
    pass

class ProjectUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None

class ProjectOut(ProjectBase):
    id: int
    created_on: datetime
    modified_on: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

# ----------------- Assembly Schemas -----------------
class AssemblyBase(BaseModel):
    project_id: int
    name: str

class AssemblyCreate(AssemblyBase):
    pass

class AssemblyUpdate(BaseModel):
    name: Optional[str] = None

class AssemblyOut(AssemblyBase):
    id: int
    created_on: datetime
    modified_on: Optional[datetime] = None
    project: Optional[ProjectOut] = None

    model_config = ConfigDict(from_attributes=True)

# ----------------- Revision Schemas -----------------
class RevisionBase(BaseModel):
    assembly_id: int
    version: str
    date: date

class RevisionCreate(RevisionBase):
    pass

class RevisionUpdate(BaseModel):
    version: Optional[str] = None
    date: Optional[date] = None

class RevisionOut(RevisionBase):
    id: int
    created_on: datetime
    modified_on: Optional[datetime] = None
    assembly: Optional[AssemblyOut] = None

    model_config = ConfigDict(from_attributes=True)

# ----------------- Material (BOM Line) Schemas -----------------
class MaterialBase(BaseModel):
    revision_id: int
    part_id: int
    designator: str

class MaterialCreate(MaterialBase):
    pass

class MaterialOut(MaterialBase):
    id: int
    created_on: datetime
    modified_on: Optional[datetime] = None
    part: Optional[PartOut] = None
    revision: Optional[RevisionOut] = None

    model_config = ConfigDict(from_attributes=True)

class RevisionDetailsOut(RevisionOut):
    materials: List[MaterialOut] = []

    model_config = ConfigDict(from_attributes=True)

class AssemblyDetailsOut(AssemblyOut):
    revisions: List[RevisionDetailsOut] = []

    model_config = ConfigDict(from_attributes=True)

class ProjectDetailsOut(ProjectOut):
    assemblies: List[AssemblyDetailsOut] = []

    model_config = ConfigDict(from_attributes=True)

# ----------------- Storage (Locations) Schemas -----------------
class StorageBase(BaseModel):
    parent_id: Optional[int] = None
    name: str
    index: int = 0
    dimensions: Optional[Any] = None
    span: Optional[Any] = None
    label_scheme: Optional[str] = None
    part_id: Optional[int] = None
    quantity: int = 0
    description: Optional[str] = None

class StorageCreate(StorageBase):
    pass

class StorageOut(StorageBase):
    id: int
    created_on: datetime
    modified_on: Optional[datetime] = None
    part: Optional[PartOut] = None

    model_config = ConfigDict(from_attributes=True)

class StorageDetailsOut(StorageOut):
    children: List["StorageDetailsOut"] = []

    model_config = ConfigDict(from_attributes=True)

# ----------------- Image Schemas -----------------
class ImageOut(BaseModel):
    id: int
    caption: str
    part_id: int
    created_on: datetime

    model_config = ConfigDict(from_attributes=True)

# ----------------- Document Schemas -----------------
class DocumentOut(BaseModel):
    id: int
    label: str
    filename: str
    part_id: int
    created_on: datetime

    model_config = ConfigDict(from_attributes=True)

# ----------------- Attachment Compatibility Schemas -----------------
class AttachmentOut(BaseModel):
    id: int
    filename: str
    file_type: str  # "image" or "document"
    part_id: int
    created_on: datetime

    model_config = ConfigDict(from_attributes=True)

# ----------------- Transaction Schemas -----------------
class TransactionBase(BaseModel):
    action_type: str  # check_in, check_out, edit, create
    quantity_change: int
    notes: Optional[str] = None

class TransactionOut(TransactionBase):
    id: int
    part_id: int
    user_id: Optional[int] = None
    created_at: datetime
    user: Optional[UserBase] = None

    model_config = ConfigDict(from_attributes=True)

# ----------------- Part Details Schemas -----------------
class PartDetailsOut(PartOut):
    attributes: Dict[str, Any] = {}
    storage_records: List[StorageOut] = []
    products: List[ProductOut] = []
    materials: List[MaterialOut] = []
    images: List[ImageOut] = []
    documents: List[DocumentOut] = []
    transactions: List[TransactionOut] = []
    attachments: List[AttachmentOut] = []

    model_config = ConfigDict(from_attributes=True)

# Self reference resolution for hierarchical category and storage
CategoryDetailsOut = CategoryOut
class CategoryDetailsOut(CategoryOut):
    children: List["CategoryDetailsOut"] = []
    parts: List[PartOut] = []

CategoryDetailsOut.model_rebuild()
StorageDetailsOut.model_rebuild()
