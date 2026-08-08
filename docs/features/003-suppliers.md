---
title: Core Suppliers
status: Draft
target: 
  - Web
  - Windows
  - Android
dependencies: []
---

# Feature: Core Suppliers

## 1. Overview
This feature establishes the foundational `Suppliers` entity. It allows users to maintain a directory of external vendors, manufacturers, or local stores where inventory is sourced. By storing baseline website and search URL templates, this feature paves the way for one-click external part lookups later in the application's lifecycle.

## 2. User Experience & UI
* **Trigger:** Accessed via a "Suppliers" or "Vendors" button in the primary settings or navigation sidebar.
* **Interaction:** 1. The user views a grid or list of existing suppliers.
    2. The user taps/clicks "New Supplier".
    3. A form requests the supplier's `name`, their base `website` URL, and a `search` URL template (e.g., `https://www.supplier.com/search?q={part_number}`).
    4. Upon saving, the new supplier appears in the directory.
* **Mobile Considerations:** Use a card-based UI for the list to ensure touch-friendly interaction. Text inputs for URLs should trigger the mobile OS's URL-optimized keyboard (e.g., using `type="url"` in the HTML input).

## 3. Technical Implementation
* **Frontend (SolidJS / Tauri):** * A list/card component to display the directory.
    * A modal or dedicated page with a form for creating and editing suppliers.
    * Basic client-side URL validation before submission.
* **Backend (FastAPI):** * `GET /api/suppliers` - Returns the directory of suppliers.
    * `GET /api/suppliers/{id}` - Returns details for a single supplier.
    * `POST /api/suppliers` - Creates a new supplier.
    * `PUT /api/suppliers/{id}` - Updates a supplier's details.
    * `DELETE /api/suppliers/{id}` - Removes a supplier. *(Note: Must handle cascade logic or block deletion if the supplier is actively linked to existing products).*
* **Database Schema (SQLite / Peewee):** * Model: `Supplier`
    * Columns: `id` (PK), `created_on`, `modified_on`, `name` (VARCHAR 40), `website` (VARCHAR 100), `search` (VARCHAR 200).

## 4. Out of Scope
* Web-scraping live prices or inventory counts from these supplier websites.
* Creating the specific Part-to-Supplier links (that will be handled later in `008-supplier-products.md`).

---

## 5. Implementation Tasks
- [ ] Define `Supplier` Peewee model.
- [ ] Build FastAPI CRUD routes (`GET`, `POST`, `PUT`, `DELETE`).
- [ ] Create SolidJS UI list/card component.
- [ ] Create SolidJS form for creating/editing suppliers with URL validation.
- [ ] Wire frontend to backend API.