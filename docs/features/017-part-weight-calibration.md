---
title: Part Weight Calibration Wizard
status: Draft
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
This feature provides a step-by-step wizard to determine and save a Part's single-unit weight (`Part.weight`). Because individual electronic/hardware components are often too light to weigh accurately individually, the wizard allows users to weigh a batch of parts (e.g., 10, 25, or an arbitrary number) and automatically computes `unit_weight = total_weight / sample_count`.

## 2. User Experience & UI
* **Trigger:** Accessed via a "Calibrate Weight" button next to the `weight` field on any Part detail page or part creation/edit form.
* **Interaction:**
    1. A wizard modal opens, prompting the user to ensure the scale is empty and zeroed.
    2. The user selects a sample count from preset buttons (`1`, `2`, `3`, `5`, `10`, `15`, `25`) or enters an arbitrary integer into a text input.
    3. The user places the specified sample quantity on the scale.
    4. The UI displays the live total weight. Once the scale signals a `stable` reading, a "Calculate & Save" button becomes active.
    5. Clicking "Calculate & Save" divides the total weight by the sample count, updates the `Part.weight` field via `PUT /api/parts/{id}`, and closes the wizard.
* **Mobile Considerations:** Sample size quick-selection buttons should be large pill-style targets (at least 48x48px). The numerical entry input must use `inputmode="numeric"`.

## 3. Technical Implementation
* **Frontend (SolidJS / Tauri):**
    * Subscribes to the live `weight` and `stable` signals provided by `ScaleProvider`.
    * Implements internal wizard state (`step`, `sampleCount`, `calculatedUnitWeight`).
    * Computes unit weight using floating-point precision: `calculatedUnitWeight = liveWeight() / sampleCount()`.
* **Backend (FastAPI):**
    * Uses existing `PUT /api/parts/{id}` route to persist the computed `weight` float to SQLite.

## 4. Out of Scope
* Automatic statistical outlier rejection or multi-sample variance analysis.

---

## 5. Implementation Tasks
- [ ] Create SolidJS `PartWeightCalibrationModal` component.
- [ ] Build UI controls for sample presets (1, 2, 3, 5, 10, 15, 25) and custom number input.
- [ ] Wire live scale readings (`weight()`, `stable()`) to the calculation preview.
- [ ] Connect save action to update `Part.weight` via FastAPI.