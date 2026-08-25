---
title: Homeless Parts Browsing & Organization
status: Draft
target: 
  - Web
  - Windows
  - Android
dependencies: 
  - 004-core-parts.md
  - 010-inventory-storage.md
  - 026-inventory-reorgnaization.md
---

# Feature: Homeless Parts Browsing & Organization

## 1. Overview
A "homeless" part is defined as any part record in the database that has zero assigned physical storage locations (i.e. no associated `Storage` table records or total stored quantity of 0 across all bins). Homeless parts typically occur when:
1. A new part is ingested into the system (via manual entry, CSV/BOM import, or supplier order) without specifying an initial storage location.
2. A physical storage container, drawer, or bin containing a part is deleted from the storage hierarchy, setting the part's location references to `NULL`.
3. Inventory is unassigned or cleared during physical shop reorganization.

This feature introduces a dedicated view and workflow ("Homeless Parts Browser & Organizer") to list, filter, inspect, and quickly assign these homeless parts into proper physical storage locations.

## 2. User Experience & UI
* **Trigger:** 
  * A dedicated navigation menu item under Inventory: **"Homeless Parts"** with a live counter badge (e.g. `Homeless Parts (14)`).
  * An interactive alert banner on the main Dashboard indicating unassigned parts requiring triage.
  * A quick filter toggle on the primary Parts list to show "Unassigned Only".
* **Interaction:** 
  1. **Homeless Parts View:** The user navigates to `/inventory/homeless-parts` to view a searchable, paginated table/card list of all homeless parts.
  2. **Filtering & Sorting:** Filter parts by Category, Package/Footprint, Date Added, or Reason ("New Entry" vs "Location Deleted").
  3. **Single Location Assignment:** Clicking "Assign Location" on a part opens a Quick Assignment modal:
     * Interactive tree view or search dropdown of available physical storage locations.
     * Quantity input field (pre-filled with part default/threshold or custom quantity).
     * Option to create a new storage bin inline if the destination location doesn't exist yet.
  4. **Bulk Location Assignment:** Users can select multiple homeless parts via checkboxes and perform batch operations:
     * Assign all selected parts to a common container (e.g., "Sort Tray 1" or "Incoming Goods Bin").
     * Batch assign parts by category to default category drawers.
  5. **Real-time Resolution:** Once assigned, the part smoothly animates out of the Homeless Parts list and updates the navigation badge counter.
* **Mobile Considerations:** 
  * Card-based touch layout optimized for phones/tablets while walking through storage aisles.
  * Direct barcode integration: scanning a bin's DataMatrix/QR barcode while viewing a homeless part instantly assigns the part to that bin.
  * Large, tap-friendly action buttons for single-hand operation.

## 3. Technical Implementation
* **Frontend (SolidJS / Tauri):** 
  * Dedicated route component `client/src/pages/HomelessParts.tsx`.
  * Components: `HomelessPartsTable.tsx` (table view with bulk select), `AssignLocationModal.tsx` (location selector tree), `InlineLocationCreator.tsx` (quick bin creation).
  * Navigation badge context update driven by a lightweight count query.
* **Backend (FastAPI):** 
  * `GET /api/parts/homeless` - Retrieves all parts where `id NOT IN (SELECT part_id FROM storage WHERE part_id IS NOT NULL)` (with search, category filter, and pagination).
  * `GET /api/parts/homeless/count` - Returns the total count of unassigned parts for UI badges.
  * `POST /api/storage/assign` - Transactionally assigns a `part_id` to a target `storage_id` with a specified `quantity`.
  * `POST /api/storage/bulk-assign` - Transactionally assigns multiple `part_ids` to a specified location or set of locations.
* **Database Schema:** 
  * Utilizes existing `Part`, `Storage`, and `Transaction` models in SQLAlchemy ([`server/app/models.py`](file:///c:/Hobbies/Inventory/Sidekick/server/app/models.py)).
  * Add database index on `Storage.part_id` to optimize unassigned part queries.
  * Log a `Transaction` record (`action_type="assign_location"`) whenever a homeless part is assigned to maintain an audit trail.

## 4. Out of Scope
* Automated AI/ML prediction of physical storage locations based on component specs.
* Physical tracking of intermediate "limbo boxes" (parts without storage locations are strictly classified as unassigned).
* Automatic printing of storage labels on assignment (handled as a manual follow-up step via Feature 011).

---

## 5. Implementation Tasks
- [ ] Add `GET /api/parts/homeless` and `GET /api/parts/homeless/count` endpoints in [`server/app/routers/parts.py`](file:///c:/Hobbies/Inventory/Sidekick/server/app/routers/parts.py).
- [ ] Add transactional assignment endpoints (`POST /api/storage/assign` and `POST /api/storage/bulk-assign`) in [`server/app/routers/locations.py`](file:///c:/Hobbies/Inventory/Sidekick/server/app/routers/locations.py).
- [ ] Add DB index on `storage.part_id` for fast unassigned part filtering.
- [ ] Create `client/src/pages/HomelessParts.tsx` view with search, filtering, and bulk selection.
- [ ] Create `AssignLocationModal.tsx` component with location search tree and inline bin creation.
- [ ] Add "Homeless Parts" badge counter to main navigation sidebar and dashboard summary.
- [ ] Integrate barcode scanner event listener on the Homeless Parts view to support scan-to-assign on mobile.
- [ ] Write unit tests for API endpoints (`test_homeless_parts.py`).