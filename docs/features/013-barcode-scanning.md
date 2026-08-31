---
title: Universal Barcode Scanning Core
status: Complete
target: 
  - Web
  - Windows
  - Android
dependencies: 
  - 010-inventory-storage.md
  - 011-storage-labels.md
  - 014-deep-link-routing.md
---

# Feature: Universal Barcode Scanning Core

## 1. Overview
This feature provides the core barcode resolution architecture and deep-link routing engine for Sidekick across all platforms (Web, Windows, Android). It establishes the standard handling for internal `fuse://` URIs, barcode payload resolution against the FastAPI backend, success audio feedback, and live modal scan listeners.

Platform-specific hardware barcode capturing mechanisms are specified in dedicated sub-features:
* **Windows Desktop Raw USB Scanners**: See [`043-desktop-usb-barcode-scanner.md`](043-desktop-usb-barcode-scanner.md).
* **Android Mobile Camera Scanners**: See [`044-android-camera-barcode-scanner.md`](044-android-camera-barcode-scanner.md).

## 2. User Experience & UI
* **Global Access:** Barcode scanning triggers are accessible anywhere in the app via floating action buttons (FABs), header quick-actions, or background hardware event listeners.
* **Scan Resolution Flow:**
  1. Barcode payload is received (from USB HID background thread, camera scanner preview, or deep link handler).
  2. Success audio chime plays (`AudioContext` C6 1046.5Hz tone).
  3. Active modal scanner listeners (e.g. `MovePartModal` / location picker) take precedence if registered.
  4. If unhandled by a modal, the payload is resolved via FastAPI `GET /resolve/{payload}` or parsed directly if formatted as `fuse://location/{id}` or `fuse://part/{id}`.
  5. SolidJS router navigates to target entity view (`/storage?location={id}` or `/parts/{id}`), or dispatches `sidekick:nfc-scanned` for live in-page Miller Column updates.
* **Toast Feedback:** Confirmation toast appears confirming entity resolution (`USB Scanner: Navigating to location`).

## 3. Technical Implementation
* **FastAPI Backend (`server/app/routers/resolve.py`):**
  * `GET /resolve/{payload:path}` and `GET /resolve?q={payload}` endpoints parse `fuse://` URIs or raw UUID strings.
  * Performs case-insensitive SQL queries (`func.lower(Storage.id) == target_id.lower()`) against `Storage` and `Parts` tables.
  * Generates hierarchical location breadcrumbs (e.g. `SMD Boxes > 0603`) and target route strings.
* **Client Service Infrastructure (`client/src/services/usbScannerService.ts`):**
  * Modal listener registration system (`registerModalListener`).
  * Deep link parsing integration via `parseDeepLink()`.
  * Custom event dispatching (`sidekick:nfc-scanned`) for zero-reload in-page Miller Column navigation.
* **Audio Feedback:** Synthesizes instant audio beep via Web Audio API (`AudioContext`).

## 4. Out of Scope
* Direct raw USB WinUSB driver polling on Windows (handled in `043-desktop-usb-barcode-scanner.md`).
* Android native camera reticle and camera permissions (handled in `044-android-camera-barcode-scanner.md`).
* BLE (Bluetooth Low Energy) handheld barcode scanners (deferred until physical hardware testing).
* Optical Character Recognition (OCR) or external manufacturer UPC web scraping.

---

## 5. Implementation Tasks
- [x] Build FastAPI `/resolve` routing endpoint supporting path parameters, query strings, and case-insensitive UUID matching.
- [x] Create client deep link parsing utility (`parseDeepLink`) supporting `fuse://` URI scheme.
- [x] Build Web Audio API success chime synthesizer (`playSuccessBeep`).
- [x] Implement modal scan interceptor registration (`registerModalListener`).
- [x] Wire in-page custom event dispatch (`sidekick:nfc-scanned`) for zero-reload Miller Column navigation in `Storage.tsx`.