---
title: BOM Import/Export Engine & Mapping Wizard
status: Draft
target: 
  - Web
  - Windows
  - Android
dependencies: 
  - 004-core-parts.md
  - 009-materials-bom.md
---

# Feature: BOM Import/Export Engine & Mapping Wizard

## 1. Overview
This feature allows Sidekick to ingest external Bill of Materials files (Markdown tables and KiCAD CSV exports). It utilizes an interactive "Mapping Wizard" that attempts to auto-match imported rows to existing internal Parts. Unmapped parts can be mapped manually, or committed as "Ghost Materials" to be resolved by the user at a later date.

## 2. User Experience & UI
* **Trigger (Import):** A "Import External BOM" button inside a Revision.
* **Interaction (Import Wizard):** 1. User drops a `.md` or `.csv` (KiCAD) file into a dropzone.
    2. The app parses the file and presents a Mapping Table.
    3. **Auto-Match:** Rows matched to the database are highlighted in Green.
    4. **Unmapped:** Rows with no confident match are highlighted in Yellow.
    5. The user can optionally click an unmapped row to manually query the database and link it.
    6. The user clicks "Commit to BOM." Green rows are saved with a `part_id`. Yellow rows are saved with a `NULL` `part_id`, storing the imported string in the `ghost_description` column.
* **Interaction (Export):** A user clicks "Export to Markdown". The OS save-file dialog opens, saving a formatted `.md` file to their local disk.
* **Mobile Considerations:** File parsing and detailed table mapping is a highly desktop-centric workflow. The UI should prioritize the desktop experience.

## 3. Technical Implementation
* **Frontend (SolidJS / Tauri):** * Utilize Tauri's `fs` and `dialog` APIs to read local files and trigger native save dialogs.
    * An interactive state-driven table component that tracks `imported_data` vs `resolved_part_id`.
* **Backend (FastAPI):** * `POST /api/bom/parse` - An endpoint that accepts raw text/CSV, parses the structure, runs fuzzy matching against the `Parts` table, and returns a JSON payload of `matched` and `unmatched` entities.
    * `GET /api/revisions/{id}/export/markdown` - Generates the markdown string dynamically.

## 4. Out of Scope
* Automatically creating *new* Parts in the master database directly from the import wizard (Parts must be formally created in the Inventory module first to ensure required attributes are filled).

---

## 5. Implementation Tasks
- [ ] Build Python parsing logic for Markdown tables and KiCAD CSV formats.
- [ ] Create FastAPI endpoint to perform fuzzy matching.
- [ ] Build SolidJS Mapping Wizard UI allowing "Commit" with unmapped rows.
- [ ] Build Markdown string generator endpoint for export.
- [ ] Wire up Tauri native file save/open dialogs.