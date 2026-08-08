---
title: Project Assemblies & Revision Cloning
status: Draft
target: 
  - Web
  - Windows
  - Android
dependencies: 
  - 002-projects.md
  - 005-project-revisions.md
---

# Feature: Project Assemblies & Revision Cloning

## 1. Overview
This feature refines the organizational hierarchy by introducing an `Assembly` layer between `Projects` and `Revisions`. This allows a single Project to contain multiple distinct physical PCBs or modules. Furthermore, it introduces a "Clone" functionality, allowing users to base a new revision directly on an older one by carrying over all existing BOM materials, drastically reducing data entry for minor iterations.

## 2. User Experience & UI
* **Trigger:** Accessed within the Project detail view.
* **Interaction (Assembly Management):** Users create an Assembly (e.g., "Main Controller Board") under a Project. Revisions (e.g., "v1.0", "v1.1") are now nested under this Assembly.
* **Interaction (Cloning):** Next to any existing Revision, a user clicks "Clone to New Revision". A modal prompts for the new version name (e.g., "v2.0"). Upon saving, a new Revision is created, and all `Material` records from the parent revision are duplicated and attached to the new one.
* **Mobile Considerations:** Deeply nested trees (Project -> Assembly -> Revision -> Materials) can clutter mobile navigation. Use breadcrumb headers to keep the user oriented.

## 3. Technical Implementation
* **Frontend (SolidJS / Tauri):** * Update routing to reflect the new hierarchy: `/projects/:id/assemblies/:id/revisions/:id`.
* **Backend (FastAPI):** * `POST /api/revisions/{id}/clone` - A dedicated endpoint that executes a database transaction to duplicate the revision record and perform a bulk insert duplicating all associated `Material` rows.
* **Database Schema Updates (SQLite / Peewee):** * **New Model `Assembly`:** `id` (PK), `project_id` (FK), `name`, `description`.
    * **Modified Model `Revision`:** Drop `project_id`, replace with `assembly_id` (FK).

## 4. Out of Scope
* Merging two separate revisions together.

---

## 5. Implementation Tasks
- [ ] Create `Assembly` Peewee model and update `Revision` foreign keys.
- [ ] Build FastAPI CRUD routes for Assemblies.
- [ ] Build FastAPI transactional `/clone` route for Revisions.
- [ ] Update SolidJS UI hierarchy and breadcrumbs.