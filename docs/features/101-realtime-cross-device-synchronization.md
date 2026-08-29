---
title: Multi-Device Synchronization & Real-Time Sync Engine
status: In Progress # Phase 1 Complete; Phase 2 Roadmap Planned
target: 
  - Web
  - Windows
  - Android
dependencies: []
---

# Feature: Multi-Device Synchronization & Real-Time Sync Engine

## 1. Overview
This feature provides a seamless multi-device workflow between Android mobile devices (used while walking around searching for parts in physical storage) and Desktop workstations (used for project design and management). 

* **Phase 1 (Complete):** Introduces zero-latency background state revalidation when switching tabs, focusing windows, or unlocking mobile screens.
* **Phase 2 (Roadmap):** Introduces real-time, event-driven data synchronization using Server-Sent Events (SSE) or WebSockets to broadcast lightweight data mutation signals from the FastAPI backend to connected clients instantly.

This architecture eliminates manual refreshes (`F5`) and latency without requiring complex offline-first CRDT databases.

## 2. User Experience & UI
* **Trigger:** Automatic upon window focus (`focus`), tab visibility change (`visibilitychange`), or real-time event reception (`app:revalidate` / socket message).
* **Interaction:** 
  * **Phase 1 Focus Revalidation:** Updating an inventory item or bin location on a phone automatically refetches active desktop views as soon as the user switches focus back to the desktop browser.
  * **Throttling Protection:** Focus revalidation is throttled with a minimum interval (default: 3000ms) to eliminate redundant network requests during rapid window switching.
  * **Phase 2 Live Push Sync:** Changes made on mobile instantly update the desktop screen in real time with visual pulse indicators on affected items without requiring window switching.
  * **Active Session Handoff (Optional):** Inspecting a part on mobile can send a "Handoff to Desktop" signal, automatically focusing or opening that item card on the workstation.
  * **Sync Status Badge:** A subtle indicator in the app header showing connection status (*Live Sync Active* vs *Focus Sync Only*).
* **Mobile Considerations:** Seamlessly handles phone screen unlock, PWA tab focus, and automatic socket reconnects after Wi-Fi/cellular drops.

## 3. Technical Implementation
* **Frontend (SolidJS):**
  * `client/src/hooks/useFocusRevalidation.ts` *(Phase 1 - Built)*: SolidJS hook managing `visibilitychange`, `focus`, and `app:revalidate` listeners with automatic cleanup and interval throttling.
  * `triggerAppRevalidate()` *(Phase 1 - Built)*: Utility function to broadcast custom app-wide revalidation events when mutations occur.
  * `useServerEvents.ts` *(Phase 2 - Planned)*: Global hook for managing WebSocket / SSE (`EventSource`) streams, reconnect logic, and signal invalidations.
  * **Page Integration:** Focus revalidation integrated into core data views (`Parts.tsx`, `PartDetails.tsx`, `Storage.tsx`, `Dashboard.tsx`).
* **Backend (FastAPI / SQLite):**
  * **Phase 1 (Current):** REST API endpoints (`/parts`, `/locations`, etc.) leveraged via focus revalidation.
  * **Phase 2 (Planned):** In-memory `ConnectionManager` in `server/app/realtime.py` broadcasting lightweight event payloads (`{"event": "PART_MUTATED", "part_id": 42}`) post-commit.
* **Database Schema:** No schema modifications required.

## 4. Out of Scope
* Multi-master offline-first CRDT database synchronization (intentionally avoided to prevent unnecessary schema complexity, vector clock overhead, and merge conflict resolution).

---

## 5. Implementation Tasks

### Phase 1: Focus Revalidation & Event Bus
- [x] Build reusable `useFocusRevalidation.ts` hook with throttling and lifecycle cleanup.
- [x] Integrate focus revalidation into `Parts.tsx`, `PartDetails.tsx`, `Storage.tsx`, and `Dashboard.tsx`.
- [x] Write unit test suite for `useFocusRevalidation` (`useFocusRevalidation.test.ts`).

### Phase 2: Real-Time Event Push Engine (v2.0 Roadmap)
- [ ] Build FastAPI `ConnectionManager` event hub in `server/app/realtime.py`.
- [ ] Add event publishing hooks to FastAPI CRUD routers (parts, locations, projects, storage).
- [ ] Create `useServerEvents.ts` hook in SolidJS with auto-reconnect and message routing.
- [ ] Connect event listener to `triggerAppRevalidate()` and page store invalidators.
- [ ] Add Live Sync status indicator to app header.
