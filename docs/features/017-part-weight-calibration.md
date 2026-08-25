---
title: Part Weight Calibration Wizard
status: Complete
target: 
  - Web
  - Windows
  - Android
dependencies: 
  - 004-core-parts.md
  - 016-bluetooth-scale-integration.md
---

# Feature: Part Weight Calibration Wizard

## 1. Overview
This feature provides a step-by-step wizard to determine and save a Part's single-unit weight (`Part.weight`). Because individual electronic/hardware components are often too light to weigh accurately individually, the wizard allows users to weigh a batch of parts (e.g., 1, 10, or an arbitrary number) and automatically computes `unit_weight = total_weight / sample_count`.

## 2. User Experience & UI
* **Trigger:** Accessed via a "Calibrate Weight" button next to the `weight` field on any Part detail page or part creation/edit form.
* **Interaction:**
    1. A wizard modal opens, prompting the user to ensure the scale is empty and zeroed.
    2. The user adjusts the sample count using compact `-10`, `-1`, `+1`, `+10` step buttons optimized for small screens, or enters an integer into the text input.
    3. The user places the specified sample quantity on the scale.
    4. The UI displays live total weight and stability status (`isStable`). Once stable reading is detected and weight > 0, the "Calculate & Save" button becomes active.
    5. Clicking "Calculate & Save" divides total weight by sample count, updates `Part.weight` via `PUT /api/parts/{id}`, and closes the wizard.
* **Mobile Considerations:** Controls use compact, high-contrast touch targets with `inputmode="numeric"` to save screen real estate on mobile devices.

## 3. Technical Implementation
* **Frontend (SolidJS / Tauri):**
    * Subscribes to live `netWeight` and `isStable` signals provided by `ScaleProvider`.
    * Implements `PartWeightCalibrationModal.tsx` reusable component.
    * Computes unit weight using floating-point precision: `calculatedUnitWeight = netWeight() / sampleCount()`.
* **Backend (FastAPI):**
    * Uses existing `PUT /api/parts/{id}` route to persist the computed `weight` float.

## 4. Out of Scope
* Automatic statistical outlier rejection or multi-sample variance analysis.

---

## 5. Implementation Tasks
- [x] Create SolidJS `PartWeightCalibrationModal.tsx` component.
- [x] Build UI controls for `-10`, `-1`, `+1`, `+10` sample adjusters and custom numeric input.
- [x] Wire live scale readings (`netWeight()`, `isStable()`) to the calculation preview.
- [x] Connect save action to update `Part.weight` via FastAPI.
- [x] Add "Calibrate Weight" trigger buttons to Part details view and edit modal (`PartDetails.tsx`).
