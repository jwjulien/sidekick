---
title: Bluetooth Scale Integration
status: Complete
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
This feature provides the hardware integration layer for off-the-shelf Bluetooth Low Energy (BLE) kitchen/postal scales (e.g., Etekcity) in Sidekick. By reading real-time GATT characteristic notifications via Web Bluetooth API, it abstracts live scale readings (`rawWeight`, `netWeight`, `unit`, `isStable`) into a reactive context (`ScaleProvider`) accessible across the application. Higher-level features—such as Part Weight Calibration (`017`), Container Tare Offsets (`018`), and Scale Inventory Reconciliation (`019`)—consume this hardware abstraction layer.

## 2. User Experience & UI Workflow

### Global Scale Connection & Status
* **Connection Management:** Users can connect/disconnect BLE scales directly via a global scale widget or connection prompt.
* **Developer / Simulator Mode:** Includes a simulated weight slider toggle mode for testing in desktop browsers or environments without physical BLE scale hardware.
* **Status Indicators:** Provides reactive scale status (`disconnected`, `connecting`, `connected`, `error`) and stability flags (`isStable`).

---

## 3. Technical Implementation

* **Frontend (`client` / SolidJS):**
  * `ScaleContext` / `ScaleProvider`: Global SolidJS context exposing scale connection state (`status`, `errorMessage`), live readings (`rawWeight`, `netWeight`, `unit`, `isStable`), basic zeroing (`tare()`, `resetTare()`), connection controls (`connect()`, `disconnect()`), and simulator controls (`mockMode`, `simulatedWeight`).
  * GATT Notification Engine (`scaleParser.ts`): Listens to characteristic `0000FFF1-0000-1000-8000-00805F9B34FB` on service `0000FFF0-0000-1000-8000-00805F9B34FB`. Parses 15-byte notification payloads:
    * 16-bit weight payload integer shifting (`data[11] + (data[12] << 8)`).
    * Unit enum mapping (`g`, `oz`, `ml`) & scale factor application (`0.1` for g/ml, `0.01` for oz).
    * Negative sign inversion flag handling.
    * Stability flag evaluation (`data[15]`).
  * Unit Tests (`scaleParser.test.ts`): Comprehensive unit tests covering GATT payload byte parsing, unit conversion, negative weights, and scale math calculations.

---

## 4. Out of Scope
* Reverse-engineering encrypted BLE protocols for proprietary commercial scales.
* Multi-scale simultaneous connections (single scale active per session).
* Calibration workflows (handled in `017`).
* Container tare profile persistence (handled in `018`).
* Inventory counting and stock commit endpoints (handled in `019`).

---

## 5. Implementation Tasks
- [x] Implement `ScaleContext.tsx` with Web Bluetooth GATT subscriber & dev simulator mode.
- [x] Implement GATT payload parser (`scaleParser.ts`) for 15-byte scale notifications.
- [x] Create unit tests for GATT payload parser and scale math helpers (`scaleParser.test.ts`).
- [x] Provide reactive `isStable`, `rawWeight`, `netWeight`, `unit`, `connect()`, and `disconnect()` primitives via `ScaleProvider`.