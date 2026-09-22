---
title: Universal Barcode Scanning Core
status: In Progress
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
  4. If unhandled by a modal, the payload is resolved via FastAPI `GET /resolve/{payload}` or parsed directly if formatted as `fuse://location/{id_or_path}` or `fuse://part/{id}`.
  5. SolidJS router navigates to target entity view (`/storage?location={id}` or `/parts/{id}`), or dispatches `sidekick:nfc-scanned` for live in-page Miller Column updates.
  6. **Ancestor Fallback Notification:** If the payload was a location path whose leaf was not found, the resolver returns the nearest surviving ancestor. The UI navigates to that ancestor and displays an informational toast: *"Location not found; redirected to nearest ancestor: [Ancestor Name]"*.
* **Toast Feedback:** Confirmation toast appears confirming entity resolution (`USB Scanner: Navigating to location` or fallback notice).

## 3. Technical Implementation
* **FastAPI Backend (`server/app/routers/resolve.py`):**
  * `GET /resolve/{payload:path}` and `GET /resolve?q={payload}` endpoints parse `fuse://` URIs, raw UUID strings, or hierarchical location paths.
  * Performs case-insensitive SQL queries (`func.lower(Storage.id) == target_id.lower()`) against `Storage` and `Parts` tables.
  * **Hierarchical Path Resolution & Ancestor Fallback:**
    * Matches paths against storage node breadcrumbs (e.g., `Rack_A/Shelf_1/Bin_2`).
    * If exact leaf match is missing, recursively trims path segments from right to left until the closest existing parent node is matched.
    * Returns payload response:
      ```json
      {
        "entity_type": "location",
        "id": "018f3a5e-...",
        "breadcrumb": "Rack A > Shelf 1",
        "route": "/storage?location=018f3a5e-...",
        "match_type": "exact" | "ancestor_fallback",
        "requested_query": "Rack_A/Shelf_1/Bin_Old",
        "fallback_ancestor": "Shelf 1"
      }
      ```
* **Client Service Infrastructure (`client/src/services/usbScannerService.ts`):**
  * Modal listener registration system (`registerModalListener`).
  * Deep link parsing integration via `parseDeepLink()`.
  * Custom event dispatching (`sidekick:nfc-scanned`) for zero-reload in-page Miller Column navigation.
  * Dispatches alert toast when `match_type === "ancestor_fallback"`.
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
- [ ] Add hierarchical path resolution and recursive ancestor fallback search to FastAPI `/resolve`.
- [ ] Add client toast handling for `ancestor_fallback` scan events.