---
title: Universal Barcode Scanning
status: In Progress
target: 
  - Web
  - Windows
  - Android
dependencies: 
  - 010-inventory-storage.md
  - 011-storage-labels.md
---

# Feature: Universal Barcode Scanning

## 1. Overview
This feature provides camera-based barcode scanning for Sidekick on mobile and cross-platform clients, allowing users to rapidly pull up a specific physical Storage Location or Part by scanning its label. The camera engine decodes both legacy CODE-128 linear barcodes and modern DataMatrix squares using the device camera. (Note: Desktop-specific raw USB background scanner integration using WinUSB drivers is specified separately in `043-desktop-usb-barcode-scanner.md`).

## 2. User Experience & UI
* **Trigger:** A global "Scan" Floating Action Button (FAB) or header icon, always accessible regardless of what screen the user is on.
* **Interaction (Mobile Camera):** Tapping the scan button on a mobile device opens a full-screen camera view with a darkened overlay and a clear scanning reticle in the center. The camera auto-closes upon a successful read.
* **Interaction (Desktop WinUSB Scanner):** Handled as a dedicated background worker service on Windows desktop clients—see `043-desktop-usb-barcode-scanner.md`.
* **Resolution:** Upon any successful scan, the app emits a short success "beep", queries `/api/resolve/{payload}` for the UUID, and automatically navigates the user to that Location or Part detail view.

## 3. Technical Implementation
* **Frontend (SolidJS / Tauri):** 
    * **Camera (`html5-qrcode` or `zxing-js`):** Utilizes standard web APIs (`navigator.mediaDevices.getUserMedia`) to feed a video stream to a JS-based decoder capable of reading both DataMatrix and Code-128.
* **Backend (FastAPI):** 
    * `GET /api/resolve/{scanned_payload}` - A dedicated routing endpoint. It checks the payload against the `Storage` and `Parts` tables and returns the entity type and ID so the frontend can redirect the router.

## 4. Out of Scope
* BLE (Bluetooth Low Energy) handheld barcode scanners (deferred until physical hardware is available for testing).
* Using the camera for OCR (Optical Character Recognition) to read human text.
* Desktop raw WinUSB / PyUSB background scanner worker thread (handled in `043-desktop-usb-barcode-scanner.md`).
* Scanning external manufacturer barcodes (e.g., a UPC on a DigiKey bag) to scrape the web for part data. This feature strictly resolves internal Sidekick UUIDs.

---

## 5. Implementation Tasks
- [ ] Install and configure a JS-based barcode decoder (e.g., ZXing) for the camera view.
- [ ] Build the FastAPI `/api/resolve` endpoint.
- [ ] Wire up audio feedback (success beep) using standard HTML5 Audio.