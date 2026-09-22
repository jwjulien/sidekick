---
title: Deep Link Routing
status: In Progress
target: 
  - Web
  - Windows
  - Android
dependencies: []
---

# Feature: Deep Link Routing

## 1. Overview
This feature registers a custom OS-level URI scheme (`fuse://`) for the Sidekick application. It acts as the universal routing glue for hardware interactions. By encoding this URL format into physical NFC tags and DataMatrix labels, the operating system can seamlessly launch Sidekick from the background and route the user directly to a specific internal view.

### Addressing Strategies: UUID vs. Human-Readable Paths
Sidekick supports dual addressing formats for location deep links:
* **UUID-Based Links (`fuse://location/{uuid}`):** Highly permanent. Because the UUID is an immutable physical identifier, the link remains valid even if containers are renamed, re-indexed, or physically relocated to different racks or shelves.
* **Human-Readable Path Links (`fuse://location/{path}` - e.g., `fuse://location/Rack_A/Shelf_1/Bin_2`):** Human-friendly and inspectable without database lookups. However, paths are vulnerable to breaking if an intermediate or leaf node is renamed, restructured, or deleted.

To mitigate broken path links, the routing engine incorporates a **Resilient Ancestor Fallback Resolver**.

## 2. User Experience & UI
* **Trigger:** The user scans an NFC tag, scans a Sidekick DataMatrix with their native camera app, or clicks a `fuse://` link in another app (like an email or note).
* **Interaction (Standard Exact Match):**
    1. If Sidekick is closed, the OS launches it. If backgrounded, it is foregrounded.
    2. The application intercepts the URL payload.
    3. The SolidJS router parses the path (`/location/{id_or_path}`).
    4. The app navigates directly to that specific entity in the Miller columns (`/storage?location={id}`) or Part detail view (`/parts/{id}`).
* **Interaction (Broken Deep Links & Ancestor Fallback):**
    1. If a deep link path does not exist (for example, if a leaf bin was deleted or renamed in a reorganization), the resolver automatically initiates hierarchical fallback.
    2. It iteratively trims path segments from right to left to locate the nearest surviving ancestor in the database tree (e.g. falling back from `.../Shelf_1/Bin_Lost` to `.../Shelf_1`).
    3. The application opens the Miller columns navigated to that closest ancestor.
    4. An alert toast is displayed:
       > *"Location '[Lost Leaf]' was not found. Navigated to nearest ancestor: [Ancestor Name]."*
    5. This ensures the user is brought as physically close as possible to the intended location, even if historical names changed.
* **Mobile Considerations:** Deep linking is a first-class citizen on mobile operating systems. The Android manifest must be configured to declare intent filters for the `fuse` scheme to prevent the OS from routing these to a web browser.

## 3. Technical Implementation
* **Frontend (SolidJS / Tauri):** 
    * Utilizes `@tauri-apps/plugin-deep-link` to register the scheme and listen for incoming URLs across all platforms.
    * A global listener is mounted at the root of the SolidJS application that captures deep link events, extracts the entity type and payload, and delegates to the resolver service.
    * When an ancestor fallback occurs, triggers a toast notification and updates active column selections in `Storage.tsx`.
* **Backend (FastAPI):** 
    * Supported via `GET /api/resolve/{payload}` (see `013-barcode-scanning.md`). If an exact UUID or path is not matched, the backend traverses the ancestor path hierarchy, returning the resolved ancestor node along with `match_type: "ancestor_fallback"`.

## 4. Out of Scope
* Universal Links / App Links (e.g., intercepting standard `https://bomshelter.com/` links). We are strictly sticking to the custom `fuse://` scheme for this phase to ensure hardware tags are uniquely scoped to the application.

---

## 5. Implementation Tasks
- [x] Install and configure `tauri-plugin-deep-link`.
- [x] Update `tauri.conf.json` and Android Manifest to declare the `fuse` scheme.
- [x] Create SolidJS global listener to intercept deep links and bridge them to the internal router.
- [x] **Retroactive Update:** Update `011-storage-labels.md` to ensure the generated DataMatrix encodes the `fuse://location/{id}` format instead of just the raw UUID.
- [ ] Implement path-based deep link resolution in client deep-link handler.
- [ ] Implement ancestor fallback traversal for broken path deep links with user alert toast.
