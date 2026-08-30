---
title: Desktop USB Barcode Scanner Integration
status: Complete
target: 
  - Windows
dependencies: 
  - 010-inventory-storage.md
  - 014-deep-link-routing.md
  - 038-device-and-user-settings.md
---

# Feature: Desktop USB Barcode Scanner Integration

## 1. Overview
This feature provides a dedicated desktop background service for monitoring USB barcode scanners connected directly via raw USB (using WinUSB drivers) rather than standard HID keyboard emulation. By running directly in the local Tauri Rust backend (`src-tauri`), Sidekick monitors and intercepts barcode scans anywhere in the application on the desktop PC—regardless of active window focus or text field selection—and dispatches deep link resolutions (`fuse://location/{id}` or `fuse://part/{id}`) to the FastAPI server to instantly jump to target entities without typing extraneous characters into focused UI inputs.

Because the USB hardware monitoring is implemented natively in Tauri Rust on the client side, local barcode scanning functions seamlessly even when the FastAPI backend is hosted on a remote server.

## 2. User Experience & UI
* **Trigger:** Purely automatic background operation. Once configured, pressing the hardware trigger on the USB scanner immediately dispatches the barcode read across any screen or modal in Sidekick.
* **Interaction (Desktop USB Scan):**
  1. The user points and shoots their USB barcode scanner at a location or part label.
  2. The Tauri Rust background thread catches the raw USB HID input bytes, decodes the character sequence up to the carriage return (`\n`), and extracts the payload string.
  3. The SolidJS frontend receives the native Tauri event (`usb-scan-event`), queries the FastAPI backend endpoint `GET /api/resolve/{payload}` (or dispatches the deep link), and automatically navigates to the target Location or Part detail view (or updates active modal targets, such as location selection in `MovePartModal`).
  4. Plays a success sound and displays a toast notification confirming entity resolution.
* **Configuration & Device Settings (`/settings`):**
  * Dedicated settings section to enable or disable the Desktop USB Scanner background service.
  * **USB Device Picker Widget:** Includes a "Scan for USB Devices" button that invokes the Tauri Rust command `usb_enumerate_devices` to list all attached local USB hardware. Displays a dropdown picker showing human-readable device names, manufacturers, and hex VID/PID values (e.g. `Barcode Scanner — Honeywell (VID: 0x0581, PID: 0x011C)`). Selecting a device automatically sets the target VID/PID without manual typing.
  * **Manual Hex Override:** Includes an "Advanced / Manual Edit" toggle allowing manual entry/editing of custom VID (`0x0581`) and PID (`0x011C`) hex strings.
  * Real-time status indicator showing whether the configured scanner device is connected, active, or disconnected.
* **Mobile Considerations:** N/A (Desktop/Windows specific; Android and mobile devices utilize camera barcode scanning as defined in `013-barcode-scanning.md`).

## 3. Technical Implementation
* **Tauri Rust Backend (`src-tauri`):**
  * **USB Crate Dependency (`rusb`):** Adds [`rusb`](https://crates.io/crates/rusb) (or `nusb`) to `src-tauri/Cargo.toml` to interface directly with libusb / WinUSB APIs on Windows client workstations.
  * **Device Enumeration Command (`usb_enumerate_devices`):** Tauri command calling `rusb::devices()`. Iterates through attached USB devices, reads `device_descriptor()`, and queries string descriptors (`read_manufacturer_string`, `read_product_string`) to return a JSON array of attached devices to the frontend picker widget.
  * **Worker Thread (`UsbScannerWorker`):** Spawns a background Rust thread when the scanner service is enabled:
    1. Opens device handle matching configured VID and PID (`rusb::open_device_with_vid_pid`).
    2. Claims USB interface 0 (`handle.claim_interface(0)`).
    3. Executes continuous non-blocking interrupt/bulk reads on endpoint `0x81` with `read_interrupt` / `read_bulk`.
  * **HID Byte Decoding (`decode_hid_report`):** Parses raw HID data reports where byte 0 indicates modifier/shift state (`data[0] & 0x22`) and byte 2 indicates the HID keycode (`data[2]`). Maps keycodes to ASCII characters and accumulates characters into a thread-safe string buffer until a newline (`\n` / keycode `0x28`) is encountered.
  * **Event Emission:** Emits the completed barcode payload string to the frontend via `app_handle.emit("usb-scan-event", payload)`.
* **Frontend Interceptor & Resolver (`client` / SolidJS):**
  * **`usbScannerService.ts`**: Subscribes to Tauri's `listen("usb-scan-event")` primitive.
  * **Entity Resolution:** Upon receiving a payload, sends request to FastAPI `GET /api/resolve/{payload}` (works whether FastAPI is local or on a remote server).
  * Resolves entity type (`location` | `part`), navigating via SolidJS router or triggering modal context handlers (mirroring NFC deep link behavior in `015-nfc-management.md`).
* **Settings & Device Persistence:**
  * Stores USB scanner VID/PID hex values and service toggle in local app configuration / settings.

## 4. Out of Scope
* Mobile Android camera scanning (handled in `013-barcode-scanning.md`).
* Automated Windows driver installation/swapping (requires manual Zadig / libusb-win32 setup to switch driver from HID to WinUSB).
* Serial / COM port barcode scanners (strictly focused on direct WinUSB / PyUSB / rusb raw USB endpoint listening).

---

## 5. Implementation Tasks
- [x] Add `rusb` crate dependency to `src-tauri/Cargo.toml`.
- [x] Implement `usb_enumerate_devices` Tauri command in Rust to enumerate local client USB hardware with string descriptors.
- [x] Implement `UsbScannerWorker` Rust thread with interrupt read loop on endpoint `0x81` and `app_handle.emit("usb-scan-event")`.
- [x] Implement Rust HID report parser (`decode_hid_report`) mapping shift modifiers and keycodes to string payload.
- [x] Build SolidJS USB device picker widget in `/settings` with "Scan for USB Devices" button and manual VID/PID toggle.
- [x] Create SolidJS `usbScannerService.ts` to subscribe to Tauri `usb-scan-event` and send payload to `GET /api/resolve/{payload}`.
- [x] Wire scan resolution to deep link router navigation (`fuse://location/{id}` and `fuse://part/{id}`) and modal location selectors.
- [x] Handle USB disconnect/reconnect gracefully with status updates on the Settings page.
