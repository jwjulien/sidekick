---
title: Cycle Counting & Inventory Audit
status: Completed
target: 
  - Web
  - Windows
  - Android
dependencies: 
  - 010-inventory-storage.md
  - 017-part-weight-calibration.md
---

# Feature: Cycle Counting & Inventory Audit

## 1. Overview
This feature provides an automated, physically optimized workflow for verifying stale inventory. By querying the database for `Storage` locations that haven't been touched in a specified timeframe (e.g., > 365 days), Sidekick generates an Audit Route. The route acts as a pseudo-Traveling Salesman solver by sorting locations based on their hierarchical lineage, ensuring the user verifies sibling bins together without walking back and forth across the shop.

## 2. User Experience & UI
* **Trigger:** An "Audit" or "Cycle Count" tab in the main navigation, displaying a badge with the number of stale locations.
* **Interaction:** 1. The user starts an audit and selects a threshold (e.g., "Not counted in 6 months").
    2. The app calculates the route and presents a full-screen, step-by-step wizard.
    3. The screen boldly displays the current location (e.g., "Rack 1 > Drawer B > Bin 4") and the expected Part.
    4. **Counting Methods:**
        * **Quick Taps:** Large `+` and `-` buttons in predefined increments (`1`, `5`, `10`, `25`, `100`) for rapid adjustments.
        * **Manual:** A standard number input field.
        * **By Weight:** If the Bluetooth scale is connected, it displays the live count based on weight. If the current Part has a `NULL` weight, the "Count by Weight" button transforms into a "Calibrate Weight" button, temporarily hijacking the UI to run the wizard defined in Feature `017` before returning to the audit.
    5. The user clicks "Confirm & Next". The app logs the new quantity, updates the `last_counted` timestamp to `now()`, and smoothly transitions to the next bin on the route.
* **Mobile Considerations:** This is heavily optimized for a mobile/tablet user standing in the shop. The UI must be distraction-free (hide global sidebars). The Quick Tap increment buttons must be large, highly separated touch targets to prevent fat-fingering while wearing workshop gloves.

## 3. Technical Implementation
* **Frontend (SolidJS / Tauri):** * A carousel or wizard-state component that holds the array of `pending_audits` and tracks the `currentIndex`.
    * Logic to intercept a `scale` event if the part lacks a defined `unit_weight`, invoking the `PartWeightCalibrationModal` as a blocking overlay.
* **Backend (FastAPI):** * `GET /api/storage/audit?days_stale=180` - Queries the `Storage` table for records where `last_counted < (CURRENT_DATE - days_stale)`. 
    * **Routing Algorithm:** The backend utilizes a Recursive CTE (Common Table Expression) in SQLite to dynamically build the full hierarchical path string for each location (e.g., `Rack_A/Drawer_2/Bin_5`), and then simply applies an `ORDER BY path ASC` to physically group sibling containers.
    * `PUT /api/storage/{id}/count` - Updates the `quantity` and hard-sets `last_counted = CURRENT_TIMESTAMP`.
* **Database Schema (SQLite / Peewee):** * Assumes the `Storage` model already possesses the `last_counted` (DATETIME) column. No schema changes strictly required.

## 4. Out of Scope
* Calculating true 3D spatial distances for the routing (hierarchical alphabetical sorting is O(n log n) and provides 95% of the physical efficiency with 1% of the math).
* Enforcing "blind" counts (where the UI hides the expected quantity to force the user to actually count, rather than just hitting 'Confirm'). The expected count will be shown to assist the user.

---

## 5. Implementation Tasks
- [x] Write SQLite Recursive CTE query in FastAPI to fetch and path-sort stale storage locations.
- [x] Build FastAPI `PUT` route for updating the count and timestamp.
- [x] Create SolidJS full-screen Audit Wizard component.
- [x] Build the mobile-friendly Quick Tap (`+/- 25`, `+/- 100`) incrementer UI.
- [x] Wire the scale integration, including the conditional redirect to the Calibration Wizard (`017`).
- [x] Wire frontend progression logic ("Confirm & Next").