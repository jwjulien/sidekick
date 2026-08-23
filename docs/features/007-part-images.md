---
title: Part Images
status: In Progress
target: 
  - Web
  - Windows
  - Android
dependencies: 
  - 004-core-parts.md
---

# Feature: Part Images

## 1. Overview
This feature allows users to attach visual references (photos, pinout diagrams, or package footprints) directly to a specific Part. Like documents, these images are stored natively as BLOBs within the SQLite database. This ensures the Sidekick database remains a highly portable, single-file source of truth for the entire inventory.

## 2. User Experience & UI
* **Trigger:** Accessed via an "Images" or "Gallery" tab within the Detail View of a specific Part.
* **Interaction:** 1. The user navigates to a part and views the image gallery.
    2. Images are displayed in a responsive grid as thumbnails.
    3. Clicking an image expands it into a full-screen lightbox or modal for detailed viewing.
    4. Clicking "Add Image" opens a native file picker.
    5. The user selects a photo, optionally provides a `label` (e.g., "Top View", "Pinout"), and saves.
* **Mobile Considerations:** The upload input must utilize standard HTML capture attributes (e.g., `<input type="file" accept="image/*" capture="environment">`). On the Tauri Android build, this will seamlessly trigger the device's native camera app, allowing users to snap photos of inventory on the fly. 

## 3. Technical Implementation
* **Frontend (SolidJS / Tauri):** * An image gallery/grid component.
    * A file upload form using `FormData` to transmit binary data and metadata.
    * Images fetched from the backend should be rendered using standard `<img>` tags pointing to the API URL (e.g., `<img src="/api/images/123/render" />`).
* **Backend (FastAPI):** * `GET /api/parts/{part_id}/images` - Returns metadata for a part's images (IDs and labels, but *not* the heavy BLOB content).
    * `GET /api/images/{id}/render` - Returns the actual binary BLOB using FastAPI's `Response(content=blob_data, media_type="image/jpeg")` so the browser can paint it directly.
    * `POST /api/parts/{part_id}/images` - Accepts `multipart/form-data`, extracting the binary and saving it to SQLite.
    * `DELETE /api/images/{id}` - Removes the image.
* **Database Schema (SQLite / Peewee):** * Model: `Image`
    * Columns: `id` (PK), `created_on`, `modified_on`, `part_id` (FK to Parts), `label` (VARCHAR 40), `filename` (VARCHAR 30), `content` (BLOB).

## 4. Out of Scope
* Server-side image compression or automatic resizing (for this phase, we assume the user uploads reasonably sized images, though client-side compression before upload could be a future enhancement).
* Machine learning or OCR image recognition to auto-tag components.

---

## 5. Implementation Tasks
- [x] Define `Image` model with `part_id` foreign key.
- [x] Build FastAPI `POST` route for multipart uploads.
- [x] Build FastAPI `GET` route to serve the raw image binary to the frontend.
- [x] Create SolidJS image gallery / carousel view.
- [x] Create SolidJS modal upload form.
- [x] Wire frontend to backend API.
- [x] Add drag and drop support for local file uploads and browser image URL downloads.