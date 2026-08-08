---
title: Container Tare & Software Offsets
status: Draft
target: 
  - Web
  - Windows
  - Android
dependencies: 
  - 010-inventory-storage.md
  - 016-bluetooth-scale-integration.md
---

# Feature: Container Tare & Software Offsets

## 1. Overview
This feature adds software-level taring to Sidekick. In addition to a live "Software Zero/Tare" action, it introduces persistent Tare Profiles for physical containers (binned storage, anti-static bags, drawers). Storing an empty container's tare weight (`Storage.tare_weight`) directly on its location record allows Sidekick to compute the net weight of components inside a bin without requiring the user to empty the bin first.

## 2. User Experience & UI
* **Trigger:** Available within the persistent Scale Widget and the Storage Location detail views.
* **Interaction (Live Software Tare):**
    * Clicking the "Tare" button in the scale widget captures the current scale reading as `software_tare_offset`. Subsequent displays calculate `net_weight = live_weight - software_tare_offset`.
* **Interaction (Container Tare Profile):**
    * In the Storage tree/detail view, a user can click "Set Container Tare".
    * They can weigh the empty bin live on the scale or manually enter its tare weight (e.g., `42.5g`).
    * The tare weight is saved to the database for that storage container (`Storage.tare_weight`).
    * When performing stock checks on that container, clicking "Apply Container Tare" automatically subtracts its registered `tare_weight` from the current reading.
* **Mobile Considerations:** The Tare button must be prominent on the scale control bar. Container tare profile indicators should clearly display `Tare: X.Xg` on location cards.

## 3. Technical Implementation
* **Frontend (SolidJS / Tauri):**
    * Extends `ScaleProvider` context with a `softwareTareOffset` signal.
    * Computes `netWeight = () => liveWeight() - softwareTareOffset()`.
    * Implements a "Reset Tare" function to clear `softwareTareOffset` back to `0`.
* **Backend (FastAPI):**
    * Extends the `Storage` Peewee model to include an optional float column: `tare_weight` (REAL, default 0.0).
    * Updates `POST /api/storage` and `PUT /api/storage/{id}` routes to handle `tare_weight`.
* **Database Schema (SQLite / Peewee):**
    * Model: `Storage`
    * Added Column: `tare_weight` (REAL, nullable).

## 4. Out of Scope
* Direct hardware-level zeroing commands sent to the scale (taring is managed strictly via software offset calculations in Sidekick to ensure cross-scale compatibility).

---

## 5. Implementation Tasks
- [ ] Add `softwareTareOffset` state and `netWeight()` calculation to `ScaleProvider`.
- [ ] Add "Tare" and "Zero/Reset" buttons to the global Scale Widget UI.
- [ ] Add `tare_weight` column to `Storage` Peewee model and migration script.
- [ ] Add "Weigh/Set Empty Container Tare" action to the Storage location UI.