---
title: Android Camera Barcode Scanner Integration
status: Complete
target: 
  - Android
dependencies: 
  - 010-inventory-storage.md
  - 013-barcode-scanning.md
  - 014-deep-link-routing.md
---

# Feature: Android Camera Barcode Scanner Integration

## 1. Overview
This feature provides native camera-based barcode scanning for Sidekick on Android mobile devices. Utilizing the Android device camera, Sidekick scans and decodes 2D DataMatrix codes and 1D Code-128 linear barcodes on physical Storage Bins, reels, and component bags. The camera engine operates via native Android camera APIs (using `@tauri-apps/plugin-barcode-scanner` or ML Kit), providing high-speed scanning and automatic resolution against Sidekick's deep-link engine.

For desktop WinUSB barcode scanning specifications on Windows PCs, see [`043-desktop-usb-barcode-scanner.md`](043-desktop-usb-barcode-scanner.md). For shared resolution architecture, see [`013-barcode-scanning.md`](013-barcode-scanning.md).

## 2. User Experience & UI
* **Trigger:** Accessible on mobile devices via the global "Scan" Floating Action Button (FAB) or dedicated **Scan** tab (`/scan`).
* **Camera Scanning View:**
  * Opens a full-screen camera preview with a darkened outer overlay and a glowing central target reticle.
  * **Controls:** Includes a Flashlight/Torch toggle button, Camera Flip button (rear vs front), and a Close/Cancel button.
  * **Auto-Close:** Upon detecting a valid barcode, the camera preview immediately pauses, closes the overlay, and chimes the success tone.
* **Android Permission Management:** Automatically prompts the user for Android `CAMERA` permission if not already granted. Provides a clear inline explanation if permission was previously denied.
* **Scan Resolution:** Decoded barcode payloads (e.g. `fuse://location/{id}` or raw UUIDs) are passed directly to Sidekick's core resolver (`013-barcode-scanning.md`), automatically navigating the user to the target Location or Part view.

## 3. Technical Implementation
* **Tauri Android Plugin (`@tauri-apps/plugin-barcode-scanner`):**
  * Integrates Tauri's official Android barcode scanner plugin for native ML Kit / ZXing camera hardware decoding.
  * Configures target formats: `DataMatrix`, `Code128`, `QrCode`.
* **Frontend Mobile Camera Service (`client/src/services/cameraScannerService.ts`):**
  * Manages Android camera permission checks (`checkPermissions()`, `requestPermissions()`).
  * Triggers scanner preview (`scan({ formats: [Format.DataMatrix, Format.Code128] })`).
  * Emits scan results into `usbScannerService` / deep link routing handlers.
* **SolidJS UI Component (`client/src/components/CameraScanModal.tsx`):**
  * Full-screen mobile overlay rendered when camera scanning is triggered.
  * Displays scanning reticle animations and torch toggle.

## 4. Out of Scope
* Windows Desktop raw WinUSB scanner polling (handled in `043-desktop-usb-barcode-scanner.md`).
* Optical Character Recognition (OCR) to read text labels.
* External manufacturer UPC price scraping.

---

## 5. Implementation Tasks
- [x] Add `@tauri-apps/plugin-barcode-scanner` dependency to `package.json` and `src-tauri/Cargo.toml`.
- [x] Register barcode scanner plugin in `src-tauri/src/lib.rs` and configure Android permissions in `src-tauri/gen/android`.
- [x] Create `cameraScannerService.ts` wrapper for Android camera permissions and scanner execution.
- [x] Build `CameraScanModal.tsx` mobile camera view with reticle overlay and torch controls.
- [x] Connect scanned camera payloads to core deep-link resolver (`/resolve/{payload}`).
- [x] Verify DataMatrix and Code-128 barcode scanning on Android device / emulator.
