---
title: Bluetooth Scale Integration
status: In Progress
target: 
  - Web
  - Windows
  - Android
dependencies: 
  - 004-core-parts.md
  - 010-inventory-storage.md
---

# Feature: Bluetooth Scale Integration

## 1. Overview
This feature integrates off-the-shelf Bluetooth Low Energy (BLE) kitchen/postal scales (e.g., Etekcity) directly into Sidekick. By reading real-time GATT characteristic notifications, the application streams live weight data to the UI. Combined with a Part's per-piece weight attribute, Sidekick calculates bulk inventory counts (e.g., weighing a bin of 500 screws instead of manual counting) and updates location stock quantities instantly.

## 2. User Experience & UI Workflow

### Trigger
* A new **Scale / Weight** button (icon: `Scale`) is located on the storage location card header in `PartDetails.tsx` (positioned between the **Move** and **Print** buttons).

### Modal Multi-Step State Machine

1. **Step 1: Device Connection**
   * Clicking the Scale button launches the `ScaleModal`.
   * Displays a searching indicator ("Searching for compatible scale devices...").
   * Triggers Web Bluetooth API (`navigator.bluetooth`) device selection / GATT connection.
   * Includes a Developer/Simulator toggle mode for testing in desktop browsers without physical scale hardware.

2. **Step 2: Calibration Check & Branching**
   * Checks `part.weight` (per-piece weight in grams/oz) from the database:
     * **If `part.weight` is NOT null:** Skips calibration phase and proceeds directly to **Step 4: Measurement / Counting Stage**.
     * **If `part.weight` IS null:** Automatically enters **Step 3: Calibration Stage**.

3. **Step 3: Calibration Stage**
   * Displays the live scale weight reading and a **Tare** button to zero out container/ambient weight.
   * User places a known integer quantity of parts on the scale.
   * User specifies the count using an adjustable quantity control featuring `+/- 1` and `+/- 10` buttons or direct numeric input.
   * Clicking **Confirm Calibration**:
     * Calculates per-piece weight: `per_piece_weight = scale_weight / part_count`.
     * Persists updated `weight` to backend DB via `PUT /api/parts/{part_id}`.
     * Advances automatically to **Step 4: Measurement / Counting Stage**.

4. **Step 4: Measurement / Counting Stage**
   * Displays live scale weight, active tare status, configured per-piece weight, and computed part count (`Math.round(live_weight / per_piece_weight)`).
   * Provides a **Re-calibrate Weight** option to return to Step 3 if re-zeroing or recalibrating is required.
   * Clicking **Update Count**:
     * Sets the exact part quantity for the selected storage location via `PUT /api/locations/{location_id}/count`.
     * Closes the modal and updates `PartDetails` storage records in real time.

---

## 3. Technical Implementation

* **Frontend (`client` / SolidJS):**
  * `ScaleContext` / `ScaleProvider`: Global SolidJS context providing scale connection state (`connecting`, `connected`, `disconnected`), live `weight`, `units`, `isStable`, `tare()`, `connect()`, and `mockMode` controls.
  * GATT Notification Engine: Listens to characteristic `0000FFF1-0000-1000-8000-00805F9B34FB`. Parses 15-byte notification payloads:
    * Weight payload shifting: `(data[11] + (data[12] << 8))`
    * Scale factors (`0.1` for g/ml, `0.01` for oz) & sign inversion handling.
    * Stability flag evaluation (`data[15]`).
  * `ScaleModal.tsx`: Component managing the modal UI state machine (Connect -> Calibration -> Counting -> Commit).
  * `PartDetails.tsx`: Added Scale button between Move and Print buttons in location card headers.

* **Backend (`server` / FastAPI):**
  * `PUT /api/parts/{part_id}` (updates `Part.weight`).
  * `PUT /api/locations/{location_id}/count` (updates `Storage.quantity` and stamps `last_counted`).

---

## 4. Out of Scope
* Reverse-engineering encrypted BLE protocols for proprietary commercial scales.
* Multi-scale simultaneous connections (single scale active per session).

---

## 5. Implementation Tasks
- [x] Implement `ScaleContext.tsx` with Web Bluetooth GATT subscriber & dev simulator mode.
- [x] Create `ScaleModal.tsx` multi-step state machine (Connect -> Calibration -> Measurement).
- [x] Add Scale button to `PartDetails.tsx` location card headers (single & multi-location drill down).
- [x] Integrate API calls (`PUT /api/parts/{id}` for weight, `PUT /api/locations/{id}/count` for inventory update).
- [ ] Add unit tests for GATT payload parser and scale math helpers.