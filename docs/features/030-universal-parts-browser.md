---
title: Universal Parts Browser & Filter Engine
status: Complete
target: 
  - Web
  - Windows
  - Android
dependencies: 
  - 004-core-parts.md
  - 010-inventory-storage.md
  - 022-interactive-bom-builder.md
  - 029-homeless-parts.md
---

# Feature: Universal Parts Browser & Filter Engine

## 1. Overview
As the inventory grows, searching, filtering, and navigating parts becomes a central interaction repeated across multiple application views. Rather than duplicating table rendering, search inputs, and filter logic, this feature establishes a reusable, highly-configurable **Universal Parts Browser** component and standardized backend query engine.

The browser provides a consistent experience across the main Parts Catalog, Storage Location views, Homeless Parts triage, Project BOM builders, and mobile scan workflows.

## 2. User Experience & UI
* **Trigger & Insertion Points:**
  * **Parts Catalog Page (`/parts`):** Full-screen table/grid mode with complete attribute filtering and management tools.
  * **Storage Locations (`/storage`):** Embedded scoped browser showing parts stored within a selected container or its child bins.
  * **Homeless Parts View (`/inventory/homeless-parts`):** Unassigned-only mode with bulk checkboxes for rapid triage.
  * **BOM Builder & Pickers:** Compact modal or drawer picker for searching and attaching parts to projects.
* **Display Density & Layout Modes:**
  * `table` mode: Dense desktop tabular layout with customizable/sortable columns, pagination, and inline row actions.
  * `grid` / `card` mode: Touch-friendly visual card grid optimized for mobile screens and quick scanning.
  * `picker` mode: Compact list view with immediate selection buttons for modal workflows.
* **Filtering & Search Engine:**
  * **Multi-term Token Search:** Real-time debounced search matching part value, MPN/number, footprint/package, notes, and custom attributes.
  * **Category Tree Facet:** Filter by single category or recursively include sub-categories.
  * **Location Filter:** Filter by specific storage node, root containers, or toggle "Unassigned / Homeless Only".
  * **Stock Status Toggles:** Quick filters for "Low Stock" (`quantity < threshold`) or "In Stock Only".
  * **Dynamic JSON Attribute Builder:** Filter by key-value specs (e.g. `Resistance = 10k`, `Tolerance = 1%`).
* **Selection Modes:**
  * Designed specifically for single-part selection workflows across the application (e.g. adding parts to project revisions, adding parts to custom lists, or finding parts for inventory check-in).
  * **Universal Features:**
    * Embeds a universal numerical **Quantity** input selector (default: `1`).
    * Supports **arbitrary slot/children controls** to pass workflow-specific fields:
      * **Project Revisions BOM (`009`):** Passes PCB `Designator` text input field (e.g., `C1, C2`).
      * **Part Lists (`035`):** Passes item `Notes` text input field (e.g., "Order 2 extra for backup").
      * **Inventory Check-In / Relocation:** Passes destination storage bin or transaction reason.
  * **Interface:**
    ```typescript
    interface UniversalPartFinderModalProps {
      isOpen: boolean;
      onClose: () => void;
    * `sort_by` & `sort_order`: Field sorting (`value`, `number`, `category`, `quantity`, `modified_on`).
    * `page` & `limit`: Server-side pagination.
* **Database Schema:**
  * Uses existing `Part`, `Category`, `Storage`, and `Transaction` models in [`server/app/models.py`](../server/app/models.py).
  * Ensure SQL indexes on `parts.value`, `parts.number`, `parts.category_id`, and `storage.part_id` for sub-50ms query response times.

## 4. Out of Scope
* External full-text search engine integration (e.g. Elasticsearch/Typesense); pure SQLite `LIKE` / FTS indexing is used to maintain offline-first desktop speed.
* Live drag-and-drop table row reordering (sorting is query-driven).

---

## 5. Implementation Tasks
- [x] Refactor `GET /api/parts` in [`server/app/routers/parts.py`](../server/app/routers/parts.py) to support standardized filtering, sorting, and location recursion.
- [x] Build [`client/src/components/parts/UniversalPartsBrowser.tsx`](../client/src/components/parts/UniversalPartsBrowser.tsx) accepting an optional `parts` input property, supporting `table`, `grid`, and `picker` layout modes, live multi-term search, category filtering, low-stock toggles, and column sorting.
- [x] Refactor [`client/src/pages/Parts.tsx`](../client/src/pages/Parts.tsx) to use the new `UniversalPartsBrowser` component.
- [x] Refactor [`client/src/components/storage/PartsBrowser.tsx`](../client/src/components/storage/PartsBrowser.tsx) in [`Storage.tsx`](../client/src/pages/Storage.tsx) to leverage `UniversalPartsBrowser` with location scoping.
- [x] Integrate `UniversalPartsBrowser` into the Homeless Parts view ([`029-homeless-parts.md`](../docs/features/029-homeless-parts.md)).
- [ ] Build `UniversalPartFinderModal.tsx` wrapping `UniversalPartsBrowser` in picker mode with universal quantity input and children/slot support for workflow-specific inputs.
- [x] Write unit tests for enhanced `GET /api/parts` query parameters in [`server/tests/test_parts_browser.py`](../server/tests/test_parts_browser.py).
