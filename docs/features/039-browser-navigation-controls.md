---
title: Browser Navigation Controls
status: Complete
target: 
  - Web
  - Windows
  - Android
dependencies: []
---

# Feature: Browser Navigation Controls

## 1. Overview
This feature introduces explicit browser navigation controls (**Back**, **Forward**, and **Refresh**) into Sidekick's UI shell. Since Sidekick runs as a native desktop application via Tauri (as well as mobile web/Android), standard browser window navigation controls are missing from the titlebar. Providing dedicated Back, Forward, and Page Refresh controls alongside the Theme Selection dropdown restores expected desktop browser navigation ergonomics.

## 2. User Experience & UI
* **Trigger:**
  * **Desktop Sidebar Toolbar:** Rendered at the top of the desktop sidebar above navigation items.
  * **Mobile Menu Header:** Integrated inside the expanded mobile overlay menu. Hidden when the mobile menu is collapsed to preserve vertical screen real estate.
* **Interaction:**
  * **Back Button (`ArrowLeft` / `ChevronLeft`):** Triggers `window.history.back()`. Automatically disabled visually (`opacity-40 cursor-not-allowed`) when browser history back stack is unavailable.
  * **Forward Button (`ArrowRight` / `ChevronRight`):** Triggers `window.history.forward()`.
  * **Refresh Button (`RotateCw`):** Triggers `window.location.reload()`, re-fetching active route state and resetting transient memory caches.
  * **Theme Selection Button:** Positioned directly adjacent to navigation controls, opening a popover dropdown menu to select between `Dark`, `Light`, and `System` themes.
* **Mobile Considerations:**
  * Android users rely on native edge-swipe back gestures for navigation. When the mobile sidebar is collapsed, the toolbar remains hidden to save header space. When expanded, full controls (Forward, Refresh, Theme) are available.

## 3. Technical Implementation
* **Frontend (SolidJS / Router):**
  * Created `client/src/components/NavigationToolbar.tsx` component.
  * Uses `window.history.back()` and `window.history.forward()` for history traversal.
  * Uses `window.location.reload()` for page refresh with rotation icon animation during reload.
  * Integrated `<ThemeToggle />` popover dropdown into the toolbar.
  * Inserted `<NavigationToolbar />` into `Layout.tsx` (desktop sidebar header and mobile drawer header).
* **Backend (FastAPI / SQLite):**
  * No backend API changes required.
* **Database Schema:**
  * No database schema changes required.

## 4. Out of Scope
* Browser tab bar / multi-tab rendering within a single Tauri window.
* Custom route history caching outside standard browser/router history stacks.

---

## 5. Implementation Tasks
- [x] Build `client/src/components/NavigationToolbar.tsx` with Back, Forward, Refresh, and Theme Toggle dropdown.
- [x] Update `client/src/components/Layout.tsx` to render `<NavigationToolbar />` in desktop sidebar and mobile menu drawer.
- [x] Verify history traversal, page reload, and theme selection in browser and desktop modes.
