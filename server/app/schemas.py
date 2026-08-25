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
    id: str
    oidc_sub: str
    role: str
    created_at: datetime
    last_login: datetime

    model_config = ConfigDict(from_attributes=True)

# ----------------- Category Schemas -----------------
class CategoryBase(BaseModel):
    title: str
    parent_id: Optional[str] = None
    designator: Optional[str] = None

class CategoryCreate(CategoryBase):
    pass

class CategoryUpdate(BaseModel):
    title: Optional[str] = None
    parent_id: Optional[str] = None
    designator: Optional[str] = None

class CategoryOut(CategoryBase):
    id: str
    created_on: datetime
    modified_on: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

# ----------------- Part Schemas -----------------
class PartBase(BaseModel):
    category_id: str
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
    category_id: Optional[str] = None
    value: Optional[str] = None
    number: Optional[str] = None
    package: Optional[str] = None
    price: Optional[float] = None
    weight: Optional[float] = None
    threshold: Optional[int] = None
    notes: Optional[str] = None
    attributes: Optional[Dict[str, Any]] = None

class PartStockUpdate(BaseModel):
    quantity_change: int
    action_type: str
    notes: Optional[str] = None
    location_id: Optional[str] = None

class PartOut(PartBase):
    id: str
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

class SupplierUpdate(BaseModel):
    name: Optional[str] = None
    website: Optional[str] = None
    search: Optional[str] = None

class SupplierOut(SupplierBase):
    id: str
    created_on: datetime
    modified_on: Optional[datetime] = None

# ----------------- Product (Supplier Link) Schemas -----------------
class ProductBase(BaseModel):
    supplier_id: str
    part_id: str
    sku: str
    url: Optional[str] = None

class ProductCreate(ProductBase):
    pass

class ProductUpdate(BaseModel):
    sku: Optional[str] = None
    url: Optional[str] = None

class ProductOut(ProductBase):
    id: str
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
    id: str
    created_on: datetime
    modified_on: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

# ----------------- Assembly Schemas -----------------
class AssemblyBase(BaseModel):
    project_id: str
    name: str

class AssemblyCreate(AssemblyBase):
    pass

class AssemblyUpdate(BaseModel):
    name: Optional[str] = None

class AssemblyOut(AssemblyBase):
    id: str
    created_on: datetime
    modified_on: Optional[datetime] = None
    project: Optional[ProjectOut] = None

    model_config = ConfigDict(from_attributes=True)

# ----------------- Revision Schemas -----------------
class RevisionBase(BaseModel):
    assembly_id: str
    version: str
    date: date

class RevisionCreate(RevisionBase):
    pass

class RevisionUpdate(BaseModel):
    version: Optional[str] = None
    date: Optional[date] = None

class RevisionClone(BaseModel):
    version: str
    date: date

class RevisionOut(RevisionBase):
    id: str
    created_on: datetime
    modified_on: Optional[datetime] = None
    assembly: Optional[AssemblyOut] = None

    model_config = ConfigDict(from_attributes=True)

# ----------------- Material (BOM Line) Schemas -----------------
class MaterialBase(BaseModel):
    revision_id: str
    part_id: Optional[str] = None
    quantity: int = 1
    designator: Optional[str] = None
    ghost_description: Optional[str] = None

class MaterialCreate(MaterialBase):
    pass

class MaterialUpdate(BaseModel):
    part_id: Optional[str] = None
    quantity: Optional[int] = None
    designator: Optional[str] = None
    ghost_description: Optional[str] = None

class MaterialOut(MaterialBase):
    id: str
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

# ----------------- Tare Weight Schemas -----------------
class TareWeightBase(BaseModel):
    name: str
    weight: float

class TareWeightCreate(TareWeightBase):
    pass

class TareWeightUpdate(BaseModel):
    name: Optional[str] = None
    weight: Optional[float] = None

class TareWeightOut(TareWeightBase):
    id: str
    created_on: datetime
    modified_on: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

# ----------------- Storage (Locations) Schemas -----------------
class StorageBase(BaseModel):
    parent_id: Optional[str] = None
    name: str
    index: int = 0
    dimensions: Optional[Any] = None
    span: Optional[Any] = None
    label_scheme: Optional[str] = None
    part_id: Optional[str] = None
    quantity: int = 0
    description: Optional[str] = None
    last_counted: Optional[datetime] = None
    pos_x: float = 0.0
    pos_y: float = 0.0
    pos_z: float = 0.0
    size_x: float = 0.0
    size_y: float = 0.0
    size_z: float = 0.0
    last_tare_id: Optional[str] = None

class StorageCreate(StorageBase):
    pass

class StorageOut(StorageBase):
    id: str
    created_on: datetime
    modified_on: Optional[datetime] = None
    part: Optional[PartOut] = None
    last_tare: Optional[TareWeightOut] = None

    model_config = ConfigDict(from_attributes=True)

class StorageDetailsOut(StorageOut):
    children: List["StorageDetailsOut"] = []

    model_config = ConfigDict(from_attributes=True)

# ----------------- Image Schemas -----------------
class ImageOut(BaseModel):
    id: str
    caption: Optional[str] = None
    notes: Optional[str] = None
    part_id: str
    created_on: datetime

    model_config = ConfigDict(from_attributes=True)

# ----------------- Document Schemas -----------------
class DocumentOut(BaseModel):
    id: str
    label: str
    filename: str
    part_id: str
    created_on: datetime

    model_config = ConfigDict(from_attributes=True)

# ----------------- Attachment Compatibility Schemas -----------------
class AttachmentOut(BaseModel):
    id: str
    filename: str
    file_type: str  # "image" or "document"
    part_id: str
    created_on: datetime

    model_config = ConfigDict(from_attributes=True)

# ----------------- Transaction Schemas -----------------
class TransactionBase(BaseModel):
    action_type: str  # check_in, check_out, edit, create
    quantity_change: int
    notes: Optional[str] = None

class TransactionOut(TransactionBase):
    id: str
    part_id: str
    user_id: Optional[str] = None
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

    model_config = ConfigDict(from_attributes=True)

# ----------------- Audit Log Schemas -----------------
class AuditLogBase(BaseModel):
    entity_type: str
    entity_id: str
    action_type: str
    reason_code: Optional[str] = None
    quantity_change: float = 0.0
    previous_state: Optional[Dict[str, Any]] = None
    new_state: Optional[Dict[str, Any]] = None
    method: str = "manual"
    notes: Optional[str] = None

class AuditLogOut(AuditLogBase):
    id: str
    part_id: Optional[str] = None
    location_id: Optional[str] = None
    project_id: Optional[str] = None
    user_id: Optional[str] = None
    created_at: datetime

    part_name: Optional[str] = None
    part_number: Optional[str] = None
    location_name: Optional[str] = None
    project_name: Optional[str] = None
    user_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class AuditLogStatsOut(BaseModel):
    total_events_30d: int
    discrepancy_count_30d: int
    scale_reconciliations_30d: int
    reason_breakdown: Dict[str, int]
    action_breakdown: Dict[str, int]

# Self reference resolution for hierarchical category and storage
CategoryDetailsOut = CategoryOut
class CategoryDetailsOut(CategoryOut):
    children: List["CategoryDetailsOut"] = []
    parts: List[PartOut] = []

CategoryDetailsOut.model_rebuild()
StorageDetailsOut.model_rebuild()

