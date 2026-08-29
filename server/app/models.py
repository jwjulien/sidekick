from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Float, LargeBinary, Date, JSON, Boolean
from sqlalchemy.orm import relationship
from uuid6 import uuid7
from .database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, index=True, default=lambda: str(uuid7()))
    oidc_sub = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=True)
    username = Column(String, nullable=True)
    role = Column(String, default="viewer")  # admin, designer, stocker, puller, analyst, viewer
    created_at = Column(DateTime, default=datetime.utcnow)
    last_login = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    transactions = relationship("Transaction", back_populates="user")

class Category(Base):
    __tablename__ = "categories"

    id = Column(String(36), primary_key=True, index=True, default=lambda: str(uuid7()))
    created_on = Column(DateTime, default=datetime.utcnow, nullable=False)
    modified_on = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    parent_id = Column(String(36), ForeignKey("categories.id", ondelete="CASCADE"), nullable=True)
    title = Column(String(50), nullable=False)
    designator = Column(String(10), nullable=True)

    parent = relationship("Category", remote_side=[id], back_populates="children")
    children = relationship("Category", back_populates="parent", cascade="all, delete-orphan")
    parts = relationship("Part", back_populates="category")

class Part(Base):
    __tablename__ = "parts"

    id = Column(String(36), primary_key=True, index=True, default=lambda: str(uuid7()))
    created_on = Column(DateTime, default=datetime.utcnow, nullable=False)
    modified_on = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    category_id = Column(String(36), ForeignKey("categories.id", ondelete="RESTRICT"), nullable=False)
    value = Column(String(50), nullable=False)
    number = Column(String(50), nullable=False)
    package = Column(String(20), nullable=True)
    price = Column(Float, nullable=True)
    weight = Column(Float, nullable=True)
    threshold = Column(Integer, default=0, nullable=False)
    notes = Column(Text, default="", nullable=False)
    attributes = Column(JSON, default=dict, nullable=False)

    category = relationship("Category", back_populates="parts")
    storage_records = relationship("Storage", back_populates="part")
    products = relationship("Product", back_populates="part", cascade="all, delete-orphan")
    materials = relationship("Material", back_populates="part", cascade="all, delete-orphan")
    images = relationship("Image", back_populates="part", cascade="all, delete-orphan")
    documents = relationship("Document", back_populates="part", cascade="all, delete-orphan")
    transactions = relationship("Transaction", back_populates="part", cascade="all, delete-orphan")
    list_items = relationship("PartListItem", back_populates="part", cascade="all, delete-orphan")

class Supplier(Base):
    __tablename__ = "suppliers"

    id = Column(String(36), primary_key=True, index=True, default=lambda: str(uuid7()))
    created_on = Column(DateTime, default=datetime.utcnow, nullable=False)
    modified_on = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    name = Column(String(40), nullable=False)
    website = Column(String(100), nullable=False)
    search = Column(String(200), nullable=False)

    products = relationship("Product", back_populates="supplier", cascade="all, delete-orphan")

class Product(Base):
    __tablename__ = "products"

    id = Column(String(36), primary_key=True, index=True, default=lambda: str(uuid7()))
    created_on = Column(DateTime, default=datetime.utcnow, nullable=False)
    modified_on = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    supplier_id = Column(String(36), ForeignKey("suppliers.id", ondelete="CASCADE"), nullable=False)
    part_id = Column(String(36), ForeignKey("parts.id", ondelete="CASCADE"), nullable=False)
    sku = Column(String(100), nullable=False)
    url = Column(String(255), nullable=True)

    supplier = relationship("Supplier", back_populates="products")
    part = relationship("Part", back_populates="products")

class Project(Base):
    __tablename__ = "projects"

    id = Column(String(36), primary_key=True, index=True, default=lambda: str(uuid7()))
    created_on = Column(DateTime, default=datetime.utcnow, nullable=False)
    modified_on = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    title = Column(String(40), nullable=False)
    description = Column(Text, nullable=False)

    assemblies = relationship("Assembly", back_populates="project", cascade="all, delete-orphan")

class Assembly(Base):
    __tablename__ = "assemblies"

    id = Column(String(36), primary_key=True, index=True, default=lambda: str(uuid7()))
    created_on = Column(DateTime, default=datetime.utcnow, nullable=False)
    modified_on = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)

    project = relationship("Project", back_populates="assemblies")
    revisions = relationship("Revision", back_populates="assembly", cascade="all, delete-orphan")

class Revision(Base):
    __tablename__ = "revisions"

    id = Column(String(36), primary_key=True, index=True, default=lambda: str(uuid7()))
    created_on = Column(DateTime, default=datetime.utcnow, nullable=False)
    modified_on = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    assembly_id = Column(String(36), ForeignKey("assemblies.id", ondelete="CASCADE"), nullable=False)
    version = Column(String(32), nullable=False)
    date = Column(Date, nullable=False)

    assembly = relationship("Assembly", back_populates="revisions")
    materials = relationship("Material", back_populates="revision", cascade="all, delete-orphan")

class Material(Base):
    __tablename__ = "materials"

    id = Column(String(36), primary_key=True, index=True, default=lambda: str(uuid7()))
    created_on = Column(DateTime, default=datetime.utcnow, nullable=False)
    modified_on = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    revision_id = Column(String(36), ForeignKey("revisions.id", ondelete="CASCADE"), nullable=False)
    part_id = Column(String(36), ForeignKey("parts.id", ondelete="SET NULL"), nullable=True)
    quantity = Column(Integer, default=1, nullable=False)
    designator = Column(String(255), nullable=True)
    ghost_description = Column(String(255), nullable=True)

    revision = relationship("Revision", back_populates="materials")
    part = relationship("Part", back_populates="materials")

class Storage(Base):
    __tablename__ = "storage"

    id = Column(String(36), primary_key=True, index=True, default=lambda: str(uuid7()))
    parent_id = Column(String(36), ForeignKey("storage.id", ondelete="CASCADE"), nullable=True)
    name = Column(String(40), nullable=False)
    index = Column(Integer, default=0, nullable=False)
    dimensions = Column(JSON, nullable=True)
    span = Column(JSON, nullable=True)
    label_scheme = Column(String(10), nullable=True)
    part_id = Column(String(36), ForeignKey("parts.id", ondelete="SET NULL"), nullable=True, index=True)
    quantity = Column(Integer, default=0, nullable=False)
    last_counted = Column(DateTime, nullable=True)
    created_on = Column(DateTime, default=datetime.utcnow, nullable=False)
    modified_on = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    description = Column(Text, nullable=True)
    pos_x = Column(Float, default=0.0, nullable=False)
    pos_y = Column(Float, default=0.0, nullable=False)
    pos_z = Column(Float, default=0.0, nullable=False)
    size_x = Column(Float, default=0.0, nullable=False)
    size_y = Column(Float, default=0.0, nullable=False)
    size_z = Column(Float, default=0.0, nullable=False)
    last_tare_id = Column(String(36), ForeignKey("tare_weights.id", ondelete="SET NULL"), nullable=True)

    parent = relationship("Storage", remote_side=[id], back_populates="children")
    children = relationship("Storage", back_populates="parent", cascade="all, delete-orphan")
    part = relationship("Part", back_populates="storage_records")
    last_tare = relationship("TareWeight", back_populates="storage_records")

class TareWeight(Base):
    __tablename__ = "tare_weights"

    id = Column(String(36), primary_key=True, index=True, default=lambda: str(uuid7()))
    name = Column(String(100), nullable=False)
    weight = Column(Float, nullable=False)
    created_on = Column(DateTime, default=datetime.utcnow, nullable=False)
    modified_on = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    storage_records = relationship("Storage", back_populates="last_tare")

class Image(Base):
    __tablename__ = "images"

    id = Column(String(36), primary_key=True, index=True, default=lambda: str(uuid7()))
    created_on = Column(DateTime, default=datetime.utcnow, nullable=False)
    modified_on = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    caption = Column(String(60), nullable=True)
    notes = Column(Text, nullable=True)
    content = Column(LargeBinary, nullable=False)
    part_id = Column(String(36), ForeignKey("parts.id", ondelete="CASCADE"), nullable=False)

    part = relationship("Part", back_populates="images")

class Document(Base):
    __tablename__ = "documents"

    id = Column(String(36), primary_key=True, index=True, default=lambda: str(uuid7()))
    created_on = Column(DateTime, default=datetime.utcnow, nullable=False)
    modified_on = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    label = Column(String(40), nullable=False)
    filename = Column(String(30), nullable=False)
    content = Column(LargeBinary, nullable=False)
    part_id = Column(String(36), ForeignKey("parts.id", ondelete="CASCADE"), nullable=False)

    part = relationship("Part", back_populates="documents")

class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(String(36), primary_key=True, index=True, default=lambda: str(uuid7()))
    part_id = Column(String(36), ForeignKey("parts.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    action_type = Column(String, nullable=False)  # check_in, check_out, edit, create
    quantity_change = Column(Integer, default=0)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    part = relationship("Part", back_populates="transactions")
    user = relationship("User", back_populates="transactions")

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String(36), primary_key=True, index=True, default=lambda: str(uuid7()))
    part_id = Column(String(36), ForeignKey("parts.id", ondelete="SET NULL"), nullable=True, index=True)
    location_id = Column(String(36), ForeignKey("storage.id", ondelete="SET NULL"), nullable=True, index=True)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="SET NULL"), nullable=True, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)

    entity_type = Column(String, nullable=False, index=True)  # part, storage_location, project, scale, cycle_count
    entity_id = Column(String, nullable=False, index=True)
    action_type = Column(String, nullable=False, index=True)  # create, check_in, check_out, count_update, relocation, tare_calibration, lost_tagged, found_tagged, homeless_assigned, bom_consumed
    reason_code = Column(String, nullable=True, index=True)  # initial_stocking, supplier_receiving, assembly_build, cycle_count_adjustment, tare_drift, scrap_damage, triage, other

    quantity_change = Column(Float, default=0.0)
    previous_state = Column(JSON, nullable=True)
    new_state = Column(JSON, nullable=True)
    method = Column(String, default="manual")  # manual, scale, scanner, cycle_count, nfc, csv_import
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    part = relationship("Part")
    user = relationship("User")
    location = relationship("Storage")
    project = relationship("Project")


class PartList(Base):
    __tablename__ = "part_lists"

    id = Column(String(36), primary_key=True, index=True, default=lambda: str(uuid7()))
    created_on = Column(DateTime, default=datetime.utcnow, nullable=False)
    modified_on = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    type = Column(String(50), default="General", nullable=False)  # Wishlist, Bench Kit, Pick List, General
    is_active = Column(Boolean, default=False, nullable=False)

    items = relationship("PartListItem", back_populates="part_list", cascade="all, delete-orphan")


class PartListItem(Base):
    __tablename__ = "part_list_items"

    id = Column(String(36), primary_key=True, index=True, default=lambda: str(uuid7()))
    created_on = Column(DateTime, default=datetime.utcnow, nullable=False)
    modified_on = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    list_id = Column(String(36), ForeignKey("part_lists.id", ondelete="CASCADE"), nullable=False)
    part_id = Column(String(36), ForeignKey("parts.id", ondelete="CASCADE"), nullable=False)
    quantity = Column(Float, default=1.0, nullable=False)
    notes = Column(Text, nullable=True, default="")

    part_list = relationship("PartList", back_populates="items")
    part = relationship("Part", back_populates="list_items")


