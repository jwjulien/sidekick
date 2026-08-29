---
title: Multi-Location Stock Controller Component
status: Draft
target: 
  - Web
  - Windows
  - Android
dependencies: 
  - 010-inventory-storage.md
  - 027-ubiquitous-stock-controller.md
  - 031-universal-location-selector.md
---

# Feature: Multi-Location Stock Controller Component

## 1. Overview
Parts in Sidekick often reside across multiple physical storage bins or shelf locations. When parts are displayed within tabular views (such as Part Lists, Search Results, or BOM builders), rendering stock for only a single location is insufficient. 

This feature introduces the **`MultiLocationStockController`**—an adaptive UI primitive that inspects a part's total inventory distribution. If a part exists in a single location, it renders immediate `+` / `-` stock adjustment controls. If the part exists across multiple locations, it displays the aggregated stock count and opens a fast popover card on click/tap, allowing the user to view all storage locations and rapidly adjust inventory at any specific bin with minimal clicks and zero page navigation.

## 2. User Experience & UI
* **Trigger:** Renders in tabular lists, Part Detail headers, search results, and custom Part Lists whenever part stock needs to be inspected or adjusted inline.
* **Single Location Mode (1 storage node):**
  * Displays the quantity for that location with adjacent `[-]` and `[+]` buttons.
  * Tapping `+` or `-` updates the count inline, using debounced backend dispatch to prevent spamming the API.
* **Multi-Location Mode (2+ storage nodes):**
  * Displays the total aggregated quantity across all locations (e.g. `125 total (3 bins)`).
  * Tapping `+` or `-` or clicking the stock badge opens a clean, floating popover card positioned relative to the control.
  * **Popover Contents:**
    * A list of all storage locations containing this part.
    * Each row displays `location.name` with its full breadcrumb path (e.g., `Cabinet A > Bin B2`).
    * Each row contains an embedded `StockController` (`027`) for that specific storage ID, complete with `+` / `-` buttons and count confirmation.
    * A header displaying total combined quantity dynamically updating as individual location counts change.
* **Homeless Mode (0 storage nodes):**
  * Displays `0 (Unassigned)` in warning styling.
  * Clicking opens `UniversalLocationSelector` (`031`) to immediately stow the part in a storage location.
* **Mobile Considerations:** On touch devices, the popover card displays as a bottom sheet or centered touch-friendly modal if the viewport width is narrow.

## 3. Technical Implementation
* **Frontend (SolidJS / Tauri):**
  * Component: `client/src/components/parts/MultiLocationStockController.tsx`.
  * **Props:**
    ```typescript
    interface MultiLocationStockControllerProps {
      partId: string;
      totalQuantity: number;
      locations?: Array<{
        id: string;
        name: string;
        breadcrumb: string;
        quantity: number;
        last_counted?: string | null;
      }>;
      compact?: boolean;
      onChanged?: (updatedLocations: any[]) => void;
    }
    ```
  * Reuses `StockController.tsx` (`027`) inside popover rows.
  * Uses 500ms debouncing per location to batch rapid click increments before issuing `PUT /locations/{id}/count`.
* **Backend (FastAPI):**
  * Reuses existing `PUT /locations/{id}/count` endpoint in `server/app/routers/locations.py`.
  * `GET /api/parts/{id}` includes nested `locations` list with `id`, `name`, `breadcrumb`, `quantity`, and `last_counted`.

## 4. Out of Scope
* Automatic transfer/relocation of stock between two bins inside the popover (relocation remains handled by the dedicated Part Details Stow/Relocate modal).

---

## 5. Implementation Tasks
- [ ] Create `MultiLocationStockController.tsx` component in `client/src/components/parts/`.
- [ ] Implement adaptive rendering logic (1 location vs multiple locations vs 0 unassigned locations).
- [ ] Build SolidJS floating popover container with outdoor click dismiss and focus management.
- [ ] Wire per-location `StockController` instances inside the popover with 500ms debouncing.
- [ ] Integrate `MultiLocationStockController` into Part Lists (`035`), Parts Catalog table (`030`), and Part Details view.
