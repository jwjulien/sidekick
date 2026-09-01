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
This feature provides native camera-based barcode scanning for Sidekick on Android mobile devices. Utilizing the Android device camera, Sidekick scans and decodes 2D DataMatrix codes and QR codes on physical Storage Bins, reels, and component bags. Legacy 1D Code-128 linear barcodes are omitted in favor of DataMatrix UUID deep links. The camera engine operates via high-resolution video streams (`1920x1080 ideal`) and multi-rotation ZXing/Tauri decoding with auto-orientation awareness, providing high-speed scanning and automatic resolution against Sidekick's deep-link engine.

For desktop WinUSB barcode scanning specifications on Windows PCs, see [`043-desktop-usb-barcode-scanner.md`](043-desktop-usb-barcode-scanner.md). For shared resolution architecture, see [`013-barcode-scanning.md`](013-barcode-scanning.md).

## 2. User Experience & UI
* **Trigger:** Accessible on mobile devices via the global "Scan" Floating Action Button (FAB) or dedicated **Scan** tab (`/scan`).
* **Camera Scanning View:**
  * Opens a full-screen camera preview with a darkened outer overlay and a compact central target reticle (`w-[75vw] max-w-[260px] h-[170px]`) tailored specifically for small 0.5" DataMatrix labels.
  * **Aiming Crosshairs & Reticle:** Features a centered glowing target indicator and laser scan line animation to simplify alignment on small parts and component reels.
  * **Orientation Awareness:** Live orientation detection badge ("Portrait Mode (Auto-Oriented)" vs "Landscape Mode") updates seamlessly on phone rotation.
  * **Controls:** Includes a Flashlight/Torch toggle button and a Close/Cancel button.
  * **Auto-Close:** Upon detecting a valid DataMatrix payload, the camera preview immediately pauses, closes the overlay, and chimes the success tone.
* **Android Permission Management:** Automatically prompts the user for Android `CAMERA` permission if not already granted. Provides a clear inline explanation if permission was previously denied.
* **Scan Resolution:** Decoded barcode payloads (e.g. `fuse://location/{id}` or raw UUIDs) are passed directly to Sidekick's core resolver (`013-barcode-scanning.md`), automatically navigating the user to the target Location or Part view.

## 3. Technical Implementation
* **Tauri Android Plugin (`@tauri-apps/plugin-barcode-scanner`):**
  * Integrates Tauri's official Android barcode scanner plugin for native ML Kit / ZXing camera hardware decoding.
  * Configures target formats: `DataMatrix`, `QrCode`.
* **Frontend Mobile Camera Service (`client/src/services/cameraScannerService.ts`):**
  * Manages Android camera permission checks (`checkPermissions()`, `requestPermissions()`).
  * Passes `hints` Map to `BrowserMultiFormatReader` with `DecodeHintType.TRY_HARDER` enabled for 90° rotated matrix passes, enabling instant decoding when held in portrait orientation.
  * Configures high-resolution video stream constraints (`1920x1080 ideal`).
  * Emits scan results into `usbScannerService` / deep link routing handlers.
* **SolidJS UI Component (`client/src/components/CameraScanModal.tsx`):**
  * Full-screen mobile overlay rendered when camera scanning is triggered.
  * Displays compact reticle animations, center crosshairs, orientation badges, and torch controls.

## 4. Out of Scope
* Windows Desktop raw WinUSB scanner polling (handled in `043-desktop-usb-barcode-scanner.md`).
* Optical Character Recognition (OCR) to read text labels.
* External manufacturer UPC price scraping.

---

## 5. Implementation Tasks
- [x] Add `@tauri-apps/plugin-barcode-scanner` dependency to `package.json` and `src-tauri/Cargo.toml`.
- [x] Register barcode scanner plugin in `src-tauri/src/lib.rs` and configure Android permissions in `src-tauri/gen/android`.
- [x] Create `cameraScannerService.ts` wrapper for Android camera permissions, `TRY_HARDER` orientation hints, and scanner execution.
- [x] Build `CameraScanModal.tsx` mobile camera view with compact DataMatrix reticle overlay, center crosshair, orientation badges, and torch controls.
- [x] Connect scanned camera payloads to core deep-link resolver (`/resolve/{payload}`).
- [x] Verify DataMatrix barcode scanning in portrait and landscape orientations on Android device / emulator.
