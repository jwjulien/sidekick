---
title: Light and Dark Theme Support
status: Draft
target: 
  - Web
  - Windows
  - Android
dependencies: []
---

# Feature: Light and Dark Theme Support

## 1. Overview
This feature introduces multi-theme support to Sidekick, adding a bright, high-contrast Light Mode alongside the existing dark glassmorphism design. Users can select between `System` (matches OS preference), `Dark` (preserves existing dark glass theme), and `Light` (a clean, frosted glass light palette). Theme preferences persist locally per device in `localStorage` without requiring backend API calls, and settings can be toggled via the navbar or Settings screen.

## 2. User Experience & UI
* **Trigger:**
  * **Quick Toggle:** A sun/moon/laptop theme toggle icon in the top Navbar header for instant one-click switching.
  * **Settings Panel:** An "Appearance & Theme" section in `Settings.tsx` with segmented controls (`System`, `Dark`, `Light`) and descriptions.
* **Interaction:**
  * Selecting `System` listens to OS `prefers-color-scheme` media queries and updates live if the OS theme changes.
  * Selecting `Dark` forces the original dark glass aesthetic (deep obsidian background `#0b0b0e`, dark glass panels `rgba(20,20,28,0.65)`, neon accent accents).
  * Selecting `Light` applies a bright frosted aesthetic (light slate background `#f8fafc`, clean frosted white glass panels `rgba(255,255,255,0.75)` with subtle borders `rgba(0,0,0,0.08)`, slate typography `#0f172a`, and high-contrast accent glows).
  * The transition between themes is smooth with no layout shifts or unstyled flash of content (FOUC) on application startup.
* **Mobile Considerations:**
  * Outdoor or high-glare shop floor usage often suffers on dark screens under direct bright light. Light Mode improves mobile readability on shop floor tablets and smartphones. Touch targets remain identically sized across both themes.

## 3. Technical Implementation
* **Frontend (SolidJS / Tailwind CSS):**
  * **CSS Design Token Architecture (`client/src/index.css`):**
    * Define CSS Custom Properties (`--bg-primary`, `--bg-card`, `--glass-bg`, `--glass-border`, `--text-primary`, `--text-secondary`, `--input-bg`, `--input-border`, etc.) scoped under `html[data-theme="dark"]` and `html[data-theme="light"]`.
    * Retain all existing utility classes (`.glass-panel`, `.glass-card`, `.glass-input`, `.btn-primary`, `.btn-secondary`) but bind them to the theme CSS custom properties instead of hardcoded hex/rgba values.
  * **Theme Context & Store (`client/src/context/ThemeContext.tsx`):**
    * Manages theme signal: `theme()` with allowed values `'system' | 'dark' | 'light'`.
    * Computes active effective theme (`'dark'` or `'light'`).
    * Listens to `window.matchMedia('(prefers-color-scheme: dark)')` to handle live OS updates when in `'system'` mode.
    * Sets `document.documentElement.setAttribute('data-theme', activeTheme)` dynamically.
    * Persists user choice in `localStorage.setItem('sidekick_app_theme', choice)`.
  * **Startup Initialization:**
    * Inline snippet in `index.html` or before main app render reads `localStorage` to immediately set `data-theme` on `<html>` tag, preventing theme flash on boot.
  * **UI Updates:**
    * Add `<ThemeToggle />` button to `client/src/components/Navbar.tsx`.
    * Add Theme selection card to `client/src/pages/Settings.tsx`.
* **Backend (FastAPI / SQLite):**
  * None required. Theme preferences are local hardware/device-bound settings.
* **Database Schema:**
  * No database schema changes required.

## 4. Out of Scope
* Custom color theme creation / custom hex accent pickers.
* Syncing theme selection across multiple devices over the network (theme selection is intentionally kept hardware-local).

---

## 5. Implementation Tasks
- [ ] Refactor `client/src/index.css` to use CSS theme tokens (`data-theme="dark"` and `data-theme="light"`).
- [ ] Create `client/src/context/ThemeContext.tsx` provider for local theme persistence & system media query listener.
- [ ] Implement early theme initialization script to avoid FOUC.
- [ ] Build `<ThemeToggle />` component and insert into `Navbar.tsx`.
- [ ] Add "Appearance & Theme" section to `client/src/pages/Settings.tsx`.
- [ ] Audit component color overrides (text-white, bg-darkBg) across views to ensure clean rendering in both Light and Dark modes.
