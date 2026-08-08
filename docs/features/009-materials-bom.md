---
title: Materials BOM
status: Draft
target: 
  - Web
  - Windows
  - Android
dependencies: 
  - 004-core-parts.md
  - 005-project-revisions.md
---

# Feature: Materials (Bill of Materials)

## 1. Overview
This feature acts as the core Bill of Materials (BOM) engine for Sidekick. It is a many-to-many bridge linking `Parts` from the global inventory to a specific `Project Revision`. It tracks quantities and PCB reference designators. Crucially, it supports "Ghost Materials"—BOM rows that are not yet mapped to a physical inventory part, allowing schematics to be ingested before procurement is complete.

## 2. User Experience & UI
* **Trigger:** Accessed by clicking into a specific Revision from the Project details view.
* **Interaction:** 1. The user views the BOM workspace: a robust data table showing all parts currently assigned to this revision.
    2. **Ghost Material Highlighting:** Any row that has not been mapped to a global `Part` is visually distinguished (e.g., highlighted yellow or adorned with a warning icon).
    3. The user can click a "Map to Part" button on a ghost row, opening the search catalog to link it to a physical item.
    4. To add a part manually, the user clicks "Add Material", searches the catalog, selects a part, enters a `quantity`, and inputs optional `designators`.
    5. Users can edit quantities or designators directly inline within the table.
* **Mobile Considerations:** Tapping a row in the BOM should open a standard bottom-sheet modal to adjust the quantity, designator, or perform the "Map to Part" action easily via touch inputs.

## 3. Technical Implementation
* **Frontend (SolidJS / Tauri):** * A complex data grid component (the BOM view) with conditional row styling based on `part_id === null`.
    * A debounced, auto-complete search component to map ghost rows to physical parts.
* **Backend (FastAPI):** * `GET /api/revisions/{revision_id}/materials` - Returns the fully assembled BOM (requires a `LEFT JOIN` on `Parts` to ensure ghost materials are still returned).
    * `POST /api/materials` - Adds a part to the BOM.
    * `PUT /api/materials/{id}` - Updates the required `quantity`, `designator`, or updates the `part_id` (mapping a ghost row).
    * `DELETE /api/materials/{id}` - Removes the part from this specific BOM.
* **Database Schema (SQLite / Peewee):** * Model: `Material`
    * Columns: `id` (PK), `created_on`, `modified_on`, `revision_id` (FK to Revisions), `part_id` (FK to Parts, **NULLABLE**), `quantity` (REAL/INTEGER), `designator` (VARCHAR 255), `ghost_description` (VARCHAR 255, stores imported text if unmapped).

## 4. Out of Scope
* Automatically deducting these required quantities from physical stock (this is a separate "Build/Produce" action).
* Cost-rollup calculations for Ghost Materials (unmapped parts have no known price, so they contribute $0.00 to the total).

---

## 5. Implementation Tasks
- [ ] Define `Material` Peewee model with nullable `part_id` and `ghost_description`.
- [ ] Build FastAPI route to fetch the `LEFT JOIN` BOM list.
- [ ] Build FastAPI CRUD routes for materials.
- [ ] Create SolidJS BOM data grid with warning states for unmapped rows.
- [ ] Wire frontend to backend API.