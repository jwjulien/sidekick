from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Float, LargeBinary, Date, JSON
from sqlalchemy.orm import relationship
from .database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    oidc_sub = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=True)
    username = Column(String, nullable=True)
    role = Column(String, default="viewer")  # admin, designer, stocker, puller, analyst, viewer
    created_at = Column(DateTime, default=datetime.utcnow)
    last_login = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    transactions = relationship("Transaction", back_populates="user")

class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    created_on = Column(DateTime, default=datetime.utcnow, nullable=False)
    modified_on = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    parent_id = Column(Integer, ForeignKey("categories.id", ondelete="CASCADE"), nullable=True)
    title = Column(String(50), nullable=False)
    designator = Column(String(10), nullable=True)

    parent = relationship("Category", remote_side=[id], back_populates="children")
    children = relationship("Category", back_populates="parent", cascade="all, delete-orphan")
    parts = relationship("Part", back_populates="category")

class Part(Base):
    __tablename__ = "parts"

    id = Column(Integer, primary_key=True, index=True)
    created_on = Column(DateTime, default=datetime.utcnow, nullable=False)
    modified_on = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    category_id = Column(Integer, ForeignKey("categories.id", ondelete="RESTRICT"), nullable=False)
    value = Column(String(50), nullable=False)
    number = Column(String(50), nullable=False)
    package = Column(String(20), nullable=True)
    price = Column(Float, nullable=True)
    weight = Column(Float, nullable=True)
    threshold = Column(Integer, default=0, nullable=False)
    notes = Column(Text, default="", nullable=False)
    attributes = Column(LargeBinary, default=b"{}", nullable=False)

    category = relationship("Category", back_populates="parts")
    storage_records = relationship("Storage", back_populates="part")
    products = relationship("Product", back_populates="part", cascade="all, delete-orphan")
    materials = relationship("Material", back_populates="part", cascade="all, delete-orphan")
    images = relationship("Image", back_populates="part", cascade="all, delete-orphan")
    documents = relationship("Document", back_populates="part", cascade="all, delete-orphan")
    transactions = relationship("Transaction", back_populates="part", cascade="all, delete-orphan")

class Supplier(Base):
    __tablename__ = "suppliers"

    id = Column(Integer, primary_key=True, index=True)
    created_on = Column(DateTime, default=datetime.utcnow, nullable=False)
    modified_on = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    name = Column(String(40), nullable=False)
    website = Column(String(100), nullable=False)
    search = Column(String(200), nullable=False)

    products = relationship("Product", back_populates="supplier", cascade="all, delete-orphan")

class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    created_on = Column(DateTime, default=datetime.utcnow, nullable=False)
    modified_on = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    supplier_id = Column(Integer, ForeignKey("suppliers.id", ondelete="CASCADE"), nullable=False)
    part_id = Column(Integer, ForeignKey("parts.id", ondelete="CASCADE"), nullable=False)
    number = Column(String(80), nullable=False)

    supplier = relationship("Supplier", back_populates="products")
    part = relationship("Part", back_populates="products")

class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    created_on = Column(DateTime, default=datetime.utcnow, nullable=False)
    modified_on = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    title = Column(String(40), nullable=False)
    description = Column(Text, nullable=False)

    revisions = relationship("Revision", back_populates="project", cascade="all, delete-orphan")

class Revision(Base):
    __tablename__ = "revisions"

    id = Column(Integer, primary_key=True, index=True)
    created_on = Column(DateTime, default=datetime.utcnow, nullable=False)
    modified_on = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    version = Column(String(32), nullable=False)
    date = Column(Date, nullable=False)

    project = relationship("Project", back_populates="revisions")
    materials = relationship("Material", back_populates="revision", cascade="all, delete-orphan")

class Material(Base):
    __tablename__ = "materials"

    id = Column(Integer, primary_key=True, index=True)
    created_on = Column(DateTime, default=datetime.utcnow, nullable=False)
    modified_on = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    revision_id = Column(Integer, ForeignKey("revisions.id", ondelete="CASCADE"), nullable=False)
    part_id = Column(Integer, ForeignKey("parts.id", ondelete="CASCADE"), nullable=False)
    designator = Column(String(10), nullable=False)

    revision = relationship("Revision", back_populates="materials")
    part = relationship("Part", back_populates="materials")

class Storage(Base):
    __tablename__ = "storage"

    id = Column(Integer, primary_key=True, index=True)
    parent_id = Column(Integer, ForeignKey("storage.id", ondelete="CASCADE"), nullable=True)
    name = Column(String(40), nullable=False)
    index = Column(Integer, default=0, nullable=False)
    dimensions = Column(JSON, nullable=True)
    span = Column(JSON, nullable=True)
    label_scheme = Column(String(10), nullable=True)
    part_id = Column(Integer, ForeignKey("parts.id", ondelete="SET NULL"), nullable=True)
    quantity = Column(Integer, default=0, nullable=False)
    last_counted = Column(DateTime, nullable=True)
    created_on = Column(DateTime, default=datetime.utcnow, nullable=False)
    modified_on = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    description = Column(Text, nullable=True)

    parent = relationship("Storage", remote_side=[id], back_populates="children")
    children = relationship("Storage", back_populates="parent", cascade="all, delete-orphan")
    part = relationship("Part", back_populates="storage_records")

class Image(Base):
    __tablename__ = "images"

    id = Column(Integer, primary_key=True, index=True)
    created_on = Column(DateTime, default=datetime.utcnow, nullable=False)
    modified_on = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    caption = Column(String(60), nullable=False)
    content = Column(LargeBinary, nullable=False)
    part_id = Column(Integer, ForeignKey("parts.id", ondelete="CASCADE"), nullable=False)

    part = relationship("Part", back_populates="images")

class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    created_on = Column(DateTime, default=datetime.utcnow, nullable=False)
    modified_on = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    label = Column(String(40), nullable=False)
    filename = Column(String(30), nullable=False)
    content = Column(LargeBinary, nullable=False)
    part_id = Column(Integer, ForeignKey("parts.id", ondelete="CASCADE"), nullable=False)

    part = relationship("Part", back_populates="documents")

class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    part_id = Column(Integer, ForeignKey("parts.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    action_type = Column(String, nullable=False)  # check_in, check_out, edit, create
    quantity_change = Column(Integer, default=0)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    part = relationship("Part", back_populates="transactions")
    user = relationship("User", back_populates="transactions")
