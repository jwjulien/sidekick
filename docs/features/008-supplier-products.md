---
title: Supplier Products
status: Complete
target: 
  - Web
  - Windows
  - Android
dependencies: 
  - 003-suppliers.md
  - 004-core-parts.md
---

# Feature: Supplier Products

## 1. Overview
This feature bridges the gap between internal inventory (`Parts`) and the outside world (`Suppliers`). It allows users to map a single internal component to multiple external vendor SKUs. By tracking supplier-specific part numbers and direct URLs, users can rapidly source and reorder components without hunting through external vendor search bars.

## 2. User Experience & UI
* **Trigger:** Accessed via a "Sourcing" or "Vendors" tab within the Detail View of a specific Part.
* **Interaction:** 1. The user navigates to a part and views a list of existing external sources.
    2. The user clicks "Add Source".
    3. A form opens with a dropdown to select a saved `Supplier`.
    4. The user inputs the supplier's specific `sku` (part number) and an optional direct `url`.
    5. Upon saving, the source is added. Users can click a "Buy" or "View" button to instantly open the supplier's web page.
* **Mobile Considerations:** Ensure the "SKU" text input relies on standard alphanumeric keyboards. Links out to suppliers must be handed off to the mobile OS so they open in the user's default browser (e.g., Chrome/Safari) rather than hijacking the app's webview.

## 3. Technical Implementation
* **Frontend (SolidJS / Tauri):** * A list/card component showing the sourcing options for a part.
    * A form component that makes a `fetch` call to `GET /api/suppliers` to populate the vendor dropdown.
    * **Tauri Specifics:** Must utilize the `@tauri-apps/plugin-shell` API (specifically the `open` function) to safely launch external URLs in the operating system's default browser.
* **Backend (FastAPI):** * `GET /api/parts/{part_id}/products` - Returns the list of external sources mapped to this part.
    * `POST /api/products` - Creates a new part-to-supplier mapping (validates both `part_id` and `supplier_id` exist).
    * `PUT /api/products/{id}` - Updates the SKU or URL.
    * `DELETE /api/products/{id}` - Removes the sourcing link.
* **Database Schema (SQLite / Peewee):** * Model: `Product`
    * Columns: `id` (PK), `created_on`, `modified_on`, `part_id` (FK to Parts), `supplier_id` (FK to Suppliers), `sku` (VARCHAR 100), `url` (VARCHAR 255).

## 4. Out of Scope
* Live API integrations with vendors (e.g., Mouser, DigiKey) for real-time pricing and stock levels. This phase relies on static, user-entered data and links.
* Automated PO (Purchase Order) or cart generation.

---

## 5. Implementation Tasks
- [x] Define `Product` Peewee model with dual foreign keys (`part_id`, `supplier_id`).
- [x] Build FastAPI CRUD routes.
- [x] Create SolidJS UI for listing supplier sources on the Part detail page.
- [x] Create SolidJS form for adding a new source, wiring up the Supplier dropdown.
- [x] Install and implement Tauri `shell.open` for external links.
- [x] Wire frontend to backend API.