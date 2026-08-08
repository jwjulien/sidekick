---
title: Core Parts
status: Draft
target: 
  - Web
  - Windows
  - Android
dependencies: 
  - 001-categories.md
---

# Feature: Core Parts

## 1. Overview
This feature represents the absolute center of the Sidekick architecture. It defines the core attributes of a physical component—such as its internal part number, package type, baseline price, and minimum stock threshold. It implements a dynamic Key/Value system to store arbitrary, component-specific data (e.g., "Tolerance: 1%", "Thread Pitch: M3"), and includes an advanced query engine to filter the master inventory list based on these dynamic attributes.

## 2. User Experience & UI
* **Trigger:** Accessed via the primary "Inventory" or "Parts" button in the main navigation.
* **Interaction:** 1. The user views a data grid (desktop) or card list (mobile) of all parts.
    2. **Advanced Filtering:** Above the list, users can click "Add Filter". They can select an attribute key from a dynamically populated dropdown of existing keys (e.g., "Voltage"), select an operator (e.g., "Equals", "Contains"), and input a value (e.g., "50V"). The list updates instantly to show matching parts.
    3. The user clicks "New Part".
    4. A comprehensive form opens requesting standard fields: `value`, `number`, `package`, `price`, `weight`, `threshold`, and `notes`.
    5. **Dynamic Attributes:** The form includes a "Custom Attributes" section. Users can click "Add Attribute" to spawn a new Key/Value input row.
    6. The form includes a dropdown menu to assign the part to an existing Category.
    7. Upon saving, the part is assigned a unique ID and appears in the master list.
* **Mobile Considerations:** The part creation form is data-heavy and should be broken down into collapsible accordion sections. The Advanced Filter builder should open in a bottom-sheet modal rather than cluttering the top of the list view.

## 3. Technical Implementation
* **Frontend (SolidJS / Tauri):** * A robust data grid/table component for the master list.
    * An advanced query builder UI that constructs a structured filter object to send via the API (e.g., `?attr_Voltage=50V` or a URL-encoded JSON query).
    * State management to handle a dynamic array of `{key: string, value: string}` objects for the creation form, serialized into JSON before submission.
* **Backend (FastAPI):** * `GET /api/parts` - Returns a list of parts. **Crucially, it must parse dynamic query parameters and utilize SQLite's `json_extract()` function (via Peewee's `fn.json_extract` or playhouse extensions) to filter against the `attributes` column natively in the database.**
    * `GET /api/parts/{id}` - Returns specific details, deserializing the `attributes` BLOB back into JSON.
    * `POST /api/parts` - Creates a new part, serializing the incoming JSON attributes into bytes for the SQLite BLOB.
    * `PUT /api/parts/{id}` - Updates a part's details.
    * `DELETE /api/parts/{id}` - Removes a part.
* **Database Schema (SQLite / Peewee):** * Model: `Part`
    * Columns: `id` (PK), `created_on`, `modified_on`, `category_id` (FK to Categories), `value` (VARCHAR 50), `number` (VARCHAR 50), `package` (VARCHAR 20), `price` (REAL), `weight` (REAL), `threshold` (INTEGER), `notes` (TEXT), `attributes` (BLOB storing serialized JSON).

## 4. Out of Scope
* Defining where the part is physically stored or how many you currently have (handled in `010-inventory-storage.md`).
* Attaching datasheets or images (handled in `006-part-documents.md` and `007-part-images.md`).
* Linking this part to an external manufacturer or supplier URL (handled in `008-supplier-products.md`).
* Adding this part to a specific project BOM (handled in `009-materials-bom.md`).

---

## 5. Implementation Tasks
- [ ] Define `Part` Peewee model with `category_id` foreign key.
- [ ] Build FastAPI CRUD routes with JSON-to-BLOB serialization logic for `attributes`.
- [ ] Upgrade the `GET /api/parts` route to handle SQLite JSON extraction queries for dynamic filtering.
- [ ] Create SolidJS UI grid/list component for viewing parts.
- [ ] Build SolidJS Advanced Filter UI to construct dynamic API queries.
- [ ] Create SolidJS form for creating/editing parts with dynamic Key/Value builder.
- [ ] Wire frontend to backend API.