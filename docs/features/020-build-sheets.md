---
title: Project Build Sheets & BOM Printout
status: Draft
target: 
  - Web
  - Windows
  - Android
dependencies: 
  - 009-materials-bom.md
  - 013-barcode-scanning.md
  - 014-deep-link-routing.md
---

# Feature: Project Build Sheets & BOM Printout

## 1. Overview
This feature generates a two-page, version-controlled physical staging document for a specific Project Revision. 
* **Page 1 (The Map):** A visual grid perfectly matching the geometry of an iFixit Anti-Static Project Tray, allowing users to drag-and-drop grouped components into physical bin locations.
* **Page 2 (The Ledger):** A detailed financial and tabular Bill of Materials, designed to print on the reverse side of the paper.
The sheet features deep-linking DataMatrix codes and supports a strict "Locked/Unlocked" lifecycle to prevent discrepancies between the printed sheet and the digital record.

## 2. User Experience & UI
* **Trigger:** Accessed via a "Generate Build Sheet" button within a specific Project Revision workspace.
* **Interaction (Design Mode):** 1. A new, Unlocked sheet is created. The UI presents a visual representation of the iFixit tray layout.
    2. An "Unassigned Parts" sidebar lists all materials from the BOM, automatically aggregated by `part_id`.
    3. The user drags these part groups into the visual tray bins.
    4. The user can toggle a view to preview Page 2 (The BOM Table), which automatically calculates extended prices based on the quantities.
    5. The user clicks "Lock & Print". The sheet state changes to Locked, preventing further layout edits, and opens the native OS print dialog.
* **Interaction (Interactive View Mode):** 1. A user scans the DataMatrix on a physical, printed Build Sheet using Sidekick's Universal Scanner.
    2. The app deep-links directly to the read-only Interactive View of that specific locked sheet.
    3. The user can tap a part group in the digital list, and the corresponding bin on the visual tray highlights to assist with location.
* **Mobile Considerations:** The drag-and-drop designer is optimized for desktop screens. On mobile, the Interactive View (locator) is the prioritized UI, utilizing a tap-to-highlight mechanic.

## 3. Technical Implementation
* **Frontend (SolidJS / Tauri):** * A drag-and-drop library (e.g., `@thisbeyond/solid-dnd`) to handle part sorting.
    * An aggregation algorithm to compress sequences (e.g., `R1, R3, R2` -> `R1-R3`).
    * **Print CSS:** Strict `@media print` rules. Page 1 (The Tray) must be scaled to fill a US Letter page. Page 2 (The BOM Table) must be forced onto a new sheet using the `page-break-before: always;` CSS property. 
    * Printing is triggered via standard `window.print()`, handing the job off to the OS (Windows/Android) to communicate with standard WiFi/Network printers (like an Epson laser printer).
* **Backend (FastAPI):** * `GET /api/revisions/{id}/sheets` - List all build sheets for a revision.
    * `POST /api/sheets` - Create a new draft sheet.
    * `PUT /api/sheets/{id}/lock` - Finalizes the sheet, generating the permanent `fuse://` deep-link UUID payload for the DataMatrix.
    * `POST /api/sheets/{id}/assignments` - Saves the physical bin mappings for an unlocked sheet.
* **Database Schema (SQLite / Peewee):** * Model: `BuildSheet`
        * Columns: `id` (PK), `revision_id` (FK), `version` (INTEGER), `is_locked` (BOOLEAN), `datamatrix_uuid` (VARCHAR 36).
    * Model: `SheetAssignment`
        * Columns: `id` (PK), `sheet_id` (FK), `part_id` (FK), `bin_index` (INTEGER), `aggregated_designator` (VARCHAR 255), `quantity` (INTEGER).

## 4. Out of Scope
* Writing custom raw socket drivers for standard desktop printers (we rely on the OS print spooler).
* Unlocking a locked sheet. Errors on a locked sheet must be fixed by generating a new version.

---

## 5. Implementation Tasks
- [ ] Define `BuildSheet` and `SheetAssignment` Peewee models.
- [ ] Build FastAPI routes for sheet lifecycle.
- [ ] Implement designator compression algorithm in frontend Javascript.
- [ ] Create SolidJS drag-and-drop tray designer UI (Page 1).
- [ ] Create SolidJS BOM Table summary UI with price calculations (Page 2).
- [ ] Create Print CSS stylesheet with `page-break-before` for accurate duplex printing.
- [ ] Build SolidJS Interactive View for deep-link scanning.