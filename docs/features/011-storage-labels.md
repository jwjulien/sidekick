---
title: Storage Label Generation
status: Complete
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
This feature generates printable, physical reference tags for inventory storage locations (e.g., bins, drawers, racks) and parts. To ensure physical labels function as durable identifiers, each label contains static identifiers (the entity name/value and unique ID encoded in a DataMatrix barcode) along with spatial/hierarchical metadata.

## 2. User Experience & UI
* **Trigger:** Accessed via a "Print Tag" / "Print Label" button next to any location in the master Storage Tree, Bin/Drawer detail view, or Part detail view.
* **Interaction:** 
    1. The user clicks "Print Tag".
    2. A modal opens displaying a highly accurate, 1:1 visual preview of the label.
    3. The preview displays a 2D DataMatrix barcode on the left side (encoding a `fuse:` deep link) and 5 structured data rows on the right:
        - **Row 1:** Title `"Inventory Reference Tag"` in bolded font.
        - **Row 2:** The UUID / ID number of the location/part (`#<UUID>`).
        - **Row 3:** The current `location.name` or `part.value`, respectively.
        - **Row 4:** The location path (e.g., `/root/child/grandchild/location`) or part category path (e.g., `Top Cat, Sub Cat, Group Cat, Parent Cat, Item Cat, Leaf Cat`).
        - **Row 5:** Muted footer line with justified text:
            - Left: Fixed label version `"Version: 3"`.
            - Right: Current print date in `MM/DD/YY` format.
    4. The user verifies the preview and clicks "Send to Printer".
* **Mobile Considerations:** The visual preview must be scaled cleanly using CSS to fit within a mobile viewport while maintaining the exact pixel ratio of the underlying canvas for printing.

## 3. Technical Implementation
* **Frontend (SolidJS / Tauri):**
    * Utilizes an off-screen or inline HTML5 `<canvas>` element to mathematically draw the label (430 x 131 px standard label aspect ratio).
    * Incorporates `bwip-js` barcode library to render the DataMatrix directly onto the left side of the canvas.
    * Text rendering handled via `CanvasRenderingContext2D` `fillText()` API with custom typography:
        * Row 1 (y = 0px): Title `"Inventory Reference Tag"` rendered using **`Audiowide`** font (24px).
        * Row 2 (y = 30px): UUID string `#<UUID>` rendered using **`Quicksand`** font (20px).
        * Row 3 (y = 58px): Location name or part value rendered using **`Quicksand`** font (20px).
        * Row 4 (y = 88px): Hierarchical location path or category breadcrumb chain rendered using **`Roboto`** font (14px).
        * Row 5 (y = 115px): Justified line with `"Version: 3"` rendered using **`Georgia`** font (12px, left) and print date `MM/DD/YY` rendered using **`Georgia`** font (12px, right).
* **Backend (FastAPI):**
    * Frontend retrieves location/part details including full breadcrumbs and category paths via `/api/locations/{id}` and `/api/parts/{id}`.

## 4. Out of Scope
* Batch printing hundreds of labels at once (for this phase, labels are generated and printed one at a time on demand).
* Dynamic stock quantities on reference tags.

---

## 5. Implementation Tasks
- [x] Install JS DataMatrix generation library (`bwip-js`).
- [x] Create SolidJS Label Preview Modal component.
- [x] Update canvas rendering logic to support 5-row structured data layout:
    - [x] Row 1: Header `"Inventory Reference Tag"` (24px Audiowide).
    - [x] Row 2: Entity ID `#<UUID>` (20px Quicksand).
    - [x] Row 3: `location.name` or `part.value` (20px Quicksand).
    - [x] Row 4: Location path (`/root/child/...`) or Part Category chain (14px Roboto).
    - [x] Row 5: Justified footer with `"Version: 3"` (12px Georgia) and current print date (12px Georgia).
- [x] Ensure location path and category hierarchy details are fetched and passed to `LabelPreviewModal.tsx`.
