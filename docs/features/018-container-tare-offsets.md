---
title: Container Tare & Software Offsets
status: Complete
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
This feature adds software-level taring to Sidekick. In addition to a live "Software Zero/Tare" action, it introduces persistent Tare Profiles for physical containers (binned storage, anti-static bags, drawers). Storing an empty container's tare weight (`Storage.last_tare_id` / `TareWeight`) directly on its location record allows Sidekick to compute the net weight of components inside a bin without requiring the user to empty the bin first.

## 2. User Experience & UI
* **Trigger:** Available within the scale interface, location count modal, and Storage Location detail views.
* **Interaction (Live Software Tare):**
    * Clicking the "Tare" button captures current scale reading as tare offset. Subsequent displays calculate `net_weight = live_weight - tare_offset`.
* **Interaction (Container Tare Profile):**
    * Users can create/edit Tare Profiles (e.g., Small Anti-Static Bag = 1.2g, Medium Bin = 42.5g) in Settings / Storage design views.
    * When performing stock counts, selecting a tare profile automatically applies its registered weight as the subtractive tare offset.
* **Mobile Considerations:** Tare buttons are formatted with high-contrast, prominent touch targets.

## 3. Technical Implementation
* **Frontend (SolidJS):**
    * `ScaleProvider` context includes `tareOffset` signal, `netWeight()` calculation, `tare()`, and `resetTare()`.
    * Tare selector dropdown loading `/api/tare-weights` endpoint.
* **Backend (FastAPI & SQLAlchemy):**
    * `TareWeight` model and `Storage.last_tare_id` foreign key relationship.
    * `/api/tare-weights` CRUD router for creating, reading, updating, and deleting container tare profiles.

## 4. Out of Scope
* Direct hardware-level zeroing commands sent to the scale.

---

## 5. Implementation Tasks
- [x] Add `tareOffset` state, `netWeight()` calculation, and `tare()` to `ScaleProvider`.
- [x] Add `TareWeight` model, Alembic migration, and `/api/tare-weights` backend endpoints.
- [x] Add Tare profile management UI in application settings (`Design.tsx`).
- [x] Implement standalone `ContainerTareSelector.tsx` component for reusability.
