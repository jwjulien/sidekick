---
title: Dymo ESP32 Print Integration
status: Complete
target: 
  - Windows
  - Android
dependencies: 
  - 011-storage-labels.md
---

# Feature: Dymo ESP32 Print Integration

## 1. Overview
This feature acts as the hardware interface between Sidekick and a custom ESP32-driven Dymo print server. It takes the visual HTML5 Canvas generated in the Label feature, converts it into a pure 1-bit rasterized binary format (vertical byte columns), and transmits it over the local network via HTTP to be printed.

## 2. User Experience & UI
* **Trigger:** The user clicks "Send to Printer" from the Label Preview modal.
* **Interaction:**
    1. The UI displays an animated progress spinner ("Initializing...", "Rasterizing...", "Configuring...", "Transmitting...").
    2. The UI executes HTTP calls directly through the Tauri Rust app backend.
    3. Upon success, a toast notification confirms "Label printed successfully!"
* **Configuration:** Master Settings page (`/settings`) allows inputting and testing the printer IP address/hostname (`dymo-printer.local`), adjusting density/speed, and triggering network discovery.
* **Network Discovery & Selection:** Auto-scans local subnet & mDNS. Auto-selects if 1 printer is found; prompts selection modal if >1 printers are found.

## 3. Technical Implementation
* **Frontend Services (`printerDriver.ts` & `printerService.ts`):**
    * **`DymoEsp32Driver`**: Bit-shifting 1-bit column-packed rasterizer (`rasterizeCanvas`), 2x Graphics Mode scaling, status bitmask parsing (`Ready`, `Top`, `Empty`, `Error`).
    * **Network Protocol:** App-side Tauri Rust backend IPC (`printer_send_request`) executes sequence directly via native sockets:
        1. `/reset`
        2. `/height`
        3. `/speed` & `/density`
        4. `/print` (Uint8Array binary payload)
        5. `/feed`
* **App Backend (Tauri Rust `printer.rs`):**
    * Native multi-threaded TCP stream scanner (`printer_discover`), status check (`printer_check_status`), and socket proxy (`printer_send_request`) operating with 0 CORS constraints.

---

## 4. Implementation Tasks
- [x] Build UI input in the master Settings page to save and test Printer IP Address / Hostname.
- [x] Implement `DymoEsp32Driver` rasterization engine and 1-bit column byte-packing logic.
- [x] Wire "Send to Printer" in `LabelPreviewModal.tsx` to execute progress workflow and print.
- [x] Handle error states (ESP32 offline, paper empty, hardware error) gracefully in UI with status badges & toasts.
- [x] Implement native app-side network auto-discovery with single printer auto-select and multi-printer choice modal.