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
This feature addresses the physical realities of shop maintenance. It provides a robust, transactional workflow for moving physical inventory. It supports five distinct physical operations: moving an entire container to a new geometric slot, transferring all contents from one bin to another, splitting a partial quantity into a new location, consolidating scattered parts back into a primary storage bin, and nesting parts into an existing location via **Leaf Node Auto-Migration** (enforcing the Node Exclusivity Rule).

## 2. User Experience & UI
* **Trigger:** A "Transfer / Reorganize" action button available on both the Part Detail view, the Location Detail view, and the in-modal part movement workflow (`MovePartModal`).
* **Interaction:** The user opens the Transfer Wizard and selects one of the operational modes:
    1. **Move Container:** The user selects a Location (e.g., "Drawer 5") and chooses a new parent and geometric slot. The UI warns/blocks the action if the destination slot is already occupied.
    2. **Transfer All:** The user selects an origin bin and a destination bin. All parts are moved.
    3. **Split Stock:** The user selects an origin bin, a destination bin, and inputs a specific transfer `quantity`. The UI verifies the transfer quantity does not exceed the origin quantity.
    4. **Consolidate (Clean Up):** The user selects a specific Part. The UI lists all scattered locations holding that part. The user selects a "Master Destination" and clicks "Consolidate". An alert prompts: *"Delete origin locations if they are now empty?"*
    5. **Nest into Location (Leaf Node Auto-Migration):**
        * When a user moves parts and selects or scans (via NFC/barcode) a target location to add a new child leaf node, the system checks whether the destination currently holds assigned parts.
        * **Node Exclusivity Enforcement:** Because storage nodes may contain either child locations OR parts (never both), adding a child leaf node to an already-occupied location triggers an automatic migration prompt:
          > *"Location [Destination] currently holds [Part Name] (Qty: [N]). Adding sub-bins will migrate existing parts into a child sub-bin."*
        * Upon user confirmation, Sidekick transactionally:
          1. Creates a new child leaf node under the destination for the existing parts.
          2. Moves the existing part assignment and quantity into that child node.
          3. Creates another sibling leaf node for the incoming relocated parts.
          4. Clears part assignment from the parent location, converting it into a clean container node.
* **Mobile Considerations:** Scanning is critical here. A user holding their phone should be able to tap "Transfer", scan the barcode/NFC tag of the origin bin, scan the barcode/NFC tag of the destination bin, and type the quantity (or confirm leaf migration) to instantly execute a physical move while standing in the aisle.

## 3. Technical Implementation
* **Frontend (SolidJS / Tauri):** 
    * A unified Transfer Wizard component that conditionally renders inputs based on the selected mode.
    * Integration with the Universal Scanner and NFC listeners to auto-populate origin/destination fields when a location DataMatrix or NFC tag is scanned.
    * Migration confirmation dialog with before-and-after tree visualization.
* **Backend (FastAPI):** 
    * All transfer operations must be wrapped in SQLAlchemy database transactions to prevent data corruption.
    * `PUT /api/storage/{id}/relocate` - Updates the `parent_id`, `pos_x`, `pos_y`, and `pos_z` of a container. Validates destination emptiness.
    * `POST /api/storage/transfer` - Accepts a payload defining `part_id`, `origin_id`, `destination_id`, and `quantity`. Subtracts from origin, adds to destination.
    * `POST /api/storage/consolidate` - Accepts a `part_id` and a `master_destination_id`. Loops through all other locations holding that part, transfers their quantities to the master, and optionally triggers a `DELETE` on the empty origin rows.
    * `POST /api/storage/{id}/split-leaf` - Transactionally executes the leaf migration workflow: moves existing `part_id` and `quantity` from parent `{id}` to a new child node, clears parent part assignment, and attaches the incoming part to a second new child node.
* **Database Schema (SQLite / SQLAlchemy):** 
    * Relies on transactional manipulation of the `Storage` table adhering to the Node Exclusivity Rule (`parent_id IS NOT NULL` or `part_id IS NOT NULL`, but never both populated simultaneously on a node with children).

## 4. Out of Scope
* Moving an entire Rack or high-level parent location to a different Shop (handled via basic hierarchy editing, not this wizard).
* "In-transit" tracking (e.g., parts are on a cart moving between buildings). Transfers in this phase are instantaneous.

---

## 5. Implementation Tasks
- [ ] Build FastAPI transactional `/relocate` route with spatial collision detection.
- [ ] Build FastAPI transactional `/transfer` route for splitting/moving parts.
- [ ] Build FastAPI transactional `/consolidate` route with optional cleanup logic.
- [ ] Build FastAPI transactional `/split-leaf` route for occupied node auto-migration.
- [ ] Create SolidJS Transfer Wizard modal with the distinct operational modes.
- [ ] Wire the Universal Scanner and NFC reader to the wizard to allow rapid origin/destination selection.