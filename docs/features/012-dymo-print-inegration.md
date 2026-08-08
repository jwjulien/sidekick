---
title: Dymo ESP32 Print Integration
status: Draft
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
* **Interaction:** 1. The UI displays a "Processing..." spinner while the canvas is mathematically rasterized.
    2. The UI displays "Transmitting..." while the HTTP requests are sent to the ESP32.
    3. Upon success, a toast notification confirms "Print Sent."
* **Configuration:** A settings panel is required for the user to input and save the local IP address of the ESP32 print server (e.g., `192.168.1.100`).
* **Mobile Considerations:** If the mobile device is on the same local WiFi network as the ESP32, the Tauri Android app will communicate directly with the printer without needing to proxy through the FastAPI backend.

## 3. Technical Implementation
* **Frontend (SolidJS / Tauri):** * Implementation of the `DymoPrinter` TypeScript class.
    * **Rasterization Engine:** Iterates through canvas `ImageData`, evaluates pixel luminance `(r + g + b) / 3 < 128` to determine if a pixel is black, and packs the bits vertically into a `Uint8Array`.
    * **Network Protocol:** Executes a sequential HTTP sequence (`fetch`) directly to the ESP32:
        1. `/reset`
        2. Set configurations (e.g., `/height`).
        3. POST the `Uint8Array` binary payload.
* **Backend (FastAPI):** * None. This is a direct Client-to-ESP32 execution path via standard network requests. *(Note: ESP32 server must implement generous CORS headers if accessed from a Web browser, though Tauri desktop/mobile runtimes often bypass strict browser CORS).*

## 4. Out of Scope
* Supporting other manufacturer protocols (e.g., ZPL for Zebra printers) in this initial phase.
* Auto-discovering the ESP32 printer on the network (mDNS/Bonjour); the IP will be manually entered.

---

## 5. Implementation Tasks
- [ ] Build UI input in the master Settings page to save the Printer IP Address.
- [ ] Implement the `DymoPrinter.tsx` class and bit-shifting rasterization logic.
- [ ] Wire the "Send to Printer" button to execute the rasterization and network sequence.
- [ ] Handle error states (e.g., ESP32 offline, paper empty) gracefully in the UI.