---
title: Scale Inventory Reconciliation
status: Complete
target: 
  - Web
  - Windows
  - Android
dependencies: 
  - 004-core-parts.md
  - 010-inventory-storage.md
  - 016-bluetooth-scale-integration.md
  - 017-part-weight-calibration.md
  - 018-container-tare-offsets.md
---

# Feature: Scale Inventory Reconciliation

## 1. Overview
This feature combines live scale readings, software/container tare offsets, and single-unit part weights into a rapid stock reconciliation tool. Users can place a full bin of components onto the scale, and Sidekick will automatically subtract the bin's tare weight, divide the remaining net weight by the part's unit weight, compute the exact quantity, and update the inventory ledger. It seamlessly intercepts the workflow to force a calibration routine if the part's unit weight is currently unknown.

## 2. User Experience & UI
* **Trigger:** "Weigh & Count Stock" button in the Storage detail view or during a stock-take workflow.
* **Interaction (Calibration Intercept):**
    1. If the selected Part has a `NULL` unit weight, the standard counting UI is hidden. The user is presented with a "Calibration Required" prompt.
    2. The user is guided through the `017` Calibration Wizard directly within this view: they tare the scale, select a sample size (e.g., 10), place the sample, wait for the scale to stabilize, and confirm the computed per-piece weight.
    3. Upon confirmation, the `Part.weight` is saved, and the UI immediately transitions to the Standard Counting Interaction.
* **Interaction (Standard Counting):**
    1. The Reconciliation view displays:
        * **Gross Weight:** Live scale reading.
        * **Tare Weight:** Pre-populated from `Storage.tare_weight` (adjustable).
        * **Net Material Weight:** `Gross - Tare`.
        * **Unit Weight:** Pre-populated from `Part.weight`. *(Includes a secondary "Recalibrate Weight" button to manually trigger the calibration wizard if the user suspects the stored weight is inaccurate).*
        * **Calculated Quantity:** `floor(Net Weight / Unit Weight)`.
    2. Once the scale reading stabilizes (`stable == true`), the "Commit Quantity" button highlights.
    3. `+` and `-` buttons to allow manual tuning of the computed value also become active.
    4. Clicking "Commit Quantity" submits the new total directly to `/api/locations/{location_id}/count`.
* **Mobile Considerations:** Display the calculated quantity in extra-large typography (e.g., 36pt font) so it is easily read from a distance at the workbench.

## 3. Technical Implementation
* **Frontend (SolidJS / Tauri):**
    * Uses conditionally rendered components to swap between `<ScaleModal />` reconciliation view and `<PartWeightCalibrationModal />` based on `Part.weight == null` or if the user clicks the "Re-calibrate" button.
    * Reactively combines signals:
      $$\text{Net Weight} = \text{Scale Gross Weight} - \text{Container Tare}$$
      $$\text{Estimated Count} = \left\lfloor \frac{\text{Net Weight}}{\text{Part Unit Weight}} \right\rfloor$$
    * Validates that both `Part.weight > 0`, `Net Weight >= 0`, and `scale.isStable() == true` before enabling the commit button.
* **Backend (FastAPI):**
    * Uses `PUT /api/locations/{id}/count` endpoint to update the storage location stock quantity and stamp `last_counted`.

## 4. Out of Scope
* Automatic discrepancy logging/historical audit logging (the new count simply overwrites or adjusts the current stock value).

---

## 5. Implementation Tasks
- [x] Create SolidJS `ScaleModal.tsx` reconciliation view component.
- [x] Implement conditional rendering/routing to embed the `017` Calibration Wizard if `Part.weight` is missing.
- [x] Add the "Re-calibrate Weight" button to the standard counting view to trigger the wizard manually.
- [x] Connect reactive calculation pipeline (Gross, Tare, Net, Unit Weight, Calculated Count).
- [x] Add visual stability indicator based on `ScaleProvider.isStable()`.
- [x] Wire the final commit button to the backend location count update endpoint (`PUT /api/locations/{id}/count`).