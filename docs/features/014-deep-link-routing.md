---
title: Deep Link Routing
status: Completed
target: 
  - Web
  - Windows
  - Android
dependencies: []
---

# Feature: Deep Link Routing

## 1. Overview
This feature registers a custom OS-level URI scheme (`fuse://`) for the Sidekick application. It acts as the universal routing glue for hardware interactions. By encoding this URL format into physical NFC tags and DataMatrix labels, the operating system can seamlessly launch Sidekick from the background and route the user directly to a specific internal view (e.g., `fuse://location/12345`).

## 2. User Experience & UI
* **Trigger:** The user scans an NFC tag, scans a Sidekick DataMatrix with their native camera app, or clicks a `fuse://` link in another app (like an email or note).
* **Interaction:** 1. If Sidekick is closed, the OS launches it. If it is backgrounded, it is brought to the foreground.
    2. The application intercepts the URL payload.
    3. The SolidJS router parses the path (e.g., `/location/{id}`).
    4. The app automatically navigates to that specific entity's detail view without requiring the user to tap anything else.
* **Mobile Considerations:** Deep linking is a first-class citizen on mobile operating systems. The Android manifest must be configured to declare intent filters for the `fuse` scheme to prevent the OS from routing these to a web browser.

## 3. Technical Implementation
* **Frontend (SolidJS / Tauri):** * Utilizes the official `@tauri-apps/plugin-deep-link` to register the scheme and listen for incoming URLs across all platforms.
    * A global listener is mounted at the root of the SolidJS application that captures the deep link event, strips the `fuse://` prefix, and pushes the remaining path into the SolidJS router.
* **Backend (FastAPI):** * No backend changes required; this is strictly a client-side routing feature.

## 4. Out of Scope
* Universal Links / App Links (e.g., intercepting standard `https://bomshelter.com/` links). We are strictly sticking to the custom `fuse://` scheme for this phase to ensure hardware tags are uniquely scoped to the application.

---

## 5. Implementation Tasks
- [x] Install and configure `tauri-plugin-deep-link`.
- [x] Update `tauri.conf.json` and Android Manifest to declare the `fuse` scheme.
- [x] Create SolidJS global listener to intercept deep links and bridge them to the internal router.
- [x] **Retroactive Update:** Update `011-storage-labels.md` to ensure the generated DataMatrix encodes the `fuse://location/{id}` format instead of just the raw UUID.