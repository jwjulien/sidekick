from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
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

    attachments = relationship("Attachment", back_populates="uploaded_by")
    transactions = relationship("Transaction", back_populates="user")

class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    description = Column(Text, nullable=True)

    items = relationship("Item", back_populates="category")
    custom_fields = relationship("CustomField", back_populates="category", cascade="all, delete-orphan")

class Location(Base):
    __tablename__ = "locations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    description = Column(Text, nullable=True)
    parent_id = Column(Integer, ForeignKey("locations.id", ondelete="CASCADE"), nullable=True)

    # Hierarchical self-referencing relationship
    parent = relationship("Location", remote_side=[id], back_populates="children")
    children = relationship("Location", back_populates="parent", cascade="all, delete-orphan")
    items = relationship("Item", back_populates="location")

# Map parent back_populates to children
Location.children = relationship("Location", back_populates="parent", cascade="all, delete-orphan")

class Item(Base):
    __tablename__ = "items"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    description = Column(Text, nullable=True)
    sku = Column(String, unique=True, index=True, nullable=True)
    barcode = Column(String, index=True, nullable=True)
    quantity = Column(Integer, default=0)
    min_quantity_alert = Column(Integer, default=0, nullable=True)
    category_id = Column(Integer, ForeignKey("categories.id", ondelete="SET NULL"), nullable=True)
    location_id = Column(Integer, ForeignKey("locations.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    category = relationship("Category", back_populates="items")
    location = relationship("Location", back_populates="items")
    custom_values = relationship("CustomFieldValue", back_populates="item", cascade="all, delete-orphan")
    attachments = relationship("Attachment", back_populates="item", cascade="all, delete-orphan")
    transactions = relationship("Transaction", back_populates="item", cascade="all, delete-orphan")

class CustomField(Base):
    __tablename__ = "custom_fields"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    field_type = Column(String, nullable=False)  # text, number, date, boolean
    category_id = Column(Integer, ForeignKey("categories.id", ondelete="CASCADE"), nullable=True)

    category = relationship("Category", back_populates="custom_fields")
    values = relationship("CustomFieldValue", back_populates="custom_field", cascade="all, delete-orphan")

class CustomFieldValue(Base):
    __tablename__ = "custom_field_values"

    id = Column(Integer, primary_key=True, index=True)
    item_id = Column(Integer, ForeignKey("items.id", ondelete="CASCADE"), nullable=False)
    custom_field_id = Column(Integer, ForeignKey("custom_fields.id", ondelete="CASCADE"), nullable=False)
    value = Column(String, nullable=False)

    item = relationship("Item", back_populates="custom_values")
    custom_field = relationship("CustomField", back_populates="values")

class Attachment(Base):
    __tablename__ = "attachments"

    id = Column(Integer, primary_key=True, index=True)
    item_id = Column(Integer, ForeignKey("items.id", ondelete="CASCADE"), nullable=False)
    filename = Column(String, nullable=False)
    file_type = Column(String, nullable=False)  # image, document
    file_path = Column(String, nullable=False)
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    uploaded_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    item = relationship("Item", back_populates="attachments")
    uploaded_by = relationship("User", back_populates="attachments")

class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    item_id = Column(Integer, ForeignKey("items.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    action_type = Column(String, nullable=False)  # check_in, check_out, edit, create
    quantity_change = Column(Integer, default=0)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    item = relationship("Item", back_populates="transactions")
    user = relationship("User", back_populates="transactions")
