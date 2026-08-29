---
title: Database Snapshots and Runtime Swapping
status: Complete
target: 
  - Web
  - Windows
  - Android
dependencies: []
---

# Feature: Database Snapshots and Runtime Swapping

## 1. Overview
This feature introduces runtime database environment swapping (Production vs. Sandbox Testing mode) and a comprehensive database snapshot system for Sidekick. Users can switch into a testing sandbox environment (`sidekick_testing.db`) to experiment with schema updates, BOM changes, or new features without altering production inventory data. Additionally, users can capture, list, delete, and restore dated snapshot files (`Sidekick_YYYY-MM-DD_HHMMSS.db`).

## 2. User Experience & UI
* **Trigger:** Accessible via the **Settings** page under the *Database Mode & Snapshots* panel, or directly from the *Testing Mode Ribbon*.
* **Interaction:** 
  * **Database Mode Switching:** Toggle between **Production Mode** (`sidekick.db`) and **Testing Sandbox Mode** (`sidekick_testing.db`), or select "Copy Production to Testing & Switch".
  * **Testing Mode Ribbon:** When in Testing Sandbox Mode, a prominent warning banner is rendered at the top of all pages with an instant "Switch to Production" button.
  * **Snapshot Creation:** Save a restore point snapshot (`Sidekick_YYYY-MM-DD_HHMMSS.db`) on demand.
  * **Snapshot Management:** View all snapshots stored in `data/`, with options to delete files (with confirmation dialog) or restore snapshots.
  * **Smart Restore Prompt:** Restoring a snapshot prompts the user to save a snapshot of current production data first *only if* un-snapshotted changes exist (determined via SHA256 hash comparison).
  * **UI Locking:** During database file copy, swap, or migration operations, a full-screen backdrop overlay locks interaction until completion.
* **Mobile Considerations:** The testing mode ribbon and operation lock overlay adapt seamlessly to mobile viewports.

## 3. Technical Implementation
* **Frontend (SolidJS):**
  * `DatabaseContext.tsx`: Provides reactive signals for active DB mode, pending operation state, snapshot listings, and change tracking.
  * `TestingModeBanner.tsx`: Rendered inside `Layout.tsx` when operating in Testing mode.
  * `DatabaseOperationOverlay.tsx`: Displays full-screen modal during database switching and restoration.
  * `Settings.tsx`: Redesigned card containing mode toggle, snapshot action buttons, and snapshot inventory table.
* **Backend (FastAPI / SQLite):**
  * `database.py`: Dynamic engine connection pool supporting `sidekick.db` and `sidekick_testing.db`. Resolves target DB using `X-Database-Mode` request header or active system mode fallback. Provides WAL checkpointing and engine disposal tools.
  * `routers/system_db.py`: Endpoints for mode status, mode switching, snapshot glob listing, snapshot creation, deletion, and restoration with Alembic auto-migration execution.
* **Database Schema:** Operates on standard SQLite file copies in `data/`. Automatically runs Alembic migrations on mounted databases.

## 4. Out of Scope
* Automatic cloud or remote server backup sync.
* Per-table partial data rollbacks (snapshots are full database file copies).

---

## 5. Implementation Tasks
- [x] Create backend dynamic DB manager in `database.py`.
- [x] Implement FastAPI system DB router in `routers/system_db.py`.
- [x] Build SolidJS `DatabaseContext.tsx`, `TestingModeBanner.tsx`, and `DatabaseOperationOverlay.tsx`.
- [x] Upgrade `Settings.tsx` UI for database mode switching and snapshot management.
- [x] Add `X-Database-Mode` support in client API requests.
- [x] Verify database switching, snapshot restore, and migration execution.
