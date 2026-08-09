---
title: Inventory Storage & Stock
status: In Progress
target: 
  - Web
  - Windows
  - Android
dependencies: 
  - 004-core-parts.md
  - 100-3d-shop-layout.md
---

# Feature: Inventory Storage & Stock

## 1. Overview
This feature maps the digital inventory to physical reality. It defines a hierarchical storage system (e.g., Shop -> Rack A -> Drawer 3 -> Bin 12) and tracks the physical on-hand quantity of parts within those locations. By storing spatial coordinates (`x, y, z`) and dimensions alongside the hierarchical data, this entity directly feeds the 3D procedural layout engine.

## 2. User Experience & UI
* **Trigger:** Accessed via a "Locations" tab on a Part's detail view, or by clicking a specific bin inside the 3D Shop Layout.
* **Interaction:** 1. **Stock Management:** A user opens a Part and sees a list of locations where it is currently stored, alongside quantities. They can click "+" or "-" to instantly log stock adjustments.
    2. **Location Management:** A user navigates to the master Storage settings. They see a collapsible tree view of all physical containers. 
    3. They can add a new container, specifying a `label` (e.g., "Resistor Bin"), selecting a `parent_id` (the drawer it lives in), and optionally assigning a `part_id` to it.
* **Mobile Considerations:** Stock adjustments ("+" and "-") must be large, distinct buttons to allow for rapid, fat-finger-friendly inventory counting while standing at the workbench.

## 3. Technical Implementation
* **Frontend (SolidJS / Tauri):** * A recursive tree component to manage the nested storage containers.
    * A stock-adjustment component that triggers immediate API calls on click (debounced if necessary).
* **Backend (FastAPI):** * `GET /api/storage` - Returns the nested hierarchical tree of all locations.
    * `POST /api/storage` - Creates a new physical location.
    * `POST /api/storage/{id}/adjust` - Dedicated endpoint to increment/decrement the quantity of a part in a specific bin safely.
* **Database Schema (SQLite / Peewee):** * Model: `Storage`
    * Columns: `id` (PK), `created_on`, `modified_on`, `parent_id` (FK to Storage, nullable), `part_id` (FK to Parts, nullable), `label` (VARCHAR 50), `quantity` (INTEGER/REAL), `pos_x` (REAL), `pos_y` (REAL), `pos_z` (REAL), `size_x` (REAL), `size_y` (REAL), `size_z` (REAL).

## 4. Out of Scope
* Barcode/QR code generation and scanning (this is a massive feature that will get its own dedicated spec later).
* Live IoT weight-sensor integrations to automatically update stock quantities.

---

## 5. Implementation Tasks
- [x] Define `Storage` Peewee model with self-referential `parent_id` and `part_id` foreign keys.
- [x] Build FastAPI CRUD routes for locations.
- [x] Build FastAPI endpoint for rapid stock adjustments (+/-).
- [ ] Create SolidJS recursive tree UI for managing the hierarchy.
- [x] Create SolidJS stock adjustment UI for the Part detail view.
- [x] Wire frontend to backend API.