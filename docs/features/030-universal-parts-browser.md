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
  * `none`: Read-only navigation and inspection.
  * `single`: Clicking a row triggers detail view or returns the selected part to a caller modal.
  * `multiple`: Checkbox column enabling batch operations (e.g. bulk stow, category assignment, label printing).

## 3. Technical Implementation
* **Frontend (SolidJS / Tauri):**
  * Core Component: [`UniversalPartsBrowser.tsx`](file:///c:/Hobbies/Inventory/Sidekick/client/src/components/parts/UniversalPartsBrowser.tsx) (located in `client/src/components/parts/`).
  * Accepts an optional `parts?: any[]` input property for client-side search, filtering, and sorting over pre-fetched or custom lists, while falling back to remote fetching if omitted.
  * Integrated Toolbar & Views: Search input, category dropdown, low stock toggle, layout mode switcher (`table`, `grid`, `picker`), multi-selection checkboxes, and column sorting.
  * Component Interface:
    ```typescript
    interface UniversalPartsBrowserProps {
      parts?: any[];
      mode?: "table" | "grid" | "picker";
      selectionMode?: "none" | "single" | "multiple";
      initialLocationId?: string;
      initialCategoryId?: string;
      unassignedOnly?: boolean;
      lowStockOnly?: boolean;
      selectedPartIds?: string[];
      title?: string;
      showToolbar?: boolean;
      loading?: boolean;
      onSelectPart?: (part: any) => void;
      onBulkSelect?: (parts: any[]) => void;
      onAutoSelect?: (part: any) => void;
      customActions?: (part: any) => JSX.Element;
    }
    ```
* **Backend (FastAPI / SQLAlchemy):**
  * Standardized Query API on `GET /api/parts` in [`server/app/routers/parts.py`](file:///c:/Hobbies/Inventory/Sidekick/server/app/routers/parts.py):
    * `search`: String (multi-term matching across `value`, `number`, `package`, `notes`, `attributes`).
    * `category_id`: String (supports recursive child category expansion).
    * `location_id`: String (supports location scope and nested storage bins).
    * `is_unassigned`: Boolean (filters parts with zero assigned storage locations).
    * `low_stock`: Boolean (filters parts below reorder threshold).
    * `attr_key` & `attr_value`: Dynamic JSON attribute queries.
    * `sort_by` & `sort_order`: Field sorting (`value`, `number`, `category`, `quantity`, `modified_on`).
    * `page` & `limit`: Server-side pagination.
* **Database Schema:**
  * Uses existing `Part`, `Category`, `Storage`, and `Transaction` models in [`server/app/models.py`](file:///c:/Hobbies/Inventory/Sidekick/server/app/models.py).
  * Ensure SQL indexes on `parts.value`, `parts.number`, `parts.category_id`, and `storage.part_id` for sub-50ms query response times.

## 4. Out of Scope
* External full-text search engine integration (e.g. Elasticsearch/Typesense); pure SQLite `LIKE` / FTS indexing is used to maintain offline-first desktop speed.
* Live drag-and-drop table row reordering (sorting is query-driven).

---

## 5. Implementation Tasks
- [x] Refactor `GET /api/parts` in [`server/app/routers/parts.py`](file:///c:/Hobbies/Inventory/Sidekick/server/app/routers/parts.py) to support standardized filtering, sorting, and location recursion.
- [x] Build [`client/src/components/parts/UniversalPartsBrowser.tsx`](file:///c:/Hobbies/Inventory/Sidekick/client/src/components/parts/UniversalPartsBrowser.tsx) accepting an optional `parts` input property, supporting `table`, `grid`, and `picker` layout modes, live multi-term search, category filtering, low-stock toggles, and column sorting.
- [x] Refactor [`client/src/pages/Parts.tsx`](file:///c:/Hobbies/Inventory/Sidekick/client/src/pages/Parts.tsx) to use the new `UniversalPartsBrowser` component.
- [x] Refactor [`client/src/components/storage/PartsBrowser.tsx`](file:///c:/Hobbies/Inventory/Sidekick/client/src/components/storage/PartsBrowser.tsx) in [`Storage.tsx`](file:///c:/Hobbies/Inventory/Sidekick/client/src/pages/Storage.tsx) to leverage `UniversalPartsBrowser` with location scoping.
- [x] Integrate `UniversalPartsBrowser` into the Homeless Parts view ([`029-homeless-parts.md`](file:///c:/Hobbies/Inventory/Sidekick/docs/features/029-homeless-parts.md)).
- [x] Write unit tests for enhanced `GET /api/parts` query parameters in `server/tests/test_parts_browser.py`.
