---
title: Inventory Reorganization & Transfers
status: Draft
target: 
  - Web
  - Windows
  - Android
dependencies: 
  - 004-core-parts.md
  - 010-inventory-storage.md
  - 013-barcode-scanning.md
---

# Feature: Inventory Reorganization & Transfers

## 1. Overview
This feature addresses the physical realities of shop maintenance. It provides a robust, transactional workflow for moving physical inventory. It supports four distinct physical operations: moving an entire container to a new geometric slot, transferring all contents from one bin to another, splitting a partial quantity into a new location, and consolidating scattered parts (e.g., emptying a "project box") back into a primary storage bin.

## 2. User Experience & UI
* **Trigger:** A "Transfer / Reorganize" action button available on both the Part Detail view and the Location Detail view.
* **Interaction:** The user opens the Transfer Wizard and selects one of four modes:
    1. **Move Container:** The user selects a Location (e.g., "Drawer 5") and chooses a new parent and geometric slot. The UI warns/blocks the action if the destination slot is already occupied.
    2. **Transfer All:** The user selects an origin bin and a destination bin. All parts are moved.
    3. **Split Stock:** The user selects an origin bin, a destination bin, and inputs a specific transfer `quantity`. The UI verifies the transfer quantity does not exceed the origin quantity.
    4. **Consolidate (Clean Up):** The user selects a specific Part. The UI lists all scattered locations holding that part. The user selects a "Master Destination" and clicks "Consolidate". An alert prompts: *"Delete origin locations if they are now empty?"*
* **Mobile Considerations:** Scanning is critical here. A user holding their phone should be able to tap "Transfer", scan the barcode of the origin bin, scan the barcode of the destination bin, and type the quantity to instantly execute a physical move while standing in the aisle.

## 3. Technical Implementation
* **Frontend (SolidJS / Tauri):** * A unified Transfer Wizard component that conditionally renders inputs based on the selected mode.
    * Integration with the Universal Scanner to auto-populate origin/destination fields when a location DataMatrix is scanned.
* **Backend (FastAPI):** * All transfer operations must be wrapped in Peewee `@db.atomic()` transactions to prevent data corruption.
    * `PUT /api/storage/{id}/relocate` - Updates the `parent_id`, `pos_x`, `pos_y`, and `pos_z` of a container. Validates destination emptiness.
    * `POST /api/storage/transfer` - Accepts a payload defining `part_id`, `origin_id`, `destination_id`, and `quantity`. Subtracts from origin, adds to destination.
    * `POST /api/storage/consolidate` - Accepts a `part_id` and a `master_destination_id`. Loops through all other locations holding that part, transfers their quantities to the master, and optionally triggers a `DELETE` on the empty origin rows.
* **Database Schema (SQLite / Peewee):** * No schema changes required. This feature relies entirely on complex transactional manipulation of the existing `Storage` table.

## 4. Out of Scope
* Moving an entire Rack or high-level parent location to a different Shop (handled via basic hierarchy editing, not this wizard).
* "In-transit" tracking (e.g., parts are on a cart moving between buildings). Transfers in this phase are instantaneous.

---

## 5. Implementation Tasks
- [ ] Build FastAPI transactional `/relocate` route with spatial collision detection.
- [ ] Build FastAPI transactional `/transfer` route for splitting/moving parts.
- [ ] Build FastAPI transactional `/consolidate` route with optional cleanup logic.
- [ ] Create SolidJS Transfer Wizard modal with the 4 distinct operational modes.
- [ ] Wire the Universal Scanner to the wizard to allow rapid origin/destination selection via barcode.