---
title: Bluetooth Scale Integration
status: Draft
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
This feature integrates off-the-shelf Bluetooth Low Energy (BLE) kitchen/postal scales (e.g., Etekcity) directly into the Sidekick environment. By reading real-time GATT characteristic notifications, the app can stream live weight data to the UI. When combined with a Part's known unit weight, Sidekick can instantly calculate bulk inventory counts (e.g., weighing a bin of 500 screws instead of counting them manually).

## 2. User Experience & UI
* **Trigger:** Accessed via a "Connect Scale" button located in the Inventory Storage adjustment view or a global hardware settings menu.
* **Interaction:** 1. The user clicks "Connect Scale", triggering the native OS Bluetooth pairing prompt.
    2. Once connected, a persistent "Scale" widget appears in the UI showing the live `weight`, current `units` (oz, g, ml), and a `stable` status indicator.
    3. **Counting Mode:** If the user is viewing a specific Part that has a `weight` attribute defined, the UI automatically divides the live scale weight by the unit weight to display a real-time "Estimated Count".
    4. The user clicks "Commit Count" to instantly update the database via the `/api/storage/{id}/adjust` endpoint.
* **Mobile Considerations:** The pairing prompt is handled natively by Android's Chrome webview. The live weight widget should be large, high-contrast, and easily readable from a distance while standing at the workbench.

## 3. Technical Implementation
* **Frontend (SolidJS / Tauri):** * A global `ScaleProvider` Context component to maintain the BLE connection state across route changes.
    * Utilizes Web Bluetooth API (`@mnlphlp/plugin-blec` or native `navigator.bluetooth`).
    * **Data Parsing Engine:** Subscribes to GATT `CHAR_NOTIFY` (`0000FFF1-0000-1000-8000-00805F9B34FB`). Parses the 15+ byte array payload:
        * Identifies `units` (Byte 13) and `liquid` mode (Byte 14).
        * Calculates raw weight using bitwise shifting on Bytes 11 & 12 `(data[11] + (data[12] << 8))`.
        * Applies scaling factors (`0.1` for Grams/ml, `0.01` for Ounces) and sign inversion (Byte 10).
        * Freezes the UI value when the `stable` flag (Byte 15) resolves to true.
* **Backend (FastAPI):** * No backend changes required for the hardware connection; the scale communicates entirely client-to-client.

## 4. Out of Scope
* Reverse-engineering encrypted BLE protocols for proprietary commercial scales. This phase assumes standard, unencrypted GATT notification broadcasts.
* Multi-scale simultaneous connections (only one scale is actively paired at a time).

---

## 5. Implementation Tasks
- [ ] Integrate `ScaleProvider.tsx` into the root SolidJS application tree.
- [ ] Build a floating/docked UI component to display live weight and stability status.
- [ ] Create the "Counting Mode" UI math logic inside the Storage Adjustment modal.
- [ ] Wire the final stable reading to the FastAPI stock adjustment endpoint.