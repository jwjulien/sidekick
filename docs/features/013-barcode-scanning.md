---
title: Universal Barcode Scanning
status: Draft
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
This feature provides the "eyes" for Sidekick, allowing users to rapidly pull up a specific physical Storage Location by scanning its label. To support both mobile workflows and desktop workbench environments, the engine supports both legacy CODE-128 linear barcodes and modern DataMatrix squares. It acts as a universal hardware bridge, capturing scans from mobile cameras, USB HID scanners, and BLE (Bluetooth Low Energy) handheld scanners.

## 2. User Experience & UI
* **Trigger:** A global "Scan" Floating Action Button (FAB) or header icon, always accessible regardless of what screen the user is on.
* **Interaction (Mobile Camera):** Tapping the scan button on a mobile device opens a full-screen camera view with a darkened overlay and a clear scanning reticle in the center. The camera auto-closes upon a successful read.
* **Interaction (USB Desktop):** Users do not need to click anything. Because USB scanners emulate keyboards, a user simply points and shoots. A global background listener catches the rapid keystrokes, intercepts the payload, and prevents the scanner from accidentally typing the UUID into an active text box.
* **Interaction (BLE Handheld):** Accessed via the Settings menu. The user clicks "Pair Bluetooth Scanner." A native browser/Tauri prompt appears to pair the device. Once paired, pressing the hardware trigger on the scanner silently fires the payload to the app in the background.
* **Resolution:** Upon any successful scan, the app emits a short success "beep", queries the database for the UUID, and automatically navigates the user to that Location's detail view.

## 3. Technical Implementation
* **Frontend (SolidJS / Tauri):** * **Camera (`html5-qrcode` or `zxing-js`):** Utilizes standard web APIs (`navigator.mediaDevices.getUserMedia`) to feed a video stream to a JS-based decoder capable of reading both DataMatrix and Code-128.
    * **USB HID Engine:** A custom global `keydown` event listener mounted at the root of the SolidJS app. It detects scanner inputs by measuring the time between keystrokes (human typing is >80ms; scanners are <20ms) and capturing the string until the `Enter` key is fired.
    * **BLE Engine:** Utilizes the standard Web Bluetooth API (`navigator.bluetooth.requestDevice()`). Filters for hardcoded `acceptAllDevices: false` and specific GATT service UUIDs associated with barcode hardware, subscribing to `characteristicvaluechanged` events to read the incoming byte arrays.
* **Backend (FastAPI):** * `GET /api/resolve/{scanned_payload}` - A dedicated, lightning-fast routing endpoint. It checks the payload against the `Storage` table (and potentially the `Parts` table in the future) and returns the entity type and ID so the frontend can redirect the router.

## 4. Out of Scope
* Using the camera for OCR (Optical Character Recognition) to read human text.
* Scanning external manufacturer barcodes (e.g., a UPC on a DigiKey bag) to scrape the web for part data. This feature strictly resolves internal Sidekick UUIDs.

---

## 5. Implementation Tasks
- [ ] Install and configure a JS-based barcode decoder (e.g., ZXing) for the camera view.
- [ ] Build SolidJS global layout component with the `keydown` interceptor for USB scanners.
- [ ] Build BLE pairing interface using Web Bluetooth GATT service subscriptions.
- [ ] Build the FastAPI `/api/resolve` endpoint.
- [ ] Wire up audio feedback (success beep) using standard HTML5 Audio.