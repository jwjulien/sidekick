from datetime import datetime
from typing import List, Optional
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

# ----------------- Custom Field Schemas -----------------
class CustomFieldBase(BaseModel):
    name: str
    field_type: str  # text, number, date, boolean
    category_id: Optional[int] = None

class CustomFieldCreate(CustomFieldBase):
    pass

class CustomFieldOut(CustomFieldBase):
    id: int

    model_config = ConfigDict(from_attributes=True)

# ----------------- Custom Field Value Schemas -----------------
class CustomFieldValueBase(BaseModel):
    custom_field_id: int
    value: str

class CustomFieldValueCreate(CustomFieldValueBase):
    pass

class CustomFieldValueOut(CustomFieldValueBase):
    id: int
    custom_field: CustomFieldOut

    model_config = ConfigDict(from_attributes=True)

# ----------------- Category Schemas -----------------
class CategoryBase(BaseModel):
    name: str
    description: Optional[str] = None

class CategoryCreate(CategoryBase):
    pass

class CategoryOut(CategoryBase):
    id: int

    model_config = ConfigDict(from_attributes=True)

class CategoryDetailsOut(CategoryOut):
    custom_fields: List[CustomFieldOut] = []

    model_config = ConfigDict(from_attributes=True)

# ----------------- Location Schemas -----------------
class LocationBase(BaseModel):
    name: str
    description: Optional[str] = None
    parent_id: Optional[int] = None

class LocationCreate(LocationBase):
    pass

class LocationOut(LocationBase):
    id: int

    model_config = ConfigDict(from_attributes=True)

class LocationDetailsOut(LocationOut):
    children: List["LocationDetailsOut"] = []

    model_config = ConfigDict(from_attributes=True)

# ----------------- Attachment Schemas -----------------
class AttachmentBase(BaseModel):
    filename: str
    file_type: str  # image, document

class AttachmentOut(AttachmentBase):
    id: int
    item_id: int
    file_path: str
    uploaded_at: datetime
    uploaded_by_id: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)

# ----------------- Transaction Schemas -----------------
class TransactionBase(BaseModel):
    action_type: str  # check_in, check_out, edit, create
    quantity_change: int
    notes: Optional[str] = None

class TransactionOut(TransactionBase):
    id: int
    item_id: int
    user_id: Optional[int] = None
    created_at: datetime
    user: Optional[UserBase] = None

    model_config = ConfigDict(from_attributes=True)

# ----------------- Item Schemas -----------------
class ItemBase(BaseModel):
    name: str
    description: Optional[str] = None
    sku: Optional[str] = None
    barcode: Optional[str] = None
    quantity: int = 0
    min_quantity_alert: Optional[int] = 0
    category_id: Optional[int] = None
    location_id: Optional[int] = None

class ItemCreate(ItemBase):
    custom_values: List[CustomFieldValueCreate] = []

class ItemUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    sku: Optional[str] = None
    barcode: Optional[str] = None
    quantity: Optional[int] = None
    min_quantity_alert: Optional[int] = None
    category_id: Optional[int] = None
    location_id: Optional[int] = None
    custom_values: Optional[List[CustomFieldValueCreate]] = None

class ItemStockUpdate(BaseModel):
    quantity_change: int
    action_type: str  # check_in, check_out
    notes: Optional[str] = None

class ItemOut(ItemBase):
    id: int
    created_at: datetime
    updated_at: datetime
    category: Optional[CategoryOut] = None
    location: Optional[LocationOut] = None

    model_config = ConfigDict(from_attributes=True)

class ItemDetailsOut(ItemOut):
    custom_values: List[CustomFieldValueOut] = []
    attachments: List[AttachmentOut] = []
    transactions: List[TransactionOut] = []

    model_config = ConfigDict(from_attributes=True)
