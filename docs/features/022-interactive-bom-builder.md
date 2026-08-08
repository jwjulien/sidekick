---
title: Interactive BOM Builder (Cart Workflow)
status: Draft
target: 
  - Web
  - Windows
  - Android
dependencies: 
  - 004-core-parts.md
  - 009-materials-bom.md
  - 021-project-assemblies.md
---

# Feature: Interactive BOM Builder

## 1. Overview
This feature provides a "shopping cart" style workflow for building a Bill of Materials. Instead of manually typing part numbers into a blank sheet, users can browse, filter, and sort the global Parts database, actively adding components to a "Working BOM" for a specific Project Revision.

## 2. User Experience & UI
* **Trigger:** Accessed via an "Open Builder" button inside a Revision.
* **Interaction:** 1. The screen splits: the master Parts catalog is on the left, and the "Working BOM Cart" is a persistent sidebar on the right.
    2. The user uses advanced filters (from Feature 004) to find a part.
    3. The user clicks "Add to BOM" on a part row.
    4. The item flies into the right sidebar. The user can adjust the `quantity` and input `designators` directly in the sidebar.
    5. The BOM saves automatically in the background (auto-save) as items are adjusted.
* **Mobile Considerations:** The side-by-side UI is impossible on mobile. On phones, the "Working BOM" becomes a persistent floating action button (FAB) with a badge counter (like a traditional e-commerce cart) that opens a bottom-sheet when tapped.

## 3. Technical Implementation
* **Frontend (SolidJS / Tauri):** * Global state management (Context or Signals) to track the active `revision_id` and the current state of the BOM cart across different catalog views.
    * Debounced API calls to `PUT /api/materials/{id}` to facilitate the auto-save functionality without overwhelming the SQLite database on rapid keystrokes.
* **Backend (FastAPI):** * Relies on existing `Materials` endpoints, but requires strict validation to ensure quantities are handled safely during rapid UI updates.

## 4. Out of Scope
* Checking out/Purchasing components directly from external suppliers via API.

---

## 5. Implementation Tasks
- [ ] Build persistent SolidJS "BOM Cart" sidebar/modal component.
- [ ] Wire Add/Remove buttons on the master Parts Grid to the active cart state.
- [ ] Implement debounced auto-save logic to sync the frontend cart with the backend database.