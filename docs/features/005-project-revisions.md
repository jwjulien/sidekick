---
title: Project Revisions
status: Complete
target: 
  - Web
  - Windows
  - Android
dependencies: 
  - 002-projects.md
---

# Feature: Project Revisions

## 1. Overview
This feature introduces version control into Sidekick. A "Revision" represents a specific iteration or release candidate of a parent Project (e.g., "v1.0", "v2.1-beta"). It acts as the anchor point for the actual Bill of Materials; parts are assigned to a specific Revision, not directly to a Project, allowing users to maintain a historical record of how a design changed over time.

## 2. User Experience & UI
* **Trigger:** Accessed from within the detail view of a specific Project.
* **Interaction:** 1. The user navigates to a Project and views the "Revisions" tab or section.
    2. A list/timeline of existing revisions is displayed, sorted by date.
    3. The user clicks "New Revision".
    4. A form opens requesting a `version` string (e.g., "v1.0") and a release `date`.
    5. Upon saving, the new revision is added to the project's timeline.
    6. Clicking a specific revision opens the workspace where the actual Bill of Materials (BOM) will be managed.
* **Mobile Considerations:** A vertical timeline UI works best for displaying version history on narrow screens. Date pickers must utilize the native mobile OS calendar input (`type="date"`) for optimal touch interaction.

## 3. Technical Implementation
* **Frontend (SolidJS / Tauri):** * A nested routing structure (e.g., `/projects/:id/revisions`).
    * A list or timeline component for displaying the revisions.
    * A form component for creating/editing a revision, automatically passing the parent `project_id` in the background.
* **Backend (FastAPI):** * `GET /api/projects/{project_id}/revisions` - Returns all revisions for a specific project.
    * `GET /api/revisions/{id}` - Returns details for a single revision.
    * `POST /api/revisions` - Creates a new revision (validates `project_id` exists).
    * `PUT /api/revisions/{id}` - Updates the version string or date.
    * `DELETE /api/revisions/{id}` - Removes a revision. *(Must handle cascade deletion of attached materials later).*
* **Database Schema (SQLite / Peewee):** * Model: `Revision`
    * Columns: `id` (PK), `created_on`, `modified_on`, `project_id` (FK to Projects), `version` (VARCHAR 32), `date` (DATE).

## 4. Out of Scope
* Adding the actual parts/components to the revision (this is handled in `009-materials-bom.md`).
* Cloning or duplicating one revision into another (can be added in a future enhancement phase).

---

## 5. Implementation Tasks
- [x] Define `Revision` Peewee model with `project_id` foreign key.
- [x] Build FastAPI CRUD routes (nested under projects for the `GET` list).
- [x] Create SolidJS UI timeline/list component inside the Project detail view.
- [x] Create SolidJS form for creating/editing revisions.
- [x] Wire frontend to backend API.