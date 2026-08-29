---
title: Markdown Rendering Component
status: Complete
target: 
  - Web
  - Windows
  - Android
dependencies: []
---

# Feature: Markdown Rendering Component

## 1. Overview
The Markdown Rendering Component provides a reactive, display-only UI element (`<Markdown />`) for rendering formatted markdown text safely across the application. It enables rich note-taking and documentation for Part Lists, Part Details, Projects, Storage Locations, and Inventory items, supporting formatting features such as lists, GFM tables, code styling, callouts/admonitions, and abbreviations.

## 2. User Experience & UI
* **Trigger:** Implicitly rendered wherever notes or descriptions are displayed across the application (e.g., list card previews, detail view headers, part notes, project overviews).
* **Interaction:** 
  - Display-only: rendered text updates automatically whenever underlying note/description signals change.
  - Links open safely in external windows or router handlers.
  - Hovering on abbreviation terms (`<abbr>`) presents title tooltips.
  - Callouts/admonitions (`[!NOTE]`, `[!WARNING]`, `[!TIP]`, `[!IMPORTANT]`, `[!CAUTION]`) render with distinct accent borders and background tints.
  - GFM tables render within responsive horizontal scroll containers to prevent layout breaking.
* **Mobile Considerations:** Touch-friendly code scrolling, overflow protection on tables, line clamping for card previews.

## 3. Technical Implementation
* **Frontend (SolidJS / Tauri):** 
  - `client/src/components/Markdown.tsx`: Reactive component using `createMemo()` to memoize parsed markdown output.
  - `marked`: Fast, standard-compliant Markdown tokenizer/parser with custom extensions for abbreviations and callout admonitions.
  - `DOMPurify`: Sanitizes generated HTML before setting `innerHTML` to prevent XSS.
  - `client/src/components/Markdown.css`: Styling rules for typography, code blocks, tables, callouts, and abbreviations under dark/light themes.
* **Backend (FastAPI / SQLite):** No backend changes needed (existing string note/description fields are stored as text in SQLite).
* **Database Schema:** N/A (uses existing `description`, `notes`, and string fields).

## 4. Out of Scope
* Inline WYSIWYG rich text editor (editing remains raw markdown / plain text textareas with live preview).
* Server-side markdown rendering.
* Custom LaTeX math block execution.

---

## 5. Implementation Tasks
- [x] Install `marked` and `dompurify` dependencies in `client/package.json`.
- [x] Create `client/src/components/Markdown.tsx` with SolidJS reactivity, `marked` extensions, and `DOMPurify` sanitization.
- [x] Create `client/src/components/Markdown.css` styling tokens for admonitions, tables, code, and abbreviations.
- [x] Integrate `<Markdown />` into `PartLists.tsx` (list cards and header details).
- [x] Integrate `<Markdown />` into `PartDetails.tsx` (part notes/description).
- [x] Integrate `<Markdown />` into `Projects.tsx` (project description and card preview).
- [x] Integrate `<Markdown />` into `Inventory.tsx` (inventory notes preview).
- [x] Add unit test suite `Markdown.test.tsx` verifying parsing, feature extensions, and XSS sanitization.
