---
title: Device Settings and User Account Preferences Architecture
status: Draft
target: 
  - Web
  - Windows
  - Android
dependencies: []
---

# Feature: Device Settings and User Account Preferences Architecture

## 1. Overview
This feature formalizes a two-tier configuration architecture for Sidekick, cleanly distinguishing between **Local Device Settings** (bound to physical hardware/browsers without network overhead) and **User Account Preferences** (bound to user accounts and synced via backend database). This ensures hardware-specific operational settings (like shop floor light/dark mode or label printer attachments) stay local to the physical machine, while personal workflow settings follow the user across logins.

## 2. User Experience & UI
* **Trigger:** Accessible via `Settings.tsx` organized into two distinct UI sections: "Device & Local Settings" and "User Profile & Preferences".
* **Interaction:**
  * **Device & Local Settings (Hardware-Bound):**
    * Configures settings specific to the hardware unit executing the client (e.g., shop tablet, desktop computer, handheld scanner).
    * Includes Theme Selection (`System` | `Dark` | `Light`), Server Connection URL, Dev Sandbox Mode, Local Dymo Printer Service URL, Bluetooth Scale MAC Address, and Sound Effects Toggle.
    * Changes take effect instantly on the client with zero backend API latency.
  * **User Account Preferences (Account-Bound):**
    * Configures user-specific workflow choices that follow the authenticated user across multiple devices.
    * Includes Default Home Warehouse Location ID, Default Parts View Mode (Grid vs Table), Saved Filter Presets, Table Column Visibility Defaults, and Email/Alert Notifications.
    * Saved via API to the backend SQLite database upon change.

## 3. Technical Implementation
* **Frontend (SolidJS / LocalStorage & API):**
  * **Local Device Settings Service (`client/src/services/deviceSettings.ts`):**
    * Wraps `localStorage` with reactive signals and typed getters/setters (`getDeviceSetting`, `setDeviceSetting`).
    * Implements fallback defaults if keys do not exist in local storage.
  * **User Preferences Context (`client/src/context/UserPreferencesContext.tsx`):**
    * Fetches account preferences upon user authentication via `GET /auth/me/preferences`.
    * Exposes reactive store for user preferences and automatically debounces/persists updates via `PUT /auth/me/preferences`.
* **Backend (FastAPI / SQLite):**
  * **API Endpoint:** Create `/auth/me/preferences` routes in `server/routers/auth.py` for fetching and updating preference JSON payloads.
* **Database Schema:**
  * Add a `preferences` JSON text column (or `user_preferences` table) associated with `users` table in `server/models.py`.

## 4. Out of Scope
* Enterprise remote device configuration management (MDM).
* Hardware-level encryption for local storage items.

---

## 5. Implementation Tasks
- [ ] Create `client/src/services/deviceSettings.ts` for unified hardware-local key-value management.
- [ ] Create `user_preferences` table or column in `server/models.py` and run SQLite migration.
- [ ] Add `GET /auth/me/preferences` and `PUT /auth/me/preferences` in FastAPI backend.
- [ ] Create `UserPreferencesContext.tsx` for client-side user account state sync.
- [ ] Reorganize `client/src/pages/Settings.tsx` into clear "Device & Local Settings" and "User Preferences" tabs/cards.
