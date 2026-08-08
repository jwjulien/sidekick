---
title: [Feature Name]
status: Draft # Options: Draft | Pending | In Progress | Complete | Scrapped
target: 
  - Web
  - Windows
  - Android
dependencies: []
---

# Feature: [Feature Name]

## 1. Overview
[A brief, 2-3 sentence description of what this feature is and why it exists.]

## 2. User Experience & UI
* **Trigger:** How does the user access this feature?
* **Interaction:** What are the steps the user takes?
* **Mobile Considerations:** How does this work on a touch screen?

## 3. Technical Implementation
* **Frontend (SolidJS / Tauri):** What components, state, or Tauri APIs are needed?
* **Backend (FastAPI / SQLite):** What API routes or logic are required?
* **Database Schema:** Are there new tables or columns needed in `backend/models.py`?

## 4. Out of Scope
[List what you are intentionally *not* building right now to prevent feature creep.]

---

## 5. Implementation Tasks
- [ ] Define SQLite schema updates.
- [ ] Build FastAPI route.
- [ ] Create SolidJS UI component.
- [ ] Wire frontend to backend API.