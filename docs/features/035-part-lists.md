---
title: Part Lists & Kits
status: Complete
target: 
  - Web
  - Windows
  - Android
dependencies: 
  - 004-core-parts.md
  - 030-universal-parts-browser.md
  - 034-multi-location-stock-controller.md
---

# Feature: Part Lists & Kits

## 1. Overview
Sidekick users often need to stage, group, or curate arbitrary collections of components outside the context of a formal project revision. This feature introduces **Part Lists & Kits**—a flexible, wishlist/cart-style feature enabling users to create named collections of parts with requested quantities and optional per-item notes.

Part Lists serve multiple operational workflows, including procurement shopping carts (e.g. DigiKey/Mouser wishlists), bench test assembly kits, inventory audit pick lists, and custom component staging.

Crucially, users can mark any list as the **"Active List"**, anchoring a persistent sticky bottom drawer across the entire application workspace. This allows seamless component staging and reference while browsing parts, storage locations, or project pages.

## 2. User Experience & UI
* **Trigger:** Accessed via a new sidebar navigation menu entry **"Part Kits"** (route `/lists` or `/kits`) with a `ShoppingBag` / `Boxes` icon.
* **List Management Dashboard (`/lists`):**
  * **List Grid / Cards:** Displays all user lists with list name, description badge, category tag (`Wishlist`, `Bench Kit`, `Pick List`, `General`), total item count, modified timestamp, and action buttons (`Activate`, `Duplicate`, `Rename`, `Delete`).
  * **Create New List:** A primary `[+ New List]` button opens a modal requesting `name`, `description`, and `type` category.
* **Active List & Sticky Bottom Drawer:**
  * Clicking `[Activate List]` on any list card or detail header sets it as the application's active list and docks a **Sticky Bottom Drawer** to the bottom of the viewport.
  * **Drawer Features:**
    * **Header:** Displays active list title, category tag, unique item count, and quick toggle to collapse/expand drawer body.
    * **Quick Navigation Button:** A `[View Full List]` button immediately routes the user to `/lists/:id`.
    * **Quick Add Current Part:** When viewing a specific component page (`/parts/:id`), a `[+ Add Current Part]` button appears right in the sticky bottom drawer header for instant 1-click addition to the active list.
    * **Deactivation Control:** Clicking the `[✕ Close]` button opens a confirmation prompt ("Deactivate active list?"). Upon confirmation, the active list state is cleared and the sticky bottom drawer is unmounted.
    * **Persistent Visibility:** The drawer stays docked across all routes (Parts, Storage, Dashboard, Projects), allowing instant drag-or-click part additions while exploring the inventory catalog.
* **Component Details View Integration (`/parts/:id`):**
  * Top action buttons bar includes a prominent **`[+ Add to Active List]`** button (or `[Add to List]`).
  * Clicking immediately posts the viewed component to the active list and shows a confirmation toast.
* **List Detail View (`/lists/:id`):**
  * **Header:** Displays list title, category tag, total unique parts, total component quantity required, active list state toggle button (`[Activate List]` / `[Deactivate]`), and header actions (`Add Component`, `Duplicate List`, `Export CSV`, `Delete`).
  * **Items Data Table:**
    * **Part Column:** Displays thumbnail preview, `part.name` / `part.value`, package footprint, MPN, and a click-through button to view the part details page (`/parts/:id`).
    * **Current Stock Column:** Embeds the `MultiLocationStockController` (`034`), showing live total inventory across all locations and opening a popover card for per-location quick adjustments.
    * **Target Quantity Column:** Editable numerical input allowing the user to update the desired quantity directly in the table.
    * **Notes Column:** Short, inline-editable text input field for item-specific notes (e.g., "Order 2 extra for backup", "Requires 0805 SMD pad").
    * **Actions Column:** `[View Details]` button and `[Remove]` button (with confirmation toast/dialog).
* **Adding Components (`UniversalPartFinderModal`):**
  * Clicking `[+ Add Component]` opens `UniversalPartFinderModal` (`030`), wrapping `UniversalPartsBrowser` in `mode="picker"`.
  * **Universal Quantity Input:** Features a built-in numerical quantity controller (default `1`).
  * **Custom Field Slot:** Renders a custom text input field slot for item **Notes** (e.g., "Check footprint before ordering").
  * **Duplicate Addition Behavior & Drawer Locating:** Attempting to add an already-present component returns HTTP 409 Conflict ("Item already in list"). A toast is displayed with an interactive **`[Locate in Drawer]`** button. Clicking it automatically expands the sticky bottom drawer, smooth-scrolls to the part row, and applies a glowing 10-second animated highlight fade.
* **Mobile Considerations:** On narrow viewports, the sticky bottom drawer transforms into a compact bottom sheet with swipe-to-dismiss confirmation, and the item table converts to a stacked card layout.

## 3. Technical Implementation
* **Frontend (SolidJS / Tauri):**
  * **Route / Page:** `client/src/pages/PartLists.tsx` (registered in `client/src/App.tsx`).
  * **Global Context:** `client/src/context/ActiveListContext.tsx` manages `activeListId`, active list item cache, and session/localStorage persistence.
  * **Layout Drawer Component:** `client/src/components/lists/ActiveListBottomDrawer.tsx` mounted inside `Layout.tsx`.
  * **Reusable Components:**
    * `UniversalPartFinderModal.tsx` (`client/src/components/parts/UniversalPartFinderModal.tsx`): Wraps `UniversalPartsBrowser` in `mode="picker"` with universal quantity input and children/slot support for workflow-specific controls (e.g. `notes`).
    * `MultiLocationStockController.tsx` (`034`): Provides inline multi-bin stock inspection and adjustment.
* **Backend (FastAPI / SQLAlchemy):**
  * Router: `server/app/routers/part_lists.py`
  * **REST Endpoints:**
    * `GET /api/lists` - List all part lists with item counts.
    * `POST /api/lists` - Create a new part list (`name`, `description`, `type`).
    * `GET /api/lists/{id}` - Get list details and all attached `PartListItem` rows joined with `Part` data and stock locations.
    * `PUT /api/lists/{id}` - Rename or update list metadata.
    * `POST /api/lists/{id}/duplicate` - Create a deep copy of the list and all items.
    * `DELETE /api/lists/{id}` - Delete a part list and its item rows.
    * `POST /api/lists/{id}/items` - Add a part to the list (`part_id`, `quantity`, `notes`).
    * `PUT /api/lists/{id}/items/{item_id}` - Update item quantity or notes inline.
    * `DELETE /api/lists/{id}/items/{item_id}` - Remove an item from the list.
* **Database Schema (`server/app/models.py`):**
  * **`PartList` Model:**
    * `id` (PK, String/UUID)
    * `name` (String 255, Required)
    * `description` (Text, Optional)
    * `type` (String 50, Default: `"General"`, Options: `"Wishlist"`, `"Bench Kit"`, `"Pick List"`, `"General"`)
    * `is_active` (Boolean, Default `false`)
    * `created_on` (DateTime)
    * `modified_on` (DateTime)
  * **`PartListItem` Model:**
    * `id` (PK, String/UUID)
    * `list_id` (FK to `part_lists.id`, On Delete Cascade)
    * `part_id` (FK to `parts.id`, On Delete Cascade)
    * `quantity` (Float / Integer, Default `1`)
    * `notes` (Text, Optional)
    * `created_on` (DateTime)
    * `modified_on` (DateTime)

## 4. Out of Scope
* Automatic inventory deduction/checkout when "completing" a list (inventory deduction is handled via Build Sheets `020` or manual stock adjustments).
* Direct external web cart API integration (e.g. automatically pushing to DigiKey/Mouser API cart); export is handled via standard CSV format.

---

## 5. Implementation Tasks
- [x] Define `PartList` and `PartListItem` SQLAlchemy models in `server/app/models.py`.
- [x] Create FastAPI router `server/app/routers/part_lists.py` and register in `server/app/main.py`.
- [x] Build `ActiveListContext.tsx` to manage active list state with local storage persistence.
- [x] Build `ActiveListBottomDrawer.tsx` sticky bottom drawer component integrated into `Layout.tsx`.
- [x] Build `UniversalPartFinderModal.tsx` reusing `UniversalPartsBrowser` in picker mode with quantity controller and slot support for custom input fields.
- [x] Create SolidJS `PartLists.tsx` page with list dashboard grid and list detail view.
- [x] Add **"Part Kits"** menu item to sidebar navigation in `client/src/components/Layout.tsx`.
- [x] Wire `MultiLocationStockController` (`034`) into list item table rows.
- [x] Implement CSV export for lists.
- [x] Write backend unit tests in `server/tests/test_part_lists.py`.
