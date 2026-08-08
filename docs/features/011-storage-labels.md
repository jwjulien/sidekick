---
title: Storage Label Generation
status: Draft
target: 
  - Web
  - Windows
  - Android
dependencies: 
  - 010-inventory-storage.md
  - 014-deep-link-routing.md
---

# Feature: Storage Label Generation

## 1. Overview
This feature generates printable, physical reference tags for inventory storage locations (e.g., bins, drawers, racks). To ensure the physical labels do not become outdated when inventory moves, the label only contains static spatial identifiers (the location name and its unique ID encoded as a DataMatrix) and explicitly excludes dynamic data like current part assignments or stock quantities.

## 2. User Experience & UI
* **Trigger:** Accessed via a "Print Tag" button next to any location in the master Storage Tree, or within the detail view of a specific Bin/Drawer.
* **Interaction:** 1. The user clicks "Print Tag".
    2. A modal opens displaying a highly accurate, 1:1 visual preview of the label.
    3. The preview clearly shows "Inventory Reference Tag", the location's `label` (e.g., "Resistor Bin"), and a 2D DataMatrix barcode.
    4. The user verifies the preview and clicks "Send to Printer".
* **Mobile Considerations:** The visual preview must be scaled cleanly using CSS to fit within a mobile viewport while maintaining the exact pixel ratio of the underlying canvas for printing.

## 3. Technical Implementation
* **Frontend (SolidJS / Tauri):** * Utilizes an off-screen HTML5 `<canvas>` element to mathematically draw the label.
    * Incorporates a lightweight Javascript barcode library (e.g., `bwip-js`) to render the DataMatrix directly onto the canvas.
      * Datamatrix contains a `fuse:` deep link according to `014-deep-link-routing.md`.
    * Text rendering is handled via standard `CanvasRenderingContext2D` `fillText()` API.
* **Backend (FastAPI):** * No specific backend updates required; the frontend will utilize data already fetched from the `/api/storage` endpoint.

## 4. Out of Scope
* Batch printing hundreds of labels at once (for this phase, labels are generated and printed one at a time on demand).
* Including Part numbers or stock quantities on the label.

---

## 5. Implementation Tasks
- [ ] Install JS DataMatrix generation library.
- [ ] Create SolidJS Label Preview Modal component.
- [ ] Write canvas drawing logic (text positioning, barcode placement, and scaling).