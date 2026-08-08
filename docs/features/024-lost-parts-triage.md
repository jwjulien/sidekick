---
title: Lost Parts Triage (Unassigned Inventory)
status: Draft
target: 
  - Web
  - Windows
  - Android
dependencies: 
  - 004-core-parts.md
  - 010-inventory-storage.md
---

# Feature: Lost Parts Triage

## 1. Overview
This feature acknowledges the reality of receiving: parts are often logged into the database upon delivery but left in a physical "limbo" box until a proper storage bin is created. The Triage feature provides a dedicated workflow to isolate these "lost" parts and rapidly create new physical storage locations to properly ingest them into the workshop.

## 2. User Experience & UI
* **Trigger:** A prominent "Triage" or "Unassigned" badge/button on the main Inventory dashboard, showing a counter of currently lost parts.
* **Interaction:** 1. The user clicks the Triage badge and is presented with a list of all parts that currently have zero assigned storage locations.
    2. The user selects a part from the list and clicks "Stow".
    3. A rapid-assignment modal opens. The user can either select an existing bin from a dropdown, OR click "Create New Location".
    4. If creating a new location, the user selects a parent (e.g., "Resistor Drawer") and provides a bin label. 
    5. The user inputs the physical quantity they are stowing.
    6. Upon saving, the part is assigned, the Triage list updates, and the user is optionally prompted to instantly print a location label (triggering Feature 011).
* **Mobile Considerations:** This is an excellent mobile workflow. A user can stand over the "limbo box" with their phone, tap a lost part, create a bin, and physically put the item away in real-time. The UI should prioritize large, tap-friendly lists and easy quantity incrementers.

## 3. Technical Implementation
* **Frontend (SolidJS / Tauri):** * A dedicated view/route (e.g., `/inventory/triage`) displaying the filtered list.
    * A rapid-assignment modal component that wraps the location-creation logic normally found in the main Storage settings.
* **Backend (FastAPI):** * `GET /api/parts/unassigned` - A dedicated endpoint that performs a database query to find all parts that lack an associated record in the `Storage` table (or where the sum of their stored quantities equals 0).
    * `POST /api/storage/rapid-stow` - A compound endpoint that, in a single transaction, creates a new `Storage` container (if a new one was defined) and updates its `part_id` and `quantity` fields.

## 4. Out of Scope
* Auto-generating storage locations based on the part's category (the physical realities of where a bin fits require human intervention).
* Tracking the specific "limbo boxes" (e.g., tracking that a part is in "DigiKey Box 4"). Lost parts are simply unassigned.

---

## 5. Implementation Tasks
- [ ] Build FastAPI `GET` route utilizing a `LEFT JOIN` to isolate unassigned parts.
- [ ] Build FastAPI `POST` transactional route for the rapid-stow logic.
- [ ] Create SolidJS Triage List view.
- [ ] Create SolidJS Rapid-Assignment Modal with inline location creation.
- [ ] Wire the modal's success state to optionally trigger the Label Printing workflow.