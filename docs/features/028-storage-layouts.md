---
title: Storage Layouts, Navigation & Spatial Editor
status: In Progress
target: 
  - Web
  - Windows
  - Android
dependencies: 
  - 004-core-parts.md
  - 010-inventory-storage.md
---

# Feature: Storage Layouts, Navigation & Spatial Editor

## 1. Overview
This feature provides a robust visual navigation and editing system for the physical storage tree. It utilizes a cascading column interface (Miller Columns) for deep drilling without losing context. Furthermore, it dynamically renders 1D and 2D container geometries, providing a drag-and-drop spatial editor that allows users to physically organize bins, resize parent containers safely, and configure multi-slot spanned footprints.

## 2. User Experience & UI
* **Trigger:** Accessed via the "Storage Locations" tab in the main navigation.
* **Interaction (Navigation):** 1. The user navigates using cascading Miller Columns. Each column displays the name of the parent node at the top.
    2. Selecting a node opens its children in the next column to the right.
    3. **Details Pane:** When a node is selected, a Details Pane is shown to the right of the active columns. This pane contains the Location's metadata, Print action, Delete action, Move action, and a Part Card (if a part is assigned).
* **Interaction (CRUD Operations):**
    * **Create:** Users can add new child locations via an "Add Child" button at the top/bottom of a Miller Column (for Default layouts), or by clicking an empty slot in a Linear/Grid layout.
    * **Read/Update (Metadata):** Users view and edit a location's `name` and `description` within the Details Pane.
    * **Delete:** A delete action (`<Trash2 />`) is available in the Details Pane. Deletion is blocked if the node contains children or an assigned part.
* **Interaction (Moving Locations):**
    1. Drag-and-drop handles repositioning *within* the same parent's 1D/2D grid.
    2. Moving a location to a completely different parent node (or different storage unit) is triggered via a "Move Location" button in the Details Pane.
    3. This launches a "Transfer Location" dialog (integrating with Feature 026) where the user selects the destination parent from a hierarchical picker and confirms the move.
* **Interaction (Dimension Configuration):** 1. When viewing a parent Location's settings, the user sees a "Layout Type" selector: **Default (List)**, **Linear (1D)**, or **Grid (2D)**.
    2. Selecting **Linear** reveals a `Length` numeric input.
    3. Selecting **Grid** reveals `Columns` and `Rows` numeric inputs.
    4. **Safety Constraint:** The UI dynamically calculates the maximum index occupied by any child (factoring in the child's span). The numeric inputs enforce a `min` attribute equal to this maximum, preventing the user from shrinking the container and accidentally "deleting" or hiding an occupied slot.
* **Interaction (Drag-and-Drop Editor):**
    * **Default Layout (Dimensions = NULL):** Renders a vertical list. Users can grab a handle to drag-sort children. Dropping an item instantly recalculates and saves the sequential `index` for all affected siblings.
    * **Linear / Grid Layouts (1D & 2D):** Renders the rigid slots preserving empty space. Users can drag an occupied slot and drop it into an empty slot, instantly updating the child's `index`.
* **Interaction (Span Configuration):** 1. If a child lives inside a Linear/Grid parent, its detail card exposes a "Footprint / Span" setting.
    2. The user can adjust how many slots it consumes (e.g., spanning 2 columns and 2 rows).
    3. The `index` of the item always acts as the top-left origin coordinate.
    4. **Collision Detection:** The UI prevents a user from dropping a spanned item into a slot where its footprint would overlap another occupied slot or overflow the parent's maximum dimensions.
* **Interaction (Part Cards & Validation):** 1. Locations holding parts display a Part Card (value, category, quantity, and links to sibling locations) within the Details Pane.
    2. **Print Label:** The Details Pane includes a "Print Reference Tag" action (as per Feature 011).
    3. **Warning State:** If a node has BOTH children AND an assigned `part_id`, it is flagged with a warning icon in the Details Pane to encourage relocating the part to a leaf node.

## 3. Technical Implementation
* **Frontend (SolidJS / Tauri):** * A polymorphic rendering component that uses the parent's `dimensions` to switch between `<SortableList />`, `<SlottedArray />`, and `<CSSGridEditor />`.
    * A robust drag-and-drop library (e.g., `@thisbeyond/solid-dnd`).
    * **Grid Math Engine:** A localized utility function that translates a 1D `index` into 2D `(x, y)` coordinates based on the parent's `columns` count to handle CSS Grid placement and collision detection during drag events.
* **Backend (FastAPI):** * `PUT /api/storage/{id}/layout` - Updates the `dimensions` JSON array. Validates that the new bounds encompass all existing child indices + spans.
    * `PUT /api/storage/reorder` - A transactional endpoint that accepts an array of `{ id: str, index: int }` to bulk-update sibling indices after a flat-list drag-sort.
    * `PUT /api/storage/{id}/slot` - Updates a specific child's `index` and `span` JSON after being dropped into a new geometric slot.
* **Database Schema (SQLite / Peewee):** * Utilizes the existing `Storage` model (`dimensions`, `span`, `index`, `parent_id`).

## 4. Out of Scope
* `label_scheme` implementation (rendering dynamic text based on the scheme will be deferred).
* Complex 3D modeling of the containers (this view remains an interactive 2D schematic).
* Dragging a child node out of one Miller Column and dropping it into a *different* parent column (transfers between parents are handled via the distinct Transfer Wizard defined in Feature 026).

---

## 5. Implementation Tasks
- [x] Build SolidJS Miller Columns layout with column headers.
- [ ] TODO: Implement advanced `name` search filter for Miller Columns.
- [x] Build Details Pane component (via modals and inline views) to display metadata, Print, Delete, and Move actions.
- [x] Add empty-state interactions in Miller Columns and Grid views to Create new child locations.
- [x] Implement "Move Location" dialog to transfer nodes to different parents (Feature 026 integration).
- [x] Build "Layout Type" Form component (Default, Linear, Grid) with max-index safety bounds.
- [x] Implement `@thisbeyond/solid-dnd` for flat-list index sorting.
- [ ] TODO: Implement coordinate-mapping logic for CSS Grid drag-and-drop with span collision detection (1D/2D layouts).
- [ ] TODO: Add footprint / span configuration in Details Pane for child nodes in Grid/Linear layouts.
- [x] Build FastAPI transactional routes for bulk-updating `index` arrays.
- [x] Build Part Card UI (inside Details Pane) with sibling jump-links.
- [ ] TODO: Implement node validation warnings (flagging if a node has BOTH children AND an assigned `part_id`).
- [ ] Bug: Changing the type from default to 2D grid is possible on nodes in the tree.