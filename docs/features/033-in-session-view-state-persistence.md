---
title: In-Session View State Persistence
status: Complete
target: 
  - Web
  - Windows
  - Android
dependencies: []
---

# Feature: In-Session View State Persistence

## 1. Overview
This feature provides in-memory session persistence for transient UI view states across major navigation areas in Sidekick (Storage Locations, Parts Catalog, PCB Projects, and Design Structure). It ensures that navigating away from a view (for example, opening a part details page or switching sidebar items) and returning during the same app session lands the user back in their exact previous position, active filters, selected project/revision, or open column hierarchy.

## 2. User Experience & UI
* **Trigger:** Automatic upon navigation between views within the same app session. No manual user toggle or configuration required.
* **Interaction:**
  1. **Storage Locations:** User drills down into a multi-column Miller column hierarchy (e.g. `Warehouse A -> Shelf 3 -> Bin 12`). User clicks a part link or navigates to another sidebar item. Upon returning to Storage Locations, the exact column depth (`Bin 12`) is automatically restored instead of resetting to root locations.
  2. **Parts Catalog:** User filters parts by category (e.g., "Resistors"), enters search term "10k", and toggles grid view mode. Upon navigating away and back to Parts, the active filter criteria, search string, sort order, and view mode remain active. Additionally, inspecting a part records `lastViewedPartId` so users can return directly to the last viewed component via a header action button.
  3. **PCB Projects:** User selects Project "Control Board", Revision "v2.0", and Assembly "Main Assembly". Upon navigating away and back to Projects, the selected project, assembly, and revision selection state are maintained.
  4. **Design Structure:** User selects the "Tare Weights" sub-tab or expands several category classifications in the tree view. Upon returning to Design, the selected tab and expanded category branches remain open.
* **Mobile Considerations:** On mobile web and native Android builds, screen switching occurs frequently. Session persistence avoids frustrating layout resets when toggling between location navigation and part detail screens.

## 3. Technical Implementation
* **Frontend (SolidJS / Tauri):**
  * A root-level `ViewStateContext` provider and store (`ViewStateStore`) manages in-memory reactive state for four core domains: `storage`, `parts`, `projects`, and `design`.
  * Page components (`Storage.tsx`, `UniversalPartsBrowser.tsx`, `Projects.tsx`, `Design.tsx`, `PartDetails.tsx`) initialize their reactive signals from the `ViewStateContext` store instead of static defaults.
  * State updates in components automatically write back to the store.
  * `PartDetails.tsx` records `lastViewedPartId` and `lastViewedPartName` when fetching a part, enabling `Parts.tsx` to render a "Return to Last Viewed Part" quick navigation button.
  * Optionally syncs to `window.sessionStorage` so browser tab refreshes keep the session active without persisting data permanently across app runs.
  * Direct URL query parameters (e.g., `?locPath=...`) override session view state to preserve deep linking.
* **Backend (FastAPI / SQLite):**
  * No backend changes required; view states are transient and strictly managed on the client side.
* **Database Schema:**
  * No new tables or columns required.

## 4. Out of Scope
* Cross-session view state persistence (saving state to disk or database across app restarts/shutdowns).
* Server-side user view preferences per user account.

---

## 5. Implementation Tasks
- [x] Create `client/src/context/ViewStateContext.tsx` with domain view state stores.
- [x] Wrap application routes in `<ViewStateProvider>` in `client/src/App.tsx`.
- [x] Update `Storage.tsx` to read/write `activePath` Miller column selection to session view state.
- [x] Update `UniversalPartsBrowser.tsx` to read/write filter settings, search, view mode, and sort options to session view state.
- [x] Update `Projects.tsx` to read/write `selectedProjectId`, `selectedAssemblyId`, and `selectedRevisionId` to session view state.
- [x] Update `Design.tsx` to read/write `activeTab` and expanded category node IDs to session view state.
- [x] Track `lastViewedPartId` & `lastViewedPartName` in `PartDetails.tsx` and render "Return to Last Viewed Part" quick navigation in `Parts.tsx`.
