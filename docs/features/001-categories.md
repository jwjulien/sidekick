---
title: Core Categories
status: In Progress
target: 
  - Web
  - Windows
  - Android
dependencies: []
---

# Feature: Core Categories

## 1. Overview
This feature establishes the foundational, hierarchical taxonomy for all parts in the inventory system. By utilizing a self-referencing database structure, users can create infinitely nested parent-child relationships (e.g., Components > Passives > Resistors > SMD) to keep the database organized.

## 2. User Experience & UI
* **Trigger:** Accessed via a "Categories" or "Taxonomy" button in the primary settings or inventory navigation sidebar.
* **Interaction:** 1. The user views a collapsible tree-list of existing categories.
    2. The user can click "Add Category".
    3. A form opens requesting a `title`, an optional `designator` prefix (e.g., "R" for Resistors, "C" for Capacitors), and an optional `parent` category selection.
    4. Upon saving, the tree updates dynamically.
* **Mobile Considerations:** The collapsible tree nodes must have touch targets of at least 44x44px to prevent accidental mis-taps. Nesting indentation should be visually distinct but constrained so deep hierarchies don't push text off small smartphone screens.

## 3. Technical Implementation
* **Frontend (SolidJS / Tauri):** * A recursive UI component to render the nested tree structure.
    * Local state to track which nodes are currently expanded/collapsed.
    * Uses standard web `fetch` to the local API (no specific Tauri native APIs required for this module).
* **Backend (FastAPI):** * `GET /api/categories` - Returns the category list.
    * `POST /api/categories` - Creates a new category.
    * `PUT /api/categories/{id}` - Updates a category (e.g., reparenting it).
    * `DELETE /api/categories/{id}` - Removes a category (must handle logic for what happens to orphaned children/parts).
* **Database Schema (SQLite / SQLAlchemy):** * Model: `Category` 
    * Columns: `id` (PK), `created_on`, `modified_on`, `title` (VARCHAR 50), `designator` (VARCHAR 10), and `parent_id` (FK referencing `Category.id`).

## 4. Out of Scope
* Drag-and-drop reorganization of the tree (re-parenting will be handled strictly via standard form dropdowns for now).
* Deep analytics or part-count aggregations displayed directly on the category tree nodes.

---

## 5. Implementation Tasks
- [ ] Define `Category` SQLAlchemy model with self-referential foreign key.
- [ ] Build FastAPI CRUD routes.
- [ ] Create SolidJS recursive tree UI component.
- [ ] Create SolidJS form for creating/editing categories.
- [ ] Wire frontend to backend API.