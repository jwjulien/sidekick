---
title: Ubiquitous Quantity Controller
status: Complete
target: 
  - Web
  - Windows
  - Android
dependencies: 
  - 027-ubiquitous-stock-controller.md
  - 035-part-lists.md
---

# Feature: Ubiquitous Quantity Controller

## 1. Overview
Numerical quantity adjustment is a fundamental interaction across Sidekick, including storage bin stock counts, Part Lists required quantities, BOM material line items, and batch procurement carts. The **Ubiquitous Quantity Controller** (`QuantityController.tsx`) is a lightweight, reusable component providing intuitive `-` / `+` step controls, a click-to-edit numerical input box, debounced change propagation, and a contextual `onDelete` trash icon transition when quantities reach 1.

## 2. User Experience & UI
* **Trigger:** Embedded in data tables, detail views, drawer panels, and stock cards whenever numerical quantities are displayed or modified.
* **Interaction:**
  * **Step Buttons:** `-` (Minus) and `+` (Plus) buttons step quantities up or down by a configurable `step` increment (default `1`).
  * **Click-to-Edit Display:** Clicking the central numerical font switches the element into a focused inline `<input type="number">` for typing arbitrary numbers directly, committing on `Blur` or `Enter`.
  * **Contextual Delete Transition:** When an optional `onDelete` handler is provided and the quantity reaches `1` (or `min`), the left `-` button automatically transforms into a subtle red `Trash2` icon. Clicking it triggers immediate item removal instead of stepping down to zero.
  * **Compact Mode:** Supports a dense `compact={true}` variant tailored for dense data tables (`Req. Qty` in Part Lists and sticky drawers) with `32px x 32px` touch targets.
* **Mobile Considerations:** Touch-friendly target sizing with tactile active feedback (`active:scale-95`) and numeric keyboard triggers on mobile web/Tauri builds.

## 3. Technical Implementation
* **Frontend (SolidJS / Tauri):**
  * **Component:** `client/src/components/QuantityController.tsx`.
  * **Props Contract (`QuantityControllerProps`):**
    * `value`: number (current quantity).
    * `min`: number (optional, default `0`).
    * `max`: number (optional).
    * `step`: number (optional, default `1`).
    * `compact`: boolean (optional).
    * `disabled`: boolean (optional).
    * `label`: string (optional unit label).
    * `onDelete`: `() => void | Promise<void>` (optional removal handler).
    * `onChange`: `(newVal: number) => void` (debounced change callback).
  * **Sub-component Composition:** Reused inside `StockController.tsx` for storage counts and inside the unified `PartListItemsTable.tsx` component consumed by both `PartLists.tsx` and `ActiveListBottomDrawer.tsx`.
  * **Interactive Undo Toast Pattern:** On item removal via `onDelete`, a dark toast displays item name alongside a 1-click `[RotateCcw Undo]` button that restores item snapshot data on trigger.
* **Backend (FastAPI / SQLite):** Stateless UI component; delegates persistence to parent view handlers (e.g. `PUT /locations/{id}/count`, `PUT /lists/{id}/items/{item_id}`).
* **Database Schema:** No database changes required.

## 4. Out of Scope
* Drag-to-scale gesture controls.
* Built-in multi-currency pricing calculations (handled in component parents).

---

## 5. Implementation Tasks
- [x] Create standalone `QuantityController.tsx` component.
- [x] Implement `-` / `+` step buttons with debounced `onChange` callback.
- [x] Add click-to-edit inline number input box.
- [x] Add contextual `onDelete` property transforming the left button to `Trash2` at quantity 1.
- [x] Refactor `StockController.tsx` to wrap `QuantityController.tsx`.
- [x] Create shared `PartListItemsTable.tsx` component to DRY list row rendering.
- [x] Integrate `QuantityController.tsx` and `PartListItemsTable.tsx` into Part Lists table and Active List Bottom Drawer.
- [x] Add interactive Undo toast pattern on item deletion.
