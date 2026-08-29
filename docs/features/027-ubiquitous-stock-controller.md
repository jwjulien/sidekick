---
title: Ubiquitous Stock Controller Component
status: Draft
target: 
  - Web
  - Windows
  - Android
dependencies: 
  - 010-inventory-storage.md
  - 016-bluetooth-scale-integration.md
  - 017-part-weight-calibration.md
---

# Feature: Ubiquitous Stock Controller Component

## 1. Overview
To minimize the friction of physical inventory auditing, Sidekick utilizes a concept of "Opportunistic Cycle Counting." Any time a Storage Location's part count is rendered in the UI (e.g., in a Part Detail view, a Search result, or after a Barcode Scan), it is never rendered as static text. Instead, it is rendered via the `Ubiquitous Stock Controller`—a shared SolidJS component that instantly allows the user to adjust the count, confirm the existing count, or utilize a Bluetooth scale, automatically updating the location's `last_counted` timestamp to `NOW`.

*(Note: For aggregated multi-location stock control in tables and custom part lists, see `034-multi-location-stock-controller.md`).*

## 2. User Experience & UI
* **Trigger:** Appears implicitly wherever a `Storage.quantity` is displayed in the UI.
* **Interaction (Confirming):** 1. The component displays the current expected quantity (e.g., "Qty: 150").
    2. Beside it is a low-friction `[✓ Confirm]` button. 
    3. Clicking it triggers a subtle green flash and updates the `last_counted` timestamp in the database to the current exact time, leaving the quantity unchanged.
* **Interaction (Adjusting - Manual):**
    1. The user taps the number itself, turning it into an active input field, or uses adjacent `+` and `-` buttons.
    2. Upon changing the value, a `[Save]` button appears. Clicking it updates the quantity and sets `last_counted` to `NOW`.
* **Interaction (Adjusting - Scale):**
    1. If a Bluetooth scale is actively connected, a small "Scale" icon appears in the component.
    2. The user puts the parts on the scale. 
    3. The component reads the live weight, divides it by the known `Part.weight`, and displays the projected count (e.g., "⚖️ 152 projected").
    4. The user clicks `[Accept Scale Count]`, updating the quantity and setting `last_counted` to `NOW`.
    5. *(Note: If the `Part.weight` is NULL, clicking the scale icon temporarily opens the Calibration Wizard from Feature 017).*

## 3. Technical Implementation
* **Frontend (SolidJS / Tauri):** * A globally shared component: `<StockController storageId={location.id} currentQty={location.quantity} partWeight={part.weight} />`.
    * Local debouncing to prevent spamming the backend if the user clicks the `+` button 10 times in a row.
    * Hooks into the global `ScaleProvider` context to passively listen for stable weight readings.
* **Backend (FastAPI):** * `PUT /api/storage/{id}/touch` - A lightning-fast, dedicated endpoint that *only* updates the `last_counted` timestamp to `CURRENT_TIMESTAMP`.
    * `PUT /api/storage/{id}/count` - Updates both the `quantity` and sets `last_counted` to `CURRENT_TIMESTAMP`.

## 4. Out of Scope
* Forcing the user to enter a "Reason for Adjustment" (e.g., Shrinkage, Damaged) when changing the count. Friction must remain absolute zero.

---

## 5. Implementation Tasks
- [ ] Build FastAPI `/touch` endpoint.
- [ ] Create SolidJS `<StockController />` component.
- [ ] Wire the `[✓ Confirm]` button to the `/touch` endpoint.
- [ ] Integrate global Scale Context to project counts based on live weight.
- [ ] Audit all existing UI views (Triage, Part Detail, Scanner Result) to replace static quantity text with this new component.