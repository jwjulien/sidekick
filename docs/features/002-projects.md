---
title: Core Projects
status: Complete
target: 
  - Web
  - Windows
  - Android
dependencies: []
---

# Feature: Core Projects

## 1. Overview
This feature establishes the high-level "Projects" entity. In the BOM Shelter architecture, a Project acts as the ultimate parent container for anything you are building or tracking. It is a strictly foundational table that will later allow users to attach version-controlled revisions and material lists to a specific unified goal.

## 2. User Experience & UI
* **Trigger:** Accessed via a "Projects" button in the primary navigation sidebar or bottom tab bar.
* **Interaction:** 1. The user views a grid or list of existing projects.
    2. The user taps/clicks "New Project".
    3. A simple form requests a `title` and a `description`.
    4. Upon saving, the new project appears in the grid.
    5. Clicking an existing project opens its detailed view (which will eventually house its revisions and BOMs).
* **Mobile Considerations:** Use a card-based layout for the project list to provide large, comfortable touch targets. Ensure text truncation is handled gracefully if the `description` is long.

## 3. Technical Implementation
* **Frontend (SolidJS / Tauri):** * A list/grid component to display projects.
    * A modal or dedicated page with a form for creating and editing projects.
    * State management to store the fetched list of projects.
* **Backend (FastAPI):** * `GET /api/projects` - Returns the list of all projects.
    * `GET /api/projects/{id}` - Returns details for a single project.
    * `POST /api/projects` - Creates a new project.
    * `PUT /api/projects/{id}` - Updates a project's title or description.
    * `DELETE /api/projects/{id}` - Removes a project. *(Note: Must eventually handle cascade deletions for attached revisions/materials).*
* **Database Schema (SQLite / SQLAlchemy):** * Model: `Project`
    * Columns: `id` (PK), `created_on`, `modified_on`, `title` (VARCHAR 40), `description` (TEXT).

## 4. Out of Scope
* Defining project version history or revisions (this will be handled in `005-project-revisions.md`).
* Assigning specific parts or BOMs directly to the project (projects only hold revisions, revisions hold parts).

---

## 5. Implementation Tasks
- [x] Define `Project` SQLAlchemy model.
- [x] Build FastAPI CRUD routes (`GET`, `POST`, `PUT`, `DELETE`).
- [x] Create SolidJS UI grid/list component.
- [x] Create SolidJS form for creating/editing projects.
- [x] Wire frontend to backend API.